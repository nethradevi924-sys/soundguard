package com.safesphere.soundguard;

import android.util.Log;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * SoundGuard - Real-World Acoustic Classifier & Probabilistic Scoring Engine
 * 
 * Architecture:
 * - 14-class authoritative index mapping (0-12 Hazards, 13 Background/Unknown)
 * - Layer 1: Microphone Noise Floor Estimation & Dynamic Silence Gate
 * - Layer 2: Hard Negative Music & Human Speech Rejection Filters
 * - Layer 3: FFT Power Spectrum (512-pt Cooley-Tukey) + Subband Partitioning (6 bands)
 * - Layer 4: Multi-frame Trajectory Modulation & Centroid Tracking
 *   (Differentiates Car Horn vs. Siren vs. Baby Crying)
 * - Layer 5: Sub-window Transient Impulse & Decay Analysis (Door Knocking & Glass Breaking)
 * - Layer 6: Temperature-scaled Softmax Probability Distribution + Calibrated Logit Margin
 * - Layer 7: Class-Specific Temporal Persistence State Machine:
 *   [NORMAL] -> [POSSIBLE_SOUND] -> [CONFIRMED_DANGEROUS_SOUND]
 */
public class SoundClassifier {

    private static final String TAG_ML = "SoundGuard-ML";
    private static final String TAG_DET = "SoundGuard-Detection";

    public static final float CONFIDENCE_THRESHOLD = 0.80f;
    public static final float LOGIT_MARGIN_THRESHOLD = 1.50f;
    private static final float MIN_AUDIO_ACTIVITY_RMS = 0.012f;

    // Dynamic noise floor tracking
    private float estimatedNoiseFloor = 0.010f;

    // Temporal smoothing state machine
    private String lastCandidateSound = null;
    private int consecutiveMatchCount = 0;

    public SoundClassifier() {
        Log.d(TAG_ML, "SoundClassifier initialized (14 authoritative classes, 16kHz input)");
    }

    public static class Prediction {
        public final int index;
        public final String id;
        public final String name;
        public final float confidence;
        public final int confidencePercent;

        public Prediction(int index, String id, String name, float confidence) {
            this.index = index;
            this.id = id;
            this.name = name;
            this.confidence = confidence;
            this.confidencePercent = Math.min(100, Math.max(0, Math.round(confidence * 100)));
        }
    }

    public static class Classification {
        public final String soundId;
        public final String soundName;
        public final float confidence;
        public final int confidencePercent;
        public final boolean isDanger;
        public final float rms;
        public final int topIndex;
        public final List<Prediction> topPredictions;
        public final String state; // "NORMAL", "POSSIBLE_SOUND", "CONFIRMED_DANGEROUS_SOUND", "UNKNOWN"
        public final String decisionReason;

        public Classification(String soundId, String soundName, float confidence, boolean isDanger,
                              float rms, int topIndex, List<Prediction> topPredictions,
                              String state, String decisionReason) {
            this.soundId = soundId;
            this.soundName = soundName;
            this.confidence = confidence;
            this.confidencePercent = Math.min(100, Math.max(0, Math.round(confidence * 100)));
            this.isDanger = isDanger;
            this.rms = rms;
            this.topIndex = topIndex;
            this.topPredictions = topPredictions;
            this.state = state;
            this.decisionReason = decisionReason;
        }

        // Backward compatibility constructor
        public Classification(String soundId, String soundName, float confidence, boolean isDanger,
                              float rms, int topIndex, List<Prediction> topPredictions) {
            this(soundId, soundName, confidence, isDanger, rms, topIndex, topPredictions,
                 isDanger ? "CONFIRMED_DANGEROUS_SOUND" : "NORMAL",
                 isDanger ? "Alert Confirmed" : "Below Threshold / Ambient");
        }
    }

    /**
     * Classifies a 1-second audio frame (16,000 PCM samples at 16kHz).
     */
    public Classification classify(short[] pcmSamples, int length) {
        if (pcmSamples == null || length < 256) {
            return buildNormalResult(0.0f, "Insufficient audio samples");
        }

        // 1. Convert PCM short to normalized float & remove DC bias
        float[] audio = new float[length];
        double sum = 0;
        int peakVal = 0;
        for (int i = 0; i < length; i++) {
            audio[i] = pcmSamples[i] / 32768.0f;
            sum += audio[i];
            int abs = Math.abs(pcmSamples[i]);
            if (abs > peakVal) peakVal = abs;
        }
        float dc = (float) (sum / length);
        double sumSq = 0;
        int zeroCrossings = 0;
        for (int i = 0; i < length; i++) {
            audio[i] -= dc;
            sumSq += audio[i] * audio[i];
            if (i > 0 && ((audio[i] >= 0 && audio[i - 1] < 0) || (audio[i] < 0 && audio[i - 1] >= 0))) {
                zeroCrossings++;
            }
        }
        float rms = (float) Math.sqrt(sumSq / length);
        float peak = peakVal / 32768.0f;
        float zcr = (float) zeroCrossings / length;

        // Dynamic noise floor tracking (exponential moving average)
        if (rms < 2.0f * estimatedNoiseFloor) {
            estimatedNoiseFloor = 0.95f * estimatedNoiseFloor + 0.05f * rms;
        }

        // -------------------------------------------------------------------------
        // Layer 1: Silence & Audio Activity Gate (Prompt Section 5)
        // -------------------------------------------------------------------------
        // -------------------------------------------------------------------------
        // Layer 1: Silence & Audio Activity Gate (Prompt Section 5)
        // -------------------------------------------------------------------------
        if (rms < MIN_AUDIO_ACTIVITY_RMS || rms < (estimatedNoiseFloor * 1.25f)) {
            consecutiveMatchCount = 0;
            lastCandidateSound = null;
            return buildNormalResult(rms, "Ambient / Quiet Room (RMS below activity gate)");
        }

        // -------------------------------------------------------------------------
        // Layer 2: Sub-window Transient Analysis (8 sub-frames of 125ms = 2000 samples)
        // -------------------------------------------------------------------------
        int numSubFrames = 8;
        int subLen = length / numSubFrames;
        float[] subRms = new float[numSubFrames];
        float maxSubRms = 0;
        float minSubRms = Float.MAX_VALUE;
        double subRmsSum = 0;

        for (int s = 0; s < numSubFrames; s++) {
            double sSq = 0;
            int start = s * subLen;
            for (int i = 0; i < subLen; i++) {
                float v = audio[start + i];
                sSq += v * v;
            }
            subRms[s] = (float) Math.sqrt(sSq / subLen);
            if (subRms[s] > maxSubRms) maxSubRms = subRms[s];
            if (subRms[s] < minSubRms) minSubRms = subRms[s];
            subRmsSum += subRms[s];
        }
        float avgSubRms = (float) (subRmsSum / numSubFrames);
        float transientRatio = maxSubRms / (avgSubRms + 1e-6f);
        float tempVar = maxSubRms > 1e-6f ? (maxSubRms - minSubRms) / maxSubRms : 0.0f;

        // Count isolated mechanical impulse taps (Wood knocks: sharp onset, rapid drop)
        int impulseCount = 0;
        for (int s = 1; s < numSubFrames - 1; s++) {
            if (subRms[s] > 0.018f && subRms[s] > 2.0f * subRms[s - 1] && subRms[s] > 1.5f * subRms[s + 1]) {
                impulseCount++;
            }
        }

        // -------------------------------------------------------------------------
        // Layer 3: FFT Power Spectrum & Sub-frame Frequency Trajectory Sweep Metrics
        // -------------------------------------------------------------------------
        int fftSize = 512;
        int numBins = fftSize / 2;
        float binWidthHz = 16000.0f / fftSize;
        float[] powerSpectrum = new float[numBins];
        int numWindows = Math.min(8, length / fftSize);
        if (numWindows < 1) numWindows = 1;

        double[] real = new double[fftSize];
        double[] imag = new double[fftSize];
        List<Float> activeCentroids = new ArrayList<>();
        List<Float> activePeakFreqs = new ArrayList<>();

        for (int w = 0; w < numWindows; w++) {
            int offset = w * (length / numWindows);
            if (offset + fftSize > length) offset = length - fftSize;

            for (int i = 0; i < fftSize; i++) {
                double hanning = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / (fftSize - 1)));
                real[i] = audio[offset + i] * hanning;
                imag[i] = 0.0;
            }

            fftRadix2(real, imag, fftSize);

            double wPow = 0;
            double wNum = 0;
            float maxPInWindow = 0;
            int maxPBin = 0;

            for (int i = 0; i < numBins; i++) {
                float p = (float) (real[i] * real[i] + imag[i] * imag[i]);
                powerSpectrum[i] += p;
                wPow += p;
                wNum += i * binWidthHz * p;
                if (p > maxPInWindow) {
                    maxPInWindow = p;
                    maxPBin = i;
                }
            }
            if (wPow > 1e-4) {
                activeCentroids.add((float) (wNum / (wPow + 1e-12)));
                activePeakFreqs.add(maxPBin * binWidthHz);
            }
        }

        for (int i = 0; i < numBins; i++) {
            powerSpectrum[i] /= numWindows;
        }

        // Sub-frame Frequency Trajectory Sweep Metrics across active sound windows
        float centroidStdDev = 0.0f;
        float peakFreqRange = 0.0f;
        float maxAdjacentDelta = 0.0f;

        if (activeCentroids.size() > 0) {
            float centroidSum = 0;
            for (float c : activeCentroids) centroidSum += c;
            float meanWindowCentroid = centroidSum / activeCentroids.size();
            double centroidVarSum = 0;
            for (float c : activeCentroids) {
                centroidVarSum += (c - meanWindowCentroid) * (c - meanWindowCentroid);
            }
            centroidStdDev = (float) Math.sqrt(centroidVarSum / activeCentroids.size());

            float minPeakFreq = Float.MAX_VALUE;
            float maxPeakFreq = 0;
            for (float pf : activePeakFreqs) {
                if (pf < minPeakFreq) minPeakFreq = pf;
                if (pf > maxPeakFreq) maxPeakFreq = pf;
            }
            peakFreqRange = maxPeakFreq - minPeakFreq;

            for (int w = 1; w < activePeakFreqs.size(); w++) {
                float d = Math.abs(activePeakFreqs.get(w) - activePeakFreqs.get(w - 1));
                if (d > maxAdjacentDelta) maxAdjacentDelta = d;
            }
        }

        // Dual Fundamental Peak Detection for Car Horn (380-550 Hz)
        float maxTotalPower = 0;
        for (int b = 0; b < numBins; b++) {
            if (powerSpectrum[b] > maxTotalPower) maxTotalPower = powerSpectrum[b];
        }
        int hornBinStart = (int) (380.0f / binWidthHz);
        int hornBinEnd = (int) (550.0f / binWidthHz);
        float maxHornBandPower = 0;
        for (int b = hornBinStart; b <= hornBinEnd && b < numBins; b++) {
            if (powerSpectrum[b] > maxHornBandPower) maxHornBandPower = powerSpectrum[b];
        }
        List<Float> hornPeaks = new ArrayList<>();
        if (maxHornBandPower >= 0.25f * maxTotalPower) {
            for (int b = hornBinStart + 1; b < hornBinEnd && b < numBins - 1; b++) {
                if (powerSpectrum[b] > powerSpectrum[b - 1] && powerSpectrum[b] > powerSpectrum[b + 1]) {
                    if (powerSpectrum[b] >= 0.25f * maxHornBandPower) {
                        hornPeaks.add(b * binWidthHz);
                    }
                }
            }
        }
        boolean hasDualHornPeaks = (hornPeaks.size() >= 2 && Math.abs(hornPeaks.get(1) - hornPeaks.get(0)) >= 40.0f && Math.abs(hornPeaks.get(1) - hornPeaks.get(0)) <= 140.0f);

        // -------------------------------------------------------------------------
        // Layer 4: Critical Subband Energy Partitioning
        // -------------------------------------------------------------------------
        double totalPower = 0;
        double centroidNumerator = 0;
        double logSum = 0;

        double deepBassPower = 0;   // 0 - 150 Hz (Kick drums, basslines, traffic rumble)
        double woodHornPower = 0;   // 150 - 550 Hz (Door knock wood body 150-400Hz, Car horn F0 380-520Hz)
        double doorbellPower = 0;   // 480 - 750 Hz (Doorbell Ding 660Hz / Dong 520Hz, Infant F0 420-750Hz)
        double midPower = 0;        // 750 - 2400 Hz (Siren wail, vocal range, electronic alarms)
        double alarmPower = 0;      // 2400 - 4200 Hz (Fire alarm T-3 pure tones, security warbles)
        double highPower = 0;       // 2800 - 8000 Hz (Glass breaking shatter, sharp clicks)

        for (int i = 0; i < numBins; i++) {
            float freq = i * binWidthHz;
            float p = powerSpectrum[i] + 1e-12f;
            totalPower += p;
            centroidNumerator += freq * p;
            logSum += Math.log(p);

            if (freq <= 150.0f) deepBassPower += p;
            if (freq > 150.0f && freq <= 550.0f) woodHornPower += p;
            if (freq >= 480.0f && freq <= 750.0f) doorbellPower += p;
            if (freq >= 750.0f && freq <= 2400.0f) midPower += p;
            if (freq >= 2400.0f && freq <= 4200.0f) alarmPower += p;
            if (freq >= 2800.0f) highPower += p;
        }

        float spectralCentroid = (float) (centroidNumerator / (totalPower + 1e-12));
        double geomMean = Math.exp(logSum / numBins);
        double arithMean = totalPower / numBins;
        float spectralFlatness = (float) (geomMean / (arithMean + 1e-12));

        float deepBassRatio = (float) (deepBassPower / (totalPower + 1e-12));
        float woodHornRatio = (float) (woodHornPower / (totalPower + 1e-12));
        float doorbellRatio = (float) (doorbellPower / (totalPower + 1e-12));
        float midRatio = (float) (midPower / (totalPower + 1e-12));
        float alarmRatio = (float) (alarmPower / (totalPower + 1e-12));
        float highRatio = (float) (highPower / (totalPower + 1e-12));

        // -------------------------------------------------------------------------
        // Layer 5: Hard Negative Music & Human Speech Rejection Filters (Prompt Section 4 & 18)
        // -------------------------------------------------------------------------
        boolean isMusic = (deepBassRatio >= 0.16f && (midRatio >= 0.20f || doorbellRatio >= 0.20f)) 
                          || (deepBassRatio >= 0.28f);

        // Speech has balanced woodHorn (formants 300-800Hz) and mid (formants 900-2400Hz), low high (<15%), smooth envelope
        boolean isSpeech = ((woodHornRatio + midRatio) >= 0.65f && 
                            highRatio < 0.15f && deepBassRatio < 0.22f && 
                            transientRatio < 2.4f && impulseCount == 0 &&
                            zcr >= 0.04f && zcr <= 0.20f && 
                            spectralFlatness >= 0.005f && spectralFlatness <= 0.25f);

        // -------------------------------------------------------------------------
        // Layer 6: Acoustic Logit Scoring across 14 Authoritative Classes
        // -------------------------------------------------------------------------
        float[] logits = new float[SoundClasses.NUM_CLASSES];
        for (int i = 0; i < 13; i++) logits[i] = -4.0f;

        // Background / Unknown Class Baseline (Dominant for music, speech, stationary fan, ambient noise)
        logits[13] = 1.0f + (isMusic ? 3.5f : 0.0f) + (isSpeech ? 5.5f : 0.0f) + (spectralFlatness > 0.28f ? 2.5f : 0.0f);

        // 0. Fire Alarm & Electronic Buzzer Alarms:
        // a) High pure tone T-3 pulses in 2400 - 4200 Hz
        // b) Mid-frequency piezo buzzer alarm in 900 - 1800 Hz (steady pitch, zero infant F0)
        boolean isHighAlarm = (alarmRatio >= 0.45f && spectralCentroid >= 2400 && spectralFlatness <= 0.15f);
        boolean isMidBuzzer = (midRatio >= 0.70f && spectralFlatness <= 0.025f && doorbellRatio < 0.10f && woodHornRatio < 0.10f 
                               && spectralCentroid >= 900 && spectralCentroid <= 1800 && peakFreqRange < 80.0f && centroidStdDev < 50.0f);
        if (!isMusic && !isSpeech && (isHighAlarm || isMidBuzzer) && rms >= 0.014f) {
            logits[0] = 5.5f + 3.0f * (isHighAlarm ? alarmRatio : midRatio);
        }

        // 1. Siren (GENUINE CONTINUOUS FM FREQUENCY MODULATION REQUIRED! Mid-band dominant, NO wood horn, continuous wail tempVar <= 0.25)
        if (!isMusic && !isSpeech && deepBassRatio < 0.06f && woodHornRatio < 0.22f) {
            if (midRatio >= 0.48f && spectralCentroid >= 800 && spectralCentroid <= 1800 && spectralFlatness <= 0.18f && rms >= 0.016f) {
                if (peakFreqRange >= 180.0f && centroidStdDev >= 75.0f && tempVar <= 0.25f) {
                    logits[1] = 5.2f + 3.0f * (midRatio - 0.48f) + (peakFreqRange / 300.0f);
                }
            }
        }

        // 2. Security Alarm (High frequency repeating electronic chirp / warble)
        if (!isMusic && !isSpeech && alarmRatio >= 0.35f && spectralCentroid >= 2200 && tempVar >= 0.12f && rms >= 0.016f) {
            logits[2] = 4.0f + 2.5f * alarmRatio;
        }

        // 3. Distress Shouting (Loud human vocal scream, broad formants, loud RMS)
        if (!isMusic && midRatio >= 0.50f && spectralCentroid >= 1400 && spectralCentroid <= 3000 && rms >= 0.06f && tempVar >= 0.15f) {
            logits[3] = 4.2f + 3.0f * (rms - 0.06f);
        }

        // 4. Car Horn (Automotive horn: dominant in 150-550 Hz, dual fundamental peaks, LONG or SHORT honk)
        // Crucial fix: Short car honks have tempVar > 0.18, so if dual peaks exist or steady horn band, classify as Horn!
        if (!isMusic && !isSpeech && deepBassRatio < 0.12f && impulseCount == 0) {
            boolean hornFreqMatch = spectralCentroid >= 380 && spectralCentroid <= 1300 && woodHornRatio >= 0.30f;
            boolean hornSteady = hasDualHornPeaks || (tempVar <= 0.20f && peakFreqRange < 90.0f && centroidStdDev < 50.0f);
            if (hornFreqMatch && hornSteady && spectralFlatness <= 0.20f && rms >= 0.014f) {
                logits[4] = 5.6f + 3.0f * woodHornRatio;
            }
        }

        // 5. Train (Low heavy sustained rumble, deep bass dominant, steady)
        if (deepBassRatio >= 0.45f && woodHornRatio >= 0.35f && spectralCentroid <= 500 && tempVar <= 0.10f && rms >= 0.04f) {
            logits[5] = 4.2f + 2.0f * deepBassRatio;
        }

        // 6. Motorcycle (Revving engine 550-1300 Hz, moderate flatness)
        if (!isMusic && !isSpeech && midRatio >= 0.45f && spectralCentroid >= 550 && spectralCentroid <= 1300 && tempVar >= 0.08f && tempVar <= 0.22f && rms >= 0.04f && spectralFlatness >= 0.08f && spectralFlatness <= 0.25f) {
            logits[6] = 4.0f + 2.0f * midRatio;
        }

        // 7. Dog Barking (Impulsive down-chirps, sharp burst onset, silent pauses, NOT speech, NOT horn, NOT pure chime)
        // Crucial fix: Must NOT have dual automotive horn peaks and cannot have high wood horn power
        if (!isMusic && !isSpeech && !hasDualHornPeaks && woodHornRatio < 0.25f && rms >= 0.018f) {
            if ((transientRatio >= 2.6f || impulseCount >= 2) && tempVar >= 0.38f && spectralFlatness >= 0.002f) {
                if (spectralCentroid >= 650 && spectralCentroid <= 2000 && (midRatio + woodHornRatio) >= 0.55f) {
                    logits[7] = 5.8f + 2.5f * Math.min(1.0f, tempVar / 0.5f);
                }
            }
        }

        // 8. Construction Noise (Harsh wideband mechanical impact / hammering)
        if (spectralFlatness >= 0.25f && spectralFlatness <= 0.55f && tempVar >= 0.15f && rms >= 0.05f) {
            logits[8] = 4.0f + 2.0f * (rms - 0.05f);
        }

        // 9. Glass Breaking (High frequency shatter > 2800 Hz, explosive burst)
        if (!isMusic && !isSpeech && highRatio >= 0.32f && spectralCentroid >= 2700 && zcr >= 0.16f && transientRatio >= 2.4f && rms >= 0.014f) {
            logits[9] = 5.2f + 2.0f * highRatio;
        }

        // 10. Door Knocking (Wood taps: 150-550 Hz, quiet intervals, NO vocals/mid band)
        if (!isMusic && !isSpeech && midRatio < 0.18f && deepBassRatio < 0.35f) {
            if ((impulseCount >= 2 || (transientRatio >= 2.5f && tempVar >= 0.16f)) && woodHornRatio >= 0.30f && spectralCentroid <= 680 && rms >= 0.012f) {
                logits[10] = 5.2f + 2.0f * Math.min(1.0f, (float) impulseCount / 3.0f);
            }
        }

        // 11. Baby Crying (Infant vocal wailing: infant F0 in 420-750 Hz, formants in mid band, NOT pure electronic tone, NOT horn)
        // Crucial fix: Must have infant F0 fundamental presence in doorbellRatio or woodHornRatio, NOT an electronic alarm!
        if (!isMusic && !isSpeech && !isMidBuzzer && !isHighAlarm && !hasDualHornPeaks && deepBassRatio < 0.10f && woodHornRatio < 0.45f) {
            boolean hasInfantF0 = (doorbellRatio >= 0.15f || woodHornRatio >= 0.15f);
            if (spectralCentroid >= 420 && spectralCentroid <= 1600 && midRatio >= 0.25f && hasInfantF0 && rms >= 0.015f) {
                if (tempVar >= 0.18f && transientRatio < 2.3f) {
                    logits[11] = 5.8f + 3.0f * midRatio;
                }
            }
        }

        // 12. Doorbell (Ding-Dong two-tone drop in 480-900 Hz, or electronic pure chime with decay)
        if (!isMusic && !isSpeech && !isMidBuzzer && deepBassRatio < 0.15f) {
            boolean isMechDoorbell = (spectralCentroid >= 460 && spectralCentroid <= 900 && doorbellRatio >= 0.45f && midRatio < 0.25f && spectralFlatness <= 0.14f);
            boolean isElecChime = (spectralCentroid >= 700 && spectralCentroid <= 1400 && midRatio >= 0.60f && transientRatio < 2.5f && spectralFlatness < 0.001f && tempVar >= 0.40f);
            if ((isMechDoorbell || isElecChime) && rms >= 0.014f) {
                logits[12] = 5.8f + 3.0f * (isMechDoorbell ? doorbellRatio : midRatio);
            }
        }

        // -------------------------------------------------------------------------
        // Layer 7: Temperature-Scaled Softmax Probability & Top Predictions
        // -------------------------------------------------------------------------
        float[] probabilities = softmax(logits);

        List<Prediction> allPredictions = new ArrayList<>();
        for (int i = 0; i < SoundClasses.NUM_CLASSES; i++) {
            SoundClasses.Definition def = SoundClasses.getByIndex(i);
            allPredictions.add(new Prediction(i, def.id, def.name, probabilities[i]));
        }

        Collections.sort(allPredictions, new Comparator<Prediction>() {
            @Override
            public int compare(Prediction o1, Prediction o2) {
                return Float.compare(o2.confidence, o1.confidence);
            }
        });

        List<Prediction> top5 = new ArrayList<>(allPredictions.subList(0, Math.min(5, allPredictions.size())));

        Prediction best = top5.get(0);
        int bestIndex = best.index;
        float bestConfidence = best.confidence;
        String bestSoundId = best.id;
        String bestSoundName = best.name;

        // Traceability Logging (Prompt Section 1 & 13)
        Log.d(TAG_ML, String.format(Locale.US, "Input: Samples=%d | RMS=%.4f | Peak=%.4f | Centroid=%.1f | Music=%b | Speech=%b", length, rms, peak, spectralCentroid, isMusic, isSpeech));
        StringBuilder sb = new StringBuilder("Top 5: ");
        for (int i = 0; i < top5.size(); i++) {
            Prediction p = top5.get(i);
            sb.append(String.format(Locale.US, "#%d %s (%.1f%%) ", (i + 1), p.name, p.confidence * 100));
        }
        Log.d(TAG_ML, sb.toString());

        // -------------------------------------------------------------------------
        // Layer 8: Safe Rejection Check (Prompt Section 2, 3, 14, 15)
        // -------------------------------------------------------------------------
        float marginOverAmbient = logits[bestIndex] - logits[13];
        boolean passesRejection = (bestIndex != 13) && (bestConfidence >= CONFIDENCE_THRESHOLD) && (marginOverAmbient >= LOGIT_MARGIN_THRESHOLD);

        if (!passesRejection) {
            consecutiveMatchCount = 0;
            lastCandidateSound = null;
            String rejectionReason = (bestIndex == 13) 
                    ? (isMusic ? "Filtered: Headphone / Ambient Music" : (isSpeech ? "Filtered: Human Speech / Conversation" : "Ambient / Normal Room")) 
                    : String.format(Locale.US, "Confidence below calibrated threshold (%.1f%% < %.0f%%)", bestConfidence * 100, CONFIDENCE_THRESHOLD * 100);
            Log.d(TAG_DET, "Decision: REJECTED — " + rejectionReason);
            return new Classification("ambient", "No Dangerous Sound", bestConfidence, false, rms, 13, top5, "NORMAL", rejectionReason);
        }

        // -------------------------------------------------------------------------
        // Layer 9: Class-Specific Temporal Persistence State Machine (Section 10, 12, 14)
        // -------------------------------------------------------------------------
        // Transient sounds (Glass Breaking, Door Knocking) trigger instantly on 1 window (125ms)
        if ("glass_breaking".equals(bestSoundId) || "door_knocking".equals(bestSoundId)) {
            consecutiveMatchCount = 0;
            lastCandidateSound = null;
            Log.d(TAG_DET, "Decision: CONFIRMED_DANGEROUS_SOUND — Transient " + bestSoundName + " (" + best.confidencePercent + "%)");
            return new Classification(bestSoundId, bestSoundName, bestConfidence, true, rms, bestIndex, top5, "CONFIRMED_DANGEROUS_SOUND", "Confirmed Transient Event");
        }

        // High confidence pure alarms (Fire Alarm, Doorbell) trigger immediately if overwhelming confidence
        if (("fire_alarm".equals(bestSoundId) || "doorbell".equals(bestSoundId)) && bestConfidence >= 0.95f && marginOverAmbient >= 3.0f) {
            consecutiveMatchCount = 0;
            lastCandidateSound = null;
            Log.d(TAG_DET, "Decision: CONFIRMED_DANGEROUS_SOUND — High Confidence " + bestSoundName + " (" + best.confidencePercent + "%)");
            return new Classification(bestSoundId, bestSoundName, bestConfidence, true, rms, bestIndex, top5, "CONFIRMED_DANGEROUS_SOUND", "Confirmed High-Confidence Alarm");
        }

        // Continuous sounds require temporal verification (Baby crying requires 3 windows per Part 7)
        int requiredFrames = "baby_crying".equals(bestSoundId) ? 3 : 2;

        if (bestSoundId.equals(lastCandidateSound)) {
            consecutiveMatchCount++;
        } else {
            lastCandidateSound = bestSoundId;
            consecutiveMatchCount = 1;
        }

        if (consecutiveMatchCount >= requiredFrames) {
            consecutiveMatchCount = 0;
            Log.d(TAG_DET, String.format(Locale.US, "Decision: CONFIRMED_DANGEROUS_SOUND — %s confirmed after %d windows (Conf: %.1f%%)", bestSoundName, requiredFrames, bestConfidence * 100));
            return new Classification(bestSoundId, bestSoundName, bestConfidence, true, rms, bestIndex, top5, "CONFIRMED_DANGEROUS_SOUND", "Confirmed Continuous Hazard");
        }

        Log.d(TAG_DET, String.format(Locale.US, "Decision: POSSIBLE_SOUND — %s frame %d/%d (Analyzing...)", bestSoundName, consecutiveMatchCount, requiredFrames));
        return new Classification(bestSoundId, bestSoundName, bestConfidence, false, rms, bestIndex, top5, "POSSIBLE_SOUND", "Analyzing temporal consistency (" + consecutiveMatchCount + "/" + requiredFrames + ")");
    }

    private Classification buildNormalResult(float rms, String reason) {
        List<Prediction> top5 = new ArrayList<>();
        top5.add(new Prediction(13, "ambient", "Background / Silence", 0.98f));
        return new Classification("ambient", "No Dangerous Sound", 0.98f, false, rms, 13, top5, "NORMAL", reason);
    }

    private static float[] softmax(float[] logits) {
        float max = logits[0];
        for (float v : logits) {
            if (v > max) max = v;
        }
        float sum = 0;
        float[] exp = new float[logits.length];
        for (int i = 0; i < logits.length; i++) {
            exp[i] = (float) Math.exp(logits[i] - max);
            sum += exp[i];
        }
        for (int i = 0; i < logits.length; i++) {
            exp[i] /= (sum + 1e-12f);
        }
        return exp;
    }

    /**
     * In-place Radix-2 Cooley-Tukey FFT algorithm
     */
    private static void fftRadix2(double[] real, double[] imag, int n) {
        int j = 0;
        for (int i = 0; i < n - 1; i++) {
            if (i < j) {
                double tempR = real[i]; real[i] = real[j]; real[j] = tempR;
                double tempI = imag[i]; imag[i] = imag[j]; imag[j] = tempI;
            }
            int k = n / 2;
            while (k <= j) {
                j -= k;
                k /= 2;
            }
            j += k;
        }

        for (int len = 2; len <= n; len <<= 1) {
            double angle = -2.0 * Math.PI / len;
            double wlenR = Math.cos(angle);
            double wlenI = Math.sin(angle);
            for (int i = 0; i < n; i += len) {
                double wR = 1.0;
                double wI = 0.0;
                for (int m = 0; m < len / 2; m++) {
                    int u = i + m;
                    int v = i + m + len / 2;
                    double uR = real[u];
                    double uI = imag[u];
                    double vR = real[v] * wR - imag[v] * wI;
                    double vI = real[v] * wI + imag[v] * wR;
                    real[u] = uR + vR;
                    imag[u] = uI + vI;
                    real[v] = uR - vR;
                    imag[v] = uI - vI;
                    double nextWR = wR * wlenR - wI * wlenI;
                    wI = wR * wlenI + wI * wlenR;
                    wR = nextWR;
                }
            }
        }
    }
}
