"""SoundGuard - Audio Capture Module.

Handles incoming audio streams from web clients or native microphones,
normalizing sample rates, bit depths, and chunking into sliding windows.
"""

import base64
from typing import Optional, Tuple
import numpy as np


class MicrophoneCaptureBuffer:
    """Manages audio buffer ingestion and framing."""

    def __init__(self, target_sample_rate: int = 16000, window_duration_sec: float = 1.0):
        self.target_sample_rate = target_sample_rate
        self.window_duration_sec = window_duration_sec
        self.window_size = int(target_sample_rate * window_duration_sec)
        self.buffer = np.zeros(self.window_size, dtype=np.float32)

    def ingest_raw_bytes(self, raw_bytes: bytes, source_sample_rate: int = 16000, dtype: str = "float32") -> np.ndarray:
        """Parse raw audio bytes into normalized float32 numpy array."""
        if dtype == "float32":
            samples = np.frombuffer(raw_bytes, dtype=np.float32)
        elif dtype == "int16":
            samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        else:
            samples = np.frombuffer(raw_bytes, dtype=np.float32)

        return self.ingest_samples(samples, source_sample_rate)

    def ingest_base64(self, b64_string: str, source_sample_rate: int = 16000, dtype: str = "float32") -> np.ndarray:
        """Parse base64-encoded audio chunk."""
        # Clean prefix if data URL
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        raw_bytes = base64.b64decode(b64_string)
        return self.ingest_raw_bytes(raw_bytes, source_sample_rate, dtype)

    def ingest_samples(self, samples: np.ndarray, source_sample_rate: int = 16000) -> np.ndarray:
        """Append samples, resample if necessary, and slide buffer."""
        if samples.ndim > 1:
            samples = np.mean(samples, axis=-1)

        # Simple linear resampling if sample rate differs from 16kHz
        if source_sample_rate != self.target_sample_rate and len(samples) > 0:
            target_len = int(len(samples) * self.target_sample_rate / source_sample_rate)
            x_old = np.linspace(0, 1, len(samples))
            x_new = np.linspace(0, 1, target_len)
            samples = np.interp(x_new, x_old, samples).astype(np.float32)

        # Slide buffer
        num_new = len(samples)
        if num_new >= self.window_size:
            self.buffer = samples[-self.window_size:].astype(np.float32)
        else:
            self.buffer = np.roll(self.buffer, -num_new)
            self.buffer[-num_new:] = samples

        return self.buffer.copy()

    def get_current_window(self) -> np.ndarray:
        """Return the current 1-second audio window."""
        return self.buffer.copy()

    def reset(self):
        """Clear audio buffer."""
        self.buffer.fill(0.0)
