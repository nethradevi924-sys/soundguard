"""SoundGuard - Audio Feature Extraction.

Extracts acoustic features suitable for on-device edge AI inference:
- 40-band Log-Mel Filterbank energies
- Spectral Centroid, Rolloff, Flatness
- Zero Crossing Rate (ZCR)
- Root Mean Square (RMS) energy
- Band energy distribution (Low / Mid / High frequency bands)
- Temporal envelope variance
Pure NumPy implementation for maximum portability and sub-millisecond execution.
"""

from typing import Dict, Any, Tuple
import numpy as np


def hz_to_mel(hz: np.ndarray) -> np.ndarray:
    """Convert frequency in Hertz to Mel scale."""
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def mel_to_hz(mel: np.ndarray) -> np.ndarray:
    """Convert Mel scale to frequency in Hertz."""
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def create_mel_filterbank(
    num_filters: int = 40,
    fft_size: int = 512,
    sample_rate: int = 16000,
    low_freq: float = 50.0,
    high_freq: float = 7800.0
) -> np.ndarray:
    """Construct a triangular Mel filterbank matrix."""
    low_mel = hz_to_mel(np.array([low_freq]))[0]
    high_mel = hz_to_mel(np.array([high_freq]))[0]
    mel_points = np.linspace(low_mel, high_mel, num_filters + 2)
    hz_points = mel_to_hz(mel_points)
    
    bin_points = np.floor((fft_size + 1) * hz_points / sample_rate).astype(int)
    num_bins = fft_size // 2 + 1
    filterbank = np.zeros((num_filters, num_bins), dtype=np.float32)

    for m in range(1, num_filters + 1):
        f_m_minus = bin_points[m - 1]
        f_m = bin_points[m]
        f_m_plus = bin_points[m + 1]

        if f_m > f_m_minus:
            filterbank[m - 1, f_m_minus:f_m] = (
                np.arange(f_m_minus, f_m) - f_m_minus
            ) / (f_m - f_m_minus)
        if f_m_plus > f_m:
            filterbank[m - 1, f_m:f_m_plus] = (
                f_m_plus - np.arange(f_m, f_m_plus)
            ) / (f_m_plus - f_m)

    return filterbank


class AudioFeatureExtractor:
    """Fast, edge-optimized acoustic feature extractor."""

    def __init__(self, sample_rate: int = 16000, fft_size: int = 512, num_mels: int = 40):
        self.sample_rate = sample_rate
        self.fft_size = fft_size
        self.num_mels = num_mels
        self.mel_filterbank = create_mel_filterbank(
            num_filters=num_mels,
            fft_size=fft_size,
            sample_rate=sample_rate,
            low_freq=50.0,
            high_freq=min(7800.0, sample_rate / 2.0)
        )
        self.freqs = np.linspace(0, sample_rate / 2.0, fft_size // 2 + 1)

    def extract_features(self, audio: np.ndarray) -> Dict[str, Any]:
        """Extract a rich feature vector from a 1D audio sample array."""
        if audio.ndim > 1:
            audio = np.mean(audio, axis=-1)
        
        # Ensure float32
        audio = audio.astype(np.float32)
        total_samples = len(audio)
        if total_samples == 0:
            return self._get_empty_features()

        # 1. RMS Energy
        rms = float(np.sqrt(np.mean(audio ** 2) + 1e-12))

        # 2. Zero Crossing Rate (ZCR)
        signs = np.sign(audio)
        signs[signs == 0] = 1
        zcr = float(np.mean(np.abs(signs[1:] - signs[:-1]) > 0))

        # 3. Framing & Windowing
        frame_len = self.fft_size
        hop_len = frame_len // 2
        
        # If audio is shorter than frame_len, zero pad
        if total_samples < frame_len:
            padded = np.zeros(frame_len, dtype=np.float32)
            padded[:total_samples] = audio
            frames = padded.reshape(1, -1)
        else:
            num_frames = max(1, 1 + (total_samples - frame_len) // hop_len)
            frames = np.lib.stride_tricks.as_strided(
                audio,
                shape=(num_frames, frame_len),
                strides=(audio.strides[0] * hop_len, audio.strides[0])
            )

        # Apply Hanning window
        window = np.hanning(frame_len)
        windowed_frames = frames * window

        # Compute power spectrum via rfft
        fft_complex = np.fft.rfft(windowed_frames, n=frame_len, axis=-1)
        power_spectrum = (np.abs(fft_complex) ** 2) / float(frame_len)

        # Mean power spectrum across time
        avg_power = np.mean(power_spectrum, axis=0) + 1e-10

        # 4. Mel Spectrogram Filterbank Energies
        mel_energies = np.dot(self.mel_filterbank, avg_power)
        log_mel = np.log10(mel_energies + 1e-6)

        # 5. Spectral Centroid
        centroid = float(np.sum(self.freqs * avg_power) / (np.sum(avg_power) + 1e-12))

        # 6. Spectral Rolloff (85% energy point)
        cum_energy = np.cumsum(avg_power)
        total_energy = cum_energy[-1]
        rolloff_idx = np.searchsorted(cum_energy, 0.85 * total_energy)
        rolloff = float(self.freqs[min(rolloff_idx, len(self.freqs) - 1)])

        # 7. Spectral Flatness
        geo_mean = np.exp(np.mean(np.log(avg_power + 1e-12)))
        arith_mean = np.mean(avg_power)
        flatness = float(geo_mean / (arith_mean + 1e-12))

        # 8. Subband Energy Ratios
        low_mask = self.freqs <= 500
        mid_mask = (self.freqs > 500) & (self.freqs <= 2500)
        high_mask = self.freqs > 2500

        low_energy = float(np.sum(avg_power[low_mask]))
        mid_energy = float(np.sum(avg_power[mid_mask]))
        high_energy = float(np.sum(avg_power[high_mask]))
        tot = low_energy + mid_energy + high_energy + 1e-12

        low_ratio = low_energy / tot
        mid_ratio = mid_energy / tot
        high_ratio = high_energy / tot

        # 9. Temporal Envelope Modulation
        frame_energies = np.sum(windowed_frames ** 2, axis=1)
        temporal_variance = float(np.var(frame_energies) / (np.mean(frame_energies) ** 2 + 1e-6))

        # Combined feature vector for classifier
        feature_vector = np.concatenate([
            log_mel,  # 40 mel values
            [
                centroid / (self.sample_rate / 2.0),
                rolloff / (self.sample_rate / 2.0),
                flatness,
                zcr,
                rms,
                low_ratio,
                mid_ratio,
                high_ratio,
                min(temporal_variance, 10.0) / 10.0
            ]
        ]).astype(np.float32)

        return {
            "feature_vector": feature_vector,
            "rms": rms,
            "zcr": zcr,
            "spectral_centroid": centroid,
            "spectral_rolloff": rolloff,
            "spectral_flatness": flatness,
            "subbands": {
                "low": low_ratio,
                "mid": mid_ratio,
                "high": high_ratio
            },
            "log_mel": log_mel.tolist()
        }

    def _get_empty_features(self) -> Dict[str, Any]:
        """Return zeroed features for silence."""
        return {
            "feature_vector": np.zeros(self.num_mels + 9, dtype=np.float32),
            "rms": 0.0,
            "zcr": 0.0,
            "spectral_centroid": 0.0,
            "spectral_rolloff": 0.0,
            "spectral_flatness": 0.0,
            "subbands": {"low": 0.33, "mid": 0.33, "high": 0.33},
            "log_mel": [0.0] * self.num_mels
        }
