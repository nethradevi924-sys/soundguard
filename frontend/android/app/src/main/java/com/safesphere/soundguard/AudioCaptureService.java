package com.safesphere.soundguard;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Process;
import android.util.Log;

import androidx.core.content.ContextCompat;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * SoundGuard - Real-time Streaming Audio Capture & Low-Latency Inference Pipeline
 * 
 * Features:
 * - 16,000 Hz, Mono, 16-bit PCM continuous capture
 * - Rolling circular ring buffer
 * - 1.0 second analysis window with 0.25 second (250 ms) hop size (4 inferences / second)
 * - Completely off-UI thread background inference via dedicated ExecutorService
 * - Comprehensive latency instrumentation (Capture, DSP/Feature, Inference, Total)
 * - Telemetry listener providing live decibels, prediction, latency, and Top 5 breakdown
 * - Feedback loop suppression during TextToSpeech output
 */
public class AudioCaptureService {

    private static final String TAG_AUDIO = "SoundGuard-Audio";
    private static final String TAG_ML = "SoundGuard-ML";

    public static final int SAMPLE_RATE = 16000;
    public static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    public static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    public static final int WINDOW_SIZE = 16000; // 1.0 second analysis window
    public static final int HOP_SIZE = 2000;     // 0.125 second (125 ms) hop size for near-instantaneous detection (8 inferences/sec)

    public interface TelemetryListener {
        void onTelemetry(int db, String prediction, int confidencePercent, float latencyMs, List<SoundClassifier.Prediction> top5);
    }

    public interface SampleSink {
        void onSamples(short[] samples, int count);
    }

    private final Context context;
    private final AlertManager alertManager;
    private final SoundClassifier classifier;
    private final ExecutorService inferenceExecutor = Executors.newSingleThreadExecutor();

    private AudioRecord audioRecord;
    private Thread recordingThread;
    private volatile boolean isRunning = false;
    private TelemetryListener telemetryListener;
    private volatile SampleSink sampleSink;

    // Rolling Ring Buffer (32,000 samples capacity)
    private final short[] ringBuffer = new short[32000];
    private int ringWriteHead = 0;
    private int totalSamplesWritten = 0;
    private int samplesSinceLastInference = 0;

    public AudioCaptureService(Context context) {
        this.context = context.getApplicationContext();
        this.alertManager = AlertManager.getInstance(context);
        // Load model ONCE during service creation (Part 12)
        this.classifier = new SoundClassifier();
    }

    public void setTelemetryListener(TelemetryListener listener) {
        this.telemetryListener = listener;
    }

    public void setSampleSink(SampleSink sink) {
        this.sampleSink = sink;
    }

    public boolean hasMicrophonePermission() {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    public synchronized boolean start() {
        if (isRunning) {
            Log.w(TAG_AUDIO, "Audio capture is already running");
            return true;
        }

        if (!hasMicrophonePermission()) {
            Log.e(TAG_AUDIO, "Cannot start AudioRecord: RECORD_AUDIO permission not granted");
            return false;
        }

        Log.d(TAG_AUDIO, "Microphone permission = GRANTED");
        Log.d(TAG_AUDIO, "Starting audio capture...");

        int minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
        int bufferSize = Math.max(minBufferSize * 2, 4096);

        try {
            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG_AUDIO, "AudioRecord initialization failed. State=" + audioRecord.getState());
                audioRecord.release();
                audioRecord = null;
                return false;
            }

            audioRecord.startRecording();
            isRunning = true;
            ringWriteHead = 0;
            totalSamplesWritten = 0;
            samplesSinceLastInference = 0;

            // Log detailed configuration required by Prompt Section 1, 4, 15
            Log.d(TAG_AUDIO, "Audio source = MediaRecorder.AudioSource.MIC (Physical Microphone Input)");
            Log.d(TAG_AUDIO, "Sample rate = " + SAMPLE_RATE + " Hz");
            Log.d(TAG_AUDIO, "Channel configuration = CHANNEL_IN_MONO");
            Log.d(TAG_AUDIO, "Encoding = ENCODING_PCM_16BIT");
            Log.d(TAG_AUDIO, "Input device ID = " + getActiveInputDeviceId());
            Log.d(TAG_AUDIO, "Input device name = " + getActiveInputDeviceDescription());
            Log.d(TAG_AUDIO, "AudioPlaybackCapture = DISABLED (Environmental Audio only, NO media playback captured)");
            Log.d(TAG_AUDIO, "Recording state = RECORDSTATE_RECORDING");

            recordingThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    captureLoop();
                }
            }, "SoundGuard-AudioRecordThread");
            recordingThread.start();
            return true;

        } catch (SecurityException se) {
            Log.e(TAG_AUDIO, "SecurityException starting AudioRecord", se);
            return false;
        } catch (Exception e) {
            Log.e(TAG_AUDIO, "Exception starting AudioRecord", e);
            return false;
        }
    }

    private void captureLoop() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);

        // 1024 shorts chunk (64 ms per read) for responsive buffer ingestion
        short[] readBuffer = new short[1024];
        long lastSignalLogTime = 0;

        Log.d(TAG_AUDIO, "Continuous audio streaming loop started");

        while (isRunning && audioRecord != null) {
            int readSamples = audioRecord.read(readBuffer, 0, readBuffer.length);

            if (readSamples > 0) {
                if (sampleSink != null) {
                    sampleSink.onSamples(readBuffer, readSamples);
                }
                // Compute RMS & Peak for current chunk
                double sumSq = 0;
                int peakVal = 0;
                for (int i = 0; i < readSamples; i++) {
                    short s = readBuffer[i];
                    sumSq += (double) s * s;
                    int abs = Math.abs(s);
                    if (abs > peakVal) peakVal = abs;
                }
                float chunkRms = (float) Math.sqrt(sumSq / readSamples) / 32768.0f;
                float peak = peakVal / 32768.0f;
                float dbfs = peak > 1e-5f ? (float) (20.0 * Math.log10(peak)) : -96.0f;
                final int db = chunkRms > 0.0001f ? Math.min(110, Math.max(30, (int) (20 * Math.log10(chunkRms * 32768.0f) + 20))) : 30;

                long now = System.currentTimeMillis();
                if (now - lastSignalLogTime >= 1000) {
                    lastSignalLogTime = now;
                    Log.d(TAG_AUDIO, String.format(Locale.US, "Samples received = %d | RMS = %.4f | Peak = %.4f | dBFS = %.1f dB", readSamples, chunkRms, peak, dbfs));
                }

                // Prevent feedback from SoundGuard's own TextToSpeech output
                if (alertManager.getVoiceAlertManager().isSpeakingOrRecent()) {
                    ringWriteHead = 0;
                    totalSamplesWritten = 0;
                    samplesSinceLastInference = 0;
                    continue;
                }

                // Write into circular ring buffer
                for (int i = 0; i < readSamples; i++) {
                    ringBuffer[ringWriteHead] = readBuffer[i];
                    ringWriteHead = (ringWriteHead + 1) % ringBuffer.length;
                }
                totalSamplesWritten += readSamples;
                samplesSinceLastInference += readSamples;

                // When at least 1.0 second of audio has been accumulated and hop size (250ms) has passed:
                if (totalSamplesWritten >= WINDOW_SIZE && samplesSinceLastInference >= HOP_SIZE) {
                    samplesSinceLastInference = 0;

                    // Extract the last WINDOW_SIZE (16000) samples in correct chronological order
                    final short[] analysisWindow = new short[WINDOW_SIZE];
                    int readPtr = (ringWriteHead - WINDOW_SIZE + ringBuffer.length) % ringBuffer.length;
                    for (int i = 0; i < WINDOW_SIZE; i++) {
                        analysisWindow[i] = ringBuffer[readPtr];
                        readPtr = (readPtr + 1) % ringBuffer.length;
                    }

                    // Dispatch to background inference executor (Off UI thread - Part 10)
                    final long t1CaptureNs = System.nanoTime();
                    inferenceExecutor.execute(new Runnable() {
                        @Override
                        public void run() {
                            long t2StartNs = System.nanoTime();
                            SoundClassifier.Classification result = classifier.classify(analysisWindow, WINDOW_SIZE);
                            long t3InferenceNs = System.nanoTime();

                            // Trigger alert pipeline if confirmed danger
                            if (result.isDanger) {
                                alertManager.triggerAlert(result.soundId, result.confidence, "Microphone");
                            }
                            long t4AlertNs = System.nanoTime();

                            float queueLatencyMs = (t2StartNs - t1CaptureNs) / 1_000_000.0f;
                            float inferenceLatencyMs = (t3InferenceNs - t2StartNs) / 1_000_000.0f;
                            float alertDispatchMs = (t4AlertNs - t3InferenceNs) / 1_000_000.0f;
                            float totalPipelineLatencyMs = (t4AlertNs - t1CaptureNs) / 1_000_000.0f;

                            // Log detailed latency instrumentation (Section 11, 13)
                            Log.d(TAG_ML, String.format(Locale.US, 
                                "Latency: Queue=%.2f ms | Feature+Inference=%.2f ms | Dispatch=%.2f ms | Total=%.2f ms", 
                                queueLatencyMs, inferenceLatencyMs, alertDispatchMs, totalPipelineLatencyMs));

                            // Notify telemetry listener for Developer/Debug Mode (Part 17)
                            if (telemetryListener != null) {
                                telemetryListener.onTelemetry(db, result.soundName, result.confidencePercent, inferenceLatencyMs, result.topPredictions);
                            }
                        }
                    });
                }

            } else if (readSamples == AudioRecord.ERROR_INVALID_OPERATION) {
                Log.e(TAG_AUDIO, "AudioRecord error: ERROR_INVALID_OPERATION");
                break;
            } else if (readSamples == AudioRecord.ERROR_BAD_VALUE) {
                Log.e(TAG_AUDIO, "AudioRecord error: ERROR_BAD_VALUE");
                break;
            }
        }

        Log.d(TAG_AUDIO, "Audio capture loop ended");
    }

    public synchronized void stop() {
        if (!isRunning) return;
        isRunning = false;

        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG_AUDIO, "Error stopping AudioRecord", e);
            }
            audioRecord = null;
        }

        if (recordingThread != null) {
            try {
                recordingThread.interrupt();
            } catch (Exception ignored) {}
            recordingThread = null;
        }

        Log.d(TAG_AUDIO, "Audio capture stopped cleanly and microphone released");
    }

    public boolean isRunning() {
        return isRunning;
    }

    public SoundClassifier getClassifier() {
        return classifier;
    }

    private int getActiveInputDeviceId() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioRecord != null) {
            AudioDeviceInfo dev = audioRecord.getRoutedDevice();
            if (dev != null) {
                return dev.getId();
            }
        }
        return 0;
    }

    private String getActiveInputDeviceDescription() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioRecord != null) {
            AudioDeviceInfo dev = audioRecord.getRoutedDevice();
            if (dev != null) {
                return dev.getProductName() + " (" + getDeviceTypeName(dev.getType()) + ")";
            }
        }

        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && am != null) {
            AudioDeviceInfo[] devices = am.getDevices(AudioManager.GET_DEVICES_INPUTS);
            if (devices != null && devices.length > 0) {
                return devices[0].getProductName() + " (" + getDeviceTypeName(devices[0].getType()) + ")";
            }
        }

        return "Built-in Microphone";
    }

    private String getDeviceTypeName(int type) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            switch (type) {
                case AudioDeviceInfo.TYPE_BUILTIN_MIC:
                    return "Phone Microphone";
                case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                    return "Wired Headset Microphone";
                case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                    return "Bluetooth Headset Microphone";
                case AudioDeviceInfo.TYPE_USB_DEVICE:
                case AudioDeviceInfo.TYPE_USB_HEADSET:
                    return "USB Microphone";
                default:
                    return "External Audio Device " + type;
            }
        }
        return "Microphone";
    }

    /**
     * Standalone direct recording helper for Record & Test Mode (e.g. 3000ms at 16kHz Mono).
     */
    public static short[] recordDirect(int durationMs) {
        int sampleRate = SAMPLE_RATE;
        int totalSamples = (sampleRate * durationMs) / 1000;
        short[] buffer = new short[totalSamples];
        int minBufferSize = AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT);
        AudioRecord ar = null;
        try {
            ar = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    Math.max(minBufferSize * 2, 4096)
            );
            if (ar.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG_AUDIO, "recordDirect: AudioRecord not initialized");
                return null;
            }

            ar.startRecording();
            int readTotal = 0;
            short[] temp = new short[1024];
            while (readTotal < totalSamples) {
                int toRead = Math.min(temp.length, totalSamples - readTotal);
                int read = ar.read(temp, 0, toRead);
                if (read > 0) {
                    System.arraycopy(temp, 0, buffer, readTotal, read);
                    readTotal += read;
                } else {
                    break;
                }
            }
        } catch (Exception e) {
            Log.e(TAG_AUDIO, "Error during recordDirect", e);
            return null;
        } finally {
            if (ar != null) {
                try {
                    if (ar.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                        ar.stop();
                    }
                    ar.release();
                } catch (Exception ignored) {}
            }
        }
        return buffer;
    }
}
