"""SoundGuard - Audio Noise Filtering & Conditioning.

Preconditions audio before feature extraction:
- DC offset removal
- Pre-emphasis high-frequency boost (alpha = 0.97)
- Noise gating
- Peak normalization
"""

import numpy as np


class AudioNoiseFilter:
    """Acoustic signal conditioner and noise suppressor."""

    def __init__(self, pre_emphasis_coeff: float = 0.97, noise_gate_threshold: float = 0.005):
        self.pre_emphasis_coeff = pre_emphasis_coeff
        self.noise_gate_threshold = noise_gate_threshold

    def remove_dc_offset(self, audio: np.ndarray) -> np.ndarray:
        """Subtract DC component (mean)."""
        return audio - np.mean(audio)

    def apply_pre_emphasis(self, audio: np.ndarray) -> np.ndarray:
        """Apply pre-emphasis filter to boost high frequencies."""
        if len(audio) < 2:
            return audio
        return np.append(audio[0], audio[1:] - self.pre_emphasis_coeff * audio[:-1])

    def apply_noise_gate(self, audio: np.ndarray) -> np.ndarray:
        """Zero out quiet background floor."""
        energy = np.mean(audio ** 2)
        if energy < (self.noise_gate_threshold ** 2):
            return np.zeros_like(audio)
        return audio

    def normalize_peak(self, audio: np.ndarray, target_peak: float = 0.95) -> np.ndarray:
        """Scale audio to target peak if non-zero."""
        peak = np.max(np.abs(audio))
        if peak > 1e-5:
            return audio * (target_peak / peak)
        return audio

    def process(self, audio: np.ndarray, apply_pre_emph: bool = False) -> np.ndarray:
        """Apply full conditioning chain without distorting frequency spectrum."""
        clean = self.remove_dc_offset(audio)
        clean = self.apply_noise_gate(clean)
        if apply_pre_emph and np.max(np.abs(clean)) > 0:
            clean = self.apply_pre_emphasis(clean)
        return clean.astype(np.float32)
