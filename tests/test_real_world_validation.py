"""SoundGuard - Offline Acoustic Validation Suite & Confusion Matrix Generator.

Tests the complete feature extraction and acoustic discrimination pipeline against
12 distinct acoustic categories:
Hazards:
1. Car Horn
2. Siren
3. Baby Crying
4. Door Knocking
5. Glass Breaking
6. Doorbell
7. Fire Alarm

Hard Negatives / Background:
8. Music (headphone leakage / beat + vocals)
9. Speech (human talking)
10. Room Silence (ambient noise floor)
11. Fan Hiss (stationary wideband noise)
12. Keyboard Typing (sharp office clicks)
"""

import numpy as np
from typing import Dict, Any, Tuple, List

CLASSES = [
    "fire_alarm", "siren", "security_alarm", "distress_shouting",
    "car_horn", "train", "motorcycle", "dog_barking",
    "construction_noise", "glass_breaking", "door_knocking",
    "baby_crying", "doorbell", "ambient"
]

def generate_test_audio(category: str, duration_sec: float = 1.0, sr: int = 16000) -> np.ndarray:
    """Synthesizes high-fidelity realistic test audio for each acoustic profile."""
    n_samples = int(duration_sec * sr)
    t = np.linspace(0, duration_sec, n_samples, endpoint=False)
    wave = np.zeros(n_samples, dtype=np.float32)

    if category == "car_horn":
        # Dual-tone horn (415 Hz + 495 Hz) + phone mic harmonic emphasis (830 Hz, 990 Hz)
        # Steady pitch, minimal sub-bass (<150Hz), constant envelope
        f1, f2 = 415.0, 495.0
        wave = (0.5 * np.sin(2 * np.pi * f1 * t) + 
                0.5 * np.sin(2 * np.pi * f2 * t) + 
                0.4 * np.sin(2 * np.pi * 2 * f1 * t) + 
                0.4 * np.sin(2 * np.pi * 2 * f2 * t) +
                0.15 * np.sin(2 * np.pi * 3 * f1 * t))
        # Small ramp at edges
        ramp = int(0.03 * sr)
        wave[:ramp] *= np.linspace(0, 1, ramp)
        wave[-ramp:] *= np.linspace(1, 0, ramp)

    elif category == "siren":
        # Continuous periodic frequency-modulated wail between 750 Hz and 1450 Hz
        # Large frequency trajectory delta (>400Hz sweep)
        wail_rate = 1.2 # 1.2 Hz wail cycle
        instant_freq = 1100.0 + 350.0 * np.sin(2 * np.pi * wail_rate * t)
        phase = 2 * np.pi * np.cumsum(instant_freq) / sr
        wave = 0.8 * np.sin(phase) + 0.2 * np.sin(2 * phase)

    elif category == "baby_crying":
        # Infant vocal wailing: F0 ~ 500 Hz with 5 Hz vocal flutter + formants at 1500 Hz and 2500 Hz
        flutter = 35.0 * np.sin(2 * np.pi * 5.0 * t)
        f0 = 520.0 + flutter
        phase0 = 2 * np.pi * np.cumsum(f0) / sr
        # Expiratory cry burst with cadence
        burst_env = np.maximum(0.1, np.sin(np.pi * t / duration_sec)) ** 1.2
        wave = (0.6 * np.sin(phase0) + 
                0.4 * np.sin(2 * phase0) + 
                0.35 * np.sin(3 * phase0) + 
                0.2 * np.sin(5 * phase0)) * burst_env

    elif category == "door_knocking":
        # 3 distinct wood impact taps at 0.15s, 0.45s, 0.75s
        # Wood resonance (180 Hz) + sharp high-frequency onset click, fast decay (<70ms), quiet between taps
        for tap_t in [0.15, 0.45, 0.75]:
            idx = int(tap_t * sr)
            dur = int(0.07 * sr)
            if idx + dur <= n_samples:
                t_k = np.linspace(0, 0.07, dur)
                # Knuckle click (noise burst) + wood cavity decay (180 Hz)
                click = 0.4 * np.random.randn(dur).astype(np.float32) * np.exp(-120 * t_k)
                wood = 0.9 * np.sin(2 * np.pi * 180 * t_k) * np.exp(-45 * t_k)
                wave[idx:idx + dur] += (wood + click)

    elif category == "glass_breaking":
        # Explosive high-frequency shatter (>3000 Hz) with exponential decay and ringing shards
        noise = np.random.randn(n_samples).astype(np.float32) * np.exp(-10 * t)
        ring = (np.sin(2 * np.pi * 4400 * t) * np.exp(-12 * t) + 
                np.sin(2 * np.pi * 6200 * t) * np.exp(-18 * t))
        wave = 0.6 * noise + 0.4 * ring

    elif category == "doorbell":
        # Ding-Dong chime: Ding at 660 Hz for 0.4s, then step down to Dong at 520 Hz
        split = int(0.40 * sr)
        t1 = t[:split]
        t2 = t[split:] - 0.40
        wave[:split] = np.sin(2 * np.pi * 660 * t1) * np.exp(-3.5 * t1)
        wave[split:] = np.sin(2 * np.pi * 520 * t2) * np.exp(-3.0 * t2)

    elif category == "fire_alarm":
        # T-3 repeating pattern: 3 pulses in 2800-3400 Hz range
        carrier = np.sin(2 * np.pi * 3100 * t)
        for pulse_t in [0.08, 0.38, 0.68]:
            idx = int(pulse_t * sr)
            dur = int(0.20 * sr)
            if idx + dur <= n_samples:
                wave[idx:idx + dur] = carrier[idx:idx + dur]

    elif category == "dog_barking":
        # Impulsive vocal down-chirp (1200 Hz down to 500 Hz), explosive attack, quiet intervals
        for bt in [0.2, 0.65]:
            b_idx = int(bt * sr)
            b_len = int(0.18 * sr)
            if b_idx + b_len <= n_samples:
                t_b = np.linspace(0, 0.18, b_len)
                f_b = 1200.0 - 3800.0 * t_b
                p_b = 2 * np.pi * np.cumsum(f_b) / sr
                env = np.exp(-18 * t_b) # explosive attack, exponential decay
                wave[b_idx:b_idx+b_len] += (np.sin(p_b) + 0.35 * np.sin(2 * p_b)) * env

    elif category == "music":
        # CRITICAL TEST: Music with kick drum (sub-bass 60 Hz), bassline (120 Hz), and vocals (1200 Hz)
        # Simultaneously contains high sub-bass AND melodic mid-band!
        kick_t = np.linspace(0, 0.15, int(0.15 * sr))
        kick = np.sin(2 * np.pi * 65 * kick_t) * np.exp(-15 * kick_t)
        # Add 2 kick drum hits (at 0.1s and 0.6s)
        for kt in [0.1, 0.6]:
            idx = int(kt * sr)
            if idx + len(kick) <= n_samples:
                wave[idx:idx + len(kick)] += 0.8 * kick
        # Continuous bassline
        wave += 0.4 * np.sin(2 * np.pi * 110 * t)
        # Continuous vocal melody (1100 Hz, with vibrato)
        vocal_freq = 1100 + 20 * np.sin(2 * np.pi * 6 * t)
        wave += 0.35 * np.sin(2 * np.pi * np.cumsum(vocal_freq) / sr)
        # Snare / cymbal wideband rhythm
        wave += 0.15 * np.random.randn(n_samples).astype(np.float32) * (np.sin(2 * np.pi * 2 * t) ** 2)

    elif category == "speech":
        # Human conversational speech: vocal formants (F0 ~ 150 Hz, F1 500 Hz, F2 1400 Hz), smooth envelope
        speech_f0 = 150 + 40 * np.sin(2 * np.pi * 2.5 * t)
        p = 2 * np.pi * np.cumsum(speech_f0) / sr
        # Formants
        wave = (0.5 * np.sin(p) + 
                0.4 * np.sin(3 * p) + 
                0.3 * np.sin(7 * p) +
                0.15 * np.sin(11 * p)) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.5 * t))

    elif category == "room_silence":
        # Room ambient noise floor: very low RMS (<0.012)
        wave = 0.008 * np.random.randn(n_samples).astype(np.float32)

    elif category == "fan_hiss":
        # Flat stationary noise (air conditioner / fan): moderate RMS, high spectral flatness
        wave = 0.035 * np.random.randn(n_samples).astype(np.float32)

    elif category == "keyboard_typing":
        # Fast plastic clicks on desk: short high-frequency spikes at low volume
        for key_t in [0.12, 0.35, 0.58, 0.82]:
            idx = int(key_t * sr)
            dur = int(0.025 * sr)
            if idx + dur <= n_samples:
                t_k = np.linspace(0, 0.025, dur)
                wave[idx:idx + dur] += 0.3 * np.random.randn(dur).astype(np.float32) * np.exp(-120 * t_k)

    elif category == "car_horn_short":
        # Short car horn tap (300ms) with dual fundamental tones (415 Hz + 495 Hz) + harmonics
        idx1, idx2 = int(0.25 * sr), int(0.55 * sr)
        t_h = t[idx1:idx2]
        wave[idx1:idx2] = (0.5 * np.sin(2 * np.pi * 415 * t_h) + 
                           0.5 * np.sin(2 * np.pi * 495 * t_h) + 
                           0.35 * np.sin(2 * np.pi * 830 * t_h) + 
                           0.35 * np.sin(2 * np.pi * 990 * t_h))

    elif category == "fire_alarm_buzzer":
        # 1200 Hz pulsed piezoelectric buzzer alarm (beep - silence - beep)
        for pt in [0.1, 0.6]:
            idx = int(pt * sr)
            dur = int(0.25 * sr)
            wave[idx:idx+dur] = np.sin(2 * np.pi * 1200 * t[idx:idx+dur])

    elif category == "doorbell_electronic":
        # Electronic digital chime: 2 short pleasant chimes at 880 Hz and 1175 Hz with decay
        for ct, f_c in [(0.15, 880.0), (0.45, 1175.0)]:
            idx = int(ct * sr)
            dur = int(0.35 * sr)
            if idx + dur <= n_samples:
                t_c = np.linspace(0, 0.35, dur)
                wave[idx:idx+dur] += np.sin(2 * np.pi * f_c * t_c) * np.exp(-6.0 * t_c)

    # Normalize to realistic peak levels
    if category != "room_silence":
        peak = np.max(np.abs(wave))
        if peak > 0:
            target_peak = 0.70 if category in ["car_horn", "car_horn_short", "siren", "fire_alarm", "fire_alarm_buzzer", "glass_breaking"] else 0.50
            wave = wave / peak * target_peak

    return wave.astype(np.float32)


def extract_features(audio: np.ndarray, sr: int = 16000) -> Dict[str, Any]:
    """Pure Python equivalent of SoundClassifier.java feature extraction."""
    length = len(audio)
    # 1. DC removal
    audio = audio - np.mean(audio)
    rms = float(np.sqrt(np.mean(audio ** 2)))
    zero_crossings = np.sum(np.diff(audio >= 0) != 0)
    zcr = float(zero_crossings / length)

    # 2. Sub-window transient analysis (8 sub-windows)
    num_sub = 8
    sub_len = length // num_sub
    sub_rms = []
    for s in range(num_sub):
        chunk = audio[s * sub_len : (s + 1) * sub_len]
        sub_rms.append(float(np.sqrt(np.mean(chunk ** 2))))
    sub_rms = np.array(sub_rms)
    max_sub = np.max(sub_rms)
    min_sub = np.min(sub_rms)
    avg_sub = np.mean(sub_rms)
    transient_ratio = float(max_sub / (avg_sub + 1e-6))
    temp_var = float((max_sub - min_sub) / (max_sub + 1e-6))

    # Impulse count for knocking & barking
    impulse_count = 0
    for s in range(1, num_sub - 1):
        if sub_rms[s] > 0.015 and sub_rms[s] > 1.8 * sub_rms[s-1] and sub_rms[s] > 1.5 * sub_rms[s+1]:
            impulse_count += 1

    # 3. FFT Power Spectrum & Sub-frame Centroid / Peak Frequency Tracking
    fft_size = 512
    num_bins = fft_size // 2
    num_windows = min(8, length // fft_size)
    power_spectrum = np.zeros(num_bins, dtype=np.float32)
    window_centroids = []
    window_peak_freqs = []
    bin_width = (sr / 2.0) / num_bins # 31.25 Hz

    hanning = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(fft_size) / (fft_size - 1)))

    for w in range(num_windows):
        offset = w * (length // num_windows)
        if offset + fft_size > length:
            offset = length - fft_size
        chunk = audio[offset : offset + fft_size] * hanning
        spec = np.fft.rfft(chunk, n=fft_size)[:-1] # 256 bins
        p = np.abs(spec) ** 2
        power_spectrum += p
        p_sum = np.sum(p)
        if p_sum > 1e-4:
            freqs = np.arange(num_bins) * bin_width
            centroid_w = np.sum(freqs * p) / (p_sum + 1e-12)
            peak_bin = np.argmax(p)
            window_centroids.append(centroid_w)
            window_peak_freqs.append(peak_bin * bin_width)

    power_spectrum /= num_windows

    # Trajectory sweep metrics across active sound windows
    if len(window_centroids) > 0:
        centroid_std_dev = float(np.std(window_centroids))
        peak_freq_range = float(np.max(window_peak_freqs) - np.min(window_peak_freqs))
    else:
        centroid_std_dev = 0.0
        peak_freq_range = 0.0
    
    # Adjacent delta for continuous sweep verification
    max_adjacent_delta = 0.0
    for w in range(1, len(window_peak_freqs)):
        d = abs(window_peak_freqs[w] - window_peak_freqs[w - 1])
        if d > max_adjacent_delta:
            max_adjacent_delta = d

    # 4. Energy partition ratios
    freqs = np.arange(num_bins) * bin_width
    p_tot = np.sum(power_spectrum) + 1e-12
    spectral_centroid = float(np.sum(freqs * power_spectrum) / p_tot)

    # Wiener spectral flatness
    geom_mean = np.exp(np.mean(np.log(power_spectrum + 1e-12)))
    arith_mean = np.mean(power_spectrum)
    spectral_flatness = float(geom_mean / (arith_mean + 1e-12))

    deep_bass_r = float(np.sum(power_spectrum[freqs <= 150]) / p_tot)
    wood_horn_r = float(np.sum(power_spectrum[(freqs > 150) & (freqs <= 550)]) / p_tot)
    doorbell_r  = float(np.sum(power_spectrum[(freqs >= 480) & (freqs <= 750)]) / p_tot)
    mid_r       = float(np.sum(power_spectrum[(freqs >= 750) & (freqs <= 2400)]) / p_tot)
    alarm_r     = float(np.sum(power_spectrum[(freqs >= 2400) & (freqs <= 4200)]) / p_tot)
    high_r      = float(np.sum(power_spectrum[freqs >= 2800]) / p_tot)

    # Detect dual fundamental peaks for Car Horn (380-550 Hz)
    max_total_power = np.max(power_spectrum)
    horn_bin_start = int(380 / bin_width)
    horn_bin_end = int(550 / bin_width)
    horn_slice = power_spectrum[horn_bin_start:horn_bin_end + 1]
    max_horn_power = np.max(horn_slice) if len(horn_slice) > 0 else 1.0
    peaks_in_horn = []
    if max_horn_power >= 0.25 * max_total_power:
        for bi in range(1, len(horn_slice) - 1):
            if horn_slice[bi] > horn_slice[bi-1] and horn_slice[bi] > horn_slice[bi+1]:
                if horn_slice[bi] >= 0.25 * max_horn_power:
                    peaks_in_horn.append((horn_bin_start + bi) * bin_width)
    has_dual_horn_peaks = (len(peaks_in_horn) >= 2 and 40.0 <= abs(peaks_in_horn[1] - peaks_in_horn[0]) <= 140.0)

    # Explicit Human Speech Detector
    is_speech = ((wood_horn_r + mid_r) >= 0.65 and 
                 high_r < 0.15 and deep_bass_r < 0.22 and 
                 transient_ratio < 2.4 and impulse_count == 0 and
                 0.04 <= zcr <= 0.20 and 0.005 <= spectral_flatness <= 0.25)

    return {
        "rms": rms,
        "zcr": zcr,
        "transient_ratio": transient_ratio,
        "temp_var": temp_var,
        "impulse_count": impulse_count,
        "spectral_centroid": spectral_centroid,
        "spectral_flatness": spectral_flatness,
        "centroid_std_dev": centroid_std_dev,
        "peak_freq_range": peak_freq_range,
        "max_adjacent_delta": max_adjacent_delta,
        "deep_bass_r": deep_bass_r,
        "wood_horn_r": wood_horn_r,
        "doorbell_r": doorbell_r,
        "mid_r": mid_r,
        "alarm_r": alarm_r,
        "high_r": high_r,
        "has_dual_horn_peaks": has_dual_horn_peaks,
        "is_speech": is_speech
    }


def classify_sound(f: Dict[str, Any]) -> Tuple[str, float, bool, List[Tuple[str, float]]]:
    """Acoustic classification with strict music/speech rejection and calibrated thresholds."""
    rms = f["rms"]

    # Layer 1: Silence & Audio Activity Gate (Calibrated for ~3-4 meters detection)
    if rms < 0.012:
        return "ambient", 0.98, False, [("ambient", 0.98)]

    # Hard-negative check: Music detection
    is_music = (f["deep_bass_r"] >= 0.16 and (f["mid_r"] >= 0.20 or f["doorbell_r"] >= 0.20)) or (f["deep_bass_r"] >= 0.28)
    is_speech = f["is_speech"]

    logits = np.full(len(CLASSES), -4.0, dtype=np.float32)
    # Background baseline (dominant for music, speech, stationary fan, ambient noise)
    logits[13] = 1.0 + (3.5 if is_music else 0.0) + (5.5 if is_speech else 0.0) + (2.5 if f["spectral_flatness"] > 0.30 else 0.0)

    # 0. Fire Alarm & Electronic Buzzer Alarms:
    # a) High pure tone T-3 pulses in 2400 - 4200 Hz
    # b) Mid-frequency piezo buzzer alarm in 900 - 1500 Hz (steady pitch, zero infant F0)
    is_high_alarm = (f["alarm_r"] >= 0.45 and f["spectral_centroid"] >= 2400 and f["spectral_flatness"] <= 0.15)
    is_mid_buzzer = (f["mid_r"] >= 0.70 and f["spectral_flatness"] <= 0.025 and f["doorbell_r"] < 0.10 and f["wood_horn_r"] < 0.10 and (900 <= f["spectral_centroid"] <= 1800) and f["peak_freq_range"] < 80.0 and f["centroid_std_dev"] < 50.0)
    if not is_music and not is_speech and (is_high_alarm or is_mid_buzzer) and rms >= 0.014:
        logits[0] = 5.5 + 3.0 * (f["alarm_r"] if is_high_alarm else f["mid_r"])

    # 1. Siren (GENUINE CONTINUOUS FREQUENCY MODULATION REQUIRED! Continuous wail temp_var <= 0.25, Mid-band dominant, NO wood horn)
    if not is_music and not is_speech and f["deep_bass_r"] < 0.06 and f["wood_horn_r"] < 0.22:
        if f["mid_r"] >= 0.48 and 800 <= f["spectral_centroid"] <= 1800 and f["spectral_flatness"] <= 0.18 and rms >= 0.016:
            if f["peak_freq_range"] >= 180.0 and f["centroid_std_dev"] >= 75.0 and f["temp_var"] <= 0.25:
                logits[1] = 5.2 + 3.0 * (f["mid_r"] - 0.48) + (f["peak_freq_range"] / 300.0)

    # 4. Car Horn (Automotive horn: dominant in 150-550 Hz, dual fundamental peaks, LONG or SHORT honk)
    # Long blast (temp_var <= 0.20) or short honk with verified dual peaks (has_dual_horn_peaks), NOT mechanical impulses
    if not is_music and not is_speech and f["deep_bass_r"] < 0.12 and f["impulse_count"] == 0:
        horn_freq_match = 380 <= f["spectral_centroid"] <= 1300 and f["wood_horn_r"] >= 0.30
        horn_steady = f["has_dual_horn_peaks"] or (f["temp_var"] <= 0.20 and f["peak_freq_range"] < 90.0 and f["centroid_std_dev"] < 50.0)
        if horn_freq_match and horn_steady and f["spectral_flatness"] <= 0.20 and rms >= 0.014:
            logits[4] = 5.6 + 3.0 * f["wood_horn_r"]

    # 7. Dog Barking (Impulsive down-chirps, sharp burst onset, silent pauses, NOT speech, NOT horn, NOT pure chime)
    if not is_music and not is_speech and not f["has_dual_horn_peaks"] and f["wood_horn_r"] < 0.25 and f["rms"] >= 0.018:
        if (f["transient_ratio"] >= 2.6 or f["impulse_count"] >= 2) and f["temp_var"] >= 0.38 and f["spectral_flatness"] >= 0.002:
            if 650 <= f["spectral_centroid"] <= 2000 and (f["mid_r"] + f["wood_horn_r"]) >= 0.55:
                logits[7] = 5.8 + 2.5 * min(1.0, f["temp_var"] / 0.5)

    # 9. Glass Breaking (High frequency shatter > 2800 Hz, explosive burst)
    if not is_music and not is_speech and f["high_r"] >= 0.32 and f["spectral_centroid"] >= 2700 and f["zcr"] >= 0.16 and f["transient_ratio"] >= 2.4 and rms >= 0.014:
        logits[9] = 5.2 + 2.0 * f["high_r"]

    # 10. Door Knocking (Wood taps: 150-550 Hz, quiet intervals, NO vocals/mid band)
    if not is_music and not is_speech and f["mid_r"] < 0.18 and f["deep_bass_r"] < 0.35:
        if (f["impulse_count"] >= 2 or (f["transient_ratio"] >= 2.5 and f["temp_var"] >= 0.16)) and f["wood_horn_r"] >= 0.30 and f["spectral_centroid"] <= 680 and rms >= 0.012:
            logits[10] = 5.2 + 2.0 * min(1.0, f["impulse_count"] / 3.0)

    # 11. Baby Crying (Infant vocal wailing: infant F0 in 420-750 Hz, formants in mid band, NOT pure electronic tone, NOT horn)
    if not is_music and not is_speech and not is_mid_buzzer and not is_high_alarm and not f["has_dual_horn_peaks"] and f["deep_bass_r"] < 0.10:
        has_infant_f0 = (f["doorbell_r"] >= 0.15 or f["wood_horn_r"] >= 0.15)
        if 420 <= f["spectral_centroid"] <= 1600 and f["mid_r"] >= 0.25 and has_infant_f0 and rms >= 0.015:
            if f["temp_var"] >= 0.18 and f["transient_ratio"] < 2.3:
                logits[11] = 5.8 + 3.0 * f["mid_r"]

    # 12. Doorbell (Ding-Dong two-tone drop in 480-900 Hz, or electronic pure chime with decay)
    if not is_music and not is_speech and not is_mid_buzzer and f["deep_bass_r"] < 0.15:
        is_mech_doorbell = (460 <= f["spectral_centroid"] <= 900 and f["doorbell_r"] >= 0.45 and f["mid_r"] < 0.25 and f["spectral_flatness"] <= 0.14)
        is_elec_chime = (700 <= f["spectral_centroid"] <= 1400 and f["mid_r"] >= 0.60 and f["transient_ratio"] < 2.5 and f["spectral_flatness"] < 0.001 and f["temp_var"] >= 0.40)
        if (is_mech_doorbell or is_elec_chime) and rms >= 0.014:
            logits[12] = 5.8 + 3.0 * (f["doorbell_r"] if is_mech_doorbell else f["mid_r"])

    # Compute calibrated Softmax
    max_l = np.max(logits)
    exps = np.exp(logits - max_l)
    probs = exps / np.sum(exps)

    top_indices = np.argsort(probs)[::-1]
    top_preds = [(CLASSES[i], float(probs[i])) for i in top_indices[:5]]

    best_idx = top_indices[0]
    best_class = CLASSES[best_idx]
    best_conf = float(probs[best_idx])

    # Rejection Threshold:
    # 1. Best class must NOT be ambient (index 13)
    # 2. Confidence must be >= 0.80
    # 3. Logit margin over background must be >= 1.5
    margin_over_ambient = logits[best_idx] - logits[13]
    is_confirmed_danger = (best_idx != 13) and (best_conf >= 0.80) and (margin_over_ambient >= 1.5)

    if not is_confirmed_danger:
        return "ambient", best_conf if best_idx == 13 else float(probs[13]), False, top_preds

    return best_class, best_conf, True, top_preds


def run_full_validation_matrix():
    print("=" * 70)
    print("SOUNDGUARD ACOUSTIC VALIDATION MATRIX & HARD NEGATIVE TEST SUITE")
    print("=" * 70)

    test_categories = [
        ("car_horn", "Car Horn (Long Blast)"),
        ("car_horn_short", "Car Horn (Short Honk 300ms)"),
        ("siren", "Siren (Continuous Wail)"),
        ("baby_crying", "Baby Crying (Infant Phonation)"),
        ("door_knocking", "Door Knocking (Wood Taps)"),
        ("glass_breaking", "Glass Breaking (High Shatter)"),
        ("doorbell", "Doorbell (Mechanical Ding-Dong)"),
        ("doorbell_electronic", "Doorbell (Electronic Chime)"),
        ("fire_alarm", "Fire Alarm (3100 Hz T-3 Smoke Alarm)"),
        ("fire_alarm_buzzer", "Fire Alarm (1200 Hz Piezo Buzzer)"),
        ("dog_barking", "Dog Barking (Impulsive Canine Bursts)"),
        ("music", "Headphone Music (Hard Neg)"),
        ("speech", "Speech / Conversation (Hard Neg)"),
        ("room_silence", "Quiet Room / Silence (Neg)"),
        ("fan_hiss", "Fan / Air Conditioner (Neg)"),
        ("keyboard_typing", "Keyboard Clicks (Neg)")
    ]

    confusion = {}
    for cat_id, cat_name in test_categories:
        expected = "ambient" if "Neg" in cat_name else ("car_horn" if "car_horn" in cat_id else ("doorbell" if "doorbell" in cat_id else ("fire_alarm" if "fire_alarm" in cat_id else cat_id)))
        audio = generate_test_audio(cat_id)
        feat = extract_features(audio)
        pred_class, conf, is_danger, top5 = classify_sound(feat)

        passed = (pred_class == expected)
        status = "PASSED [OK]" if passed else "FAILED [X]"
        print(f"[{status:12}] Expected: {expected:16} | Predicted: {pred_class:16} | Conf: {conf*100:5.1f}% | Danger: {is_danger}")
        if not passed:
            print(f"               Top 5: {top5}")
            print(f"               Features: RMS={feat['rms']:.3f}, Centroid={feat['spectral_centroid']:.1f}, "
                  f"StdDev={feat['centroid_std_dev']:.1f}, PeakRange={feat['peak_freq_range']:.1f}, "
                  f"WoodHorn={feat['wood_horn_r']:.2f}, Doorbell={feat['doorbell_r']:.2f}, Mid={feat['mid_r']:.2f}, "
                  f"TempVar={feat['temp_var']:.2f}")

        confusion[cat_id] = (expected, pred_class, passed)

    total = len(test_categories)
    num_passed = sum(1 for _, _, p in confusion.values() if p)
    print("=" * 70)
    print(f"RESULTS: {num_passed} / {total} tests passed ({num_passed / total * 100:.1f}%)")
    print("=" * 70)

if __name__ == "__main__":
    run_full_validation_matrix()
