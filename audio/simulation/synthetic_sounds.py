"""SoundGuard - Synthetic Sound Generation for Presentation & Testing.

Generates realistic acoustic waveforms for the Section 19 Demo Scenarios:
- Demo 1: Fire Alarm (T-3 pattern, 3.1 kHz pulsed alarm)
- Demo 2: Car Horn (415 Hz + 495 Hz automotive dual blast)
- Demo 3: Glass Breaking (High frequency transient shatter + resonance)
- Demo 4: Doorbell (Ding-Dong 660 Hz -> 520 Hz chime)
- Siren, Baby Crying, Dog Barking, Door Knocking
"""

import numpy as np
from typing import Dict, Any


def generate_sound(sound_id: str, duration_sec: float = 1.0, sample_rate: int = 16000) -> np.ndarray:
    """Synthesize normalized float32 waveform for a specified sound class."""
    total_samples = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, total_samples, endpoint=False)
    wave = np.zeros(total_samples, dtype=np.float32)

    if sound_id == "fire_alarm":
        # T-3 Pattern: 3 beeps (0.2s each) with 0.1s gaps
        carrier = np.sin(2 * np.pi * 3200 * t) + 0.3 * np.sin(2 * np.pi * 6400 * t)
        envelope = np.zeros_like(t)
        # 3 pulses at 0.05-0.25s, 0.35-0.55s, 0.65-0.85s
        for start_t in [0.05, 0.35, 0.65]:
            mask = (t >= start_t) & (t < start_t + 0.22)
            envelope[mask] = 1.0
        wave = carrier * envelope

    elif sound_id == "siren":
        # Frequency modulated wail between 750 Hz and 1500 Hz
        mod_freq = 1.5  # 1.5 wail cycles per sec
        freq_t = 1100 + 400 * np.sin(2 * np.pi * mod_freq * t)
        phase = 2 * np.pi * np.cumsum(freq_t) / sample_rate
        wave = 0.7 * np.sin(phase) + 0.25 * np.sin(2 * phase)

    elif sound_id == "car_horn":
        # Dual-tone automotive horn (415 Hz + 495 Hz) + slight harmonics
        tone1 = np.sin(2 * np.pi * 420 * t)
        tone2 = np.sin(2 * np.pi * 505 * t)
        harmonics = 0.2 * np.sin(2 * np.pi * 840 * t) + 0.2 * np.sin(2 * np.pi * 1010 * t)
        env = np.ones_like(t)
        env[:int(0.02 * sample_rate)] = np.linspace(0, 1, int(0.02 * sample_rate))
        env[-int(0.04 * sample_rate):] = np.linspace(1, 0, int(0.04 * sample_rate))
        wave = (tone1 + tone2 + harmonics) * env

    elif sound_id == "glass_breaking":
        # High frequency shatter + transient noise burst + exponential decay
        np.random.seed(101)
        noise = np.random.randn(total_samples).astype(np.float32)
        # High frequency ring components
        ring = (
            np.sin(2 * np.pi * 4200 * t) * np.exp(-12 * t) +
            np.sin(2 * np.pi * 5600 * t) * np.exp(-18 * t) +
            np.sin(2 * np.pi * 7100 * t) * np.exp(-25 * t)
        )
        decay_noise = noise * np.exp(-9 * t)
        # Add secondary shard bounces at 0.15s and 0.3s
        for shard_t in [0.12, 0.28, 0.45]:
            idx = int(shard_t * sample_rate)
            rem = total_samples - idx
            if rem > 0:
                t_sub = t[:rem]
                decay_noise[idx:] += 0.4 * np.random.randn(rem) * np.exp(-22 * t_sub)
        wave = 0.6 * decay_noise + 0.4 * ring

    elif sound_id == "doorbell":
        # Ding-Dong chime: 660 Hz for 0.45s, then 520 Hz for remaining time
        split_idx = int(0.40 * sample_rate)
        # Ding (660 Hz)
        t1 = t[:split_idx]
        ding = np.sin(2 * np.pi * 660 * t1) * np.exp(-3.5 * t1)
        # Dong (520 Hz)
        t2 = t[split_idx:] - 0.40
        dong = np.sin(2 * np.pi * 520 * t2) * np.exp(-3.0 * t2)
        wave[:split_idx] = ding
        wave[split_idx:] = dong

    elif sound_id == "baby_crying":
        # Pitch modulated 500 Hz carrier with ~4 Hz wailing flutter
        flutter = 80 * np.sin(2 * np.pi * 4.5 * t)
        freq_t = 520 + flutter
        phase = 2 * np.pi * np.cumsum(freq_t) / sample_rate
        # Tremolo volume envelope
        vol_env = 0.5 + 0.45 * np.sin(2 * np.pi * 2.2 * t)
        wave = (np.sin(phase) + 0.4 * np.sin(2 * phase)) * np.maximum(0, vol_env)

    elif sound_id == "dog_barking":
        # 2-3 short bark bursts (800 Hz -> 400 Hz downchirp)
        for bark_t in [0.1, 0.45, 0.8]:
            idx = int(bark_t * sample_rate)
            dur = int(0.18 * sample_rate)
            if idx + dur <= total_samples:
                t_b = np.linspace(0, 0.18, dur)
                chirp_f = 950 - 450 * (t_b / 0.18)
                phase = 2 * np.pi * np.cumsum(chirp_f) / sample_rate
                env = np.maximum(0.0, np.sin(np.pi * t_b / 0.18)) ** 1.5
                wave[idx:idx + dur] += (np.sin(phase) + 0.3 * np.random.randn(dur).astype(np.float32)) * env

    elif sound_id == "door_knocking":
        # 3 low-frequency wood taps (180 Hz)
        for knock_t in [0.15, 0.45, 0.75]:
            idx = int(knock_t * sample_rate)
            dur = int(0.08 * sample_rate)
            if idx + dur <= total_samples:
                t_k = np.linspace(0, 0.08, dur)
                knock = np.sin(2 * np.pi * 180 * t_k) * np.exp(-40 * t_k)
                wave[idx:idx + dur] += knock

    else:
        # Generic tone
        wave = np.sin(2 * np.pi * 1000 * t)

    # Normalize amplitude
    peak = np.max(np.abs(wave))
    if peak > 0:
        wave = wave / peak * 0.90

    return wave.astype(np.float32)
