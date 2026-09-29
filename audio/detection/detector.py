"""SoundGuard - Real-time Sound Detector with Debounce Cooldown.

Orchestrates real-time audio inference, applies user confidence thresholds,
and enforces configurable debounce cooldown timers to eliminate duplicate alert fatigue
and cross-class noise chattering.
"""

import time
from typing import Dict, Any, Optional, Set
import numpy as np

from audio.preprocessing.noise_filter import AudioNoiseFilter
from ai.inference.engine import EdgeInferenceEngine
from ai.labels.categories import SOUND_DEFINITIONS, SOUND_CLASSES


class RealTimeSoundDetector:
    """Manages sound detection, confidence gating, and alert debouncing."""

    def __init__(
        self,
        default_confidence_threshold: float = 0.70,
        default_cooldown_seconds: float = 5.0,
        sample_rate: int = 16000
    ):
        self.confidence_threshold = default_confidence_threshold
        self.default_cooldown_seconds = default_cooldown_seconds
        self.sample_rate = sample_rate

        self.noise_filter = AudioNoiseFilter()
        self.engine = EdgeInferenceEngine(sample_rate=sample_rate)

        # Cooldown tracking: sound_id -> last_alert_timestamp
        self.last_alert_times: Dict[str, float] = {}

        # Global last alert timestamp (prevents cross-class room echo chattering for 0.4 second)
        self.global_last_alert_time: float = 0.0
        self.global_holdoff_seconds: float = 0.4

        # Enabled sounds filter (all 13 enabled by default)
        self.enabled_sounds: Set[str] = set(SOUND_CLASSES)

        # Custom priority overrides
        self.priority_overrides: Dict[str, str] = {}

        # Custom cooldown overrides
        self.cooldown_overrides: Dict[str, float] = {}

        # Detection statistics
        self.total_detections_count = 0
        self.suppressed_duplicates_count = 0
        self.last_detection_result: Optional[Dict[str, Any]] = None

    def set_confidence_threshold(self, threshold: float):
        """Update confidence threshold (0.50 to 0.95)."""
        self.confidence_threshold = max(0.50, min(0.95, float(threshold)))

    def set_sound_enabled(self, sound_id: str, enabled: bool):
        """Enable or disable detection for a specific sound class."""
        if enabled:
            self.enabled_sounds.add(sound_id)
        else:
            self.enabled_sounds.discard(sound_id)

    def set_cooldown(self, sound_id: str, cooldown_seconds: float):
        """Set specific debounce cooldown for a sound."""
        self.cooldown_overrides[sound_id] = max(1.0, float(cooldown_seconds))

    def set_priority(self, sound_id: str, priority: str):
        """Override priority for a sound (high, medium, low)."""
        if priority in ("high", "medium", "low"):
            self.priority_overrides[sound_id] = priority

    def process_window(self, raw_audio: np.ndarray) -> Dict[str, Any]:
        """Process a 1-second audio frame through the full detection pipeline."""
        now = time.time()

        # Step 1: Preconditioning & Noise Gate
        conditioned_audio = self.noise_filter.process(raw_audio)

        # Step 2: Edge AI Inference
        inference_out = self.engine.process_audio(conditioned_audio)
        prediction = inference_out["prediction"]
        sound_id = prediction["sound"]
        confidence = prediction["confidence"]
        is_detected = prediction["is_detected"]

        # If ambient room noise or silence, immediately return non-alert
        if not is_detected or sound_id == "ambient":
            return {
                "sound": "ambient",
                "sound_name": "Ambient / Quiet",
                "category": "normal",
                "priority": "none",
                "confidence": confidence,
                "confidence_percent": int(confidence * 100),
                "icon": "🎧",
                "voice_phrase": "",
                "color": "#64748b",
                "can_escalate": False,
                "should_alert": False,
                "suppressed_by_cooldown": False,
                "cooldown_remaining_sec": 0.0,
                "is_enabled": True,
                "timestamp": now,
                "edge_telemetry": inference_out["edge_telemetry"],
                "features_summary": inference_out["features_summary"],
                "all_probabilities": prediction.get("probabilities", {})
            }

        # Step 3: Check Enabled & Confidence Threshold
        is_enabled = sound_id in self.enabled_sounds
        meets_threshold = (confidence >= self.confidence_threshold)

        # Apply priority override if user customized it
        effective_priority = self.priority_overrides.get(sound_id, prediction.get("priority", "low"))
        prediction["priority"] = effective_priority

        # Step 4: Debounce / Cooldown Logic
        cooldown_duration = self.cooldown_overrides.get(
            sound_id,
            SOUND_DEFINITIONS.get(sound_id, {}).get("cooldown_seconds", self.default_cooldown_seconds)
        )

        last_time = self.last_alert_times.get(sound_id, 0.0)
        time_since_same = now - last_time
        in_same_cooldown = time_since_same < cooldown_duration

        # Global holdoff to prevent reverberation chattering
        time_since_global = now - self.global_last_alert_time
        in_global_holdoff = (time_since_global < self.global_holdoff_seconds) and (sound_id not in self.last_alert_times or (now - self.last_alert_times[sound_id] > 0.5))

        should_alert = False
        suppressed = False

        if meets_threshold and is_enabled:
            if not in_same_cooldown and not in_global_holdoff:
                # Trigger valid alert
                should_alert = True
                self.last_alert_times[sound_id] = now
                self.global_last_alert_time = now
                self.total_detections_count += 1
            else:
                # Suppressed by either same-sound cooldown or global holdoff
                suppressed = True
                self.suppressed_duplicates_count += 1

        result = {
            "sound": sound_id,
            "sound_name": prediction.get("sound_name", sound_id),
            "category": prediction.get("category", "environmental"),
            "priority": effective_priority,
            "confidence": confidence,
            "confidence_percent": int(confidence * 100),
            "icon": prediction.get("icon", "🔊"),
            "voice_phrase": prediction.get("voice_phrase", ""),
            "color": prediction.get("color", "#64748b"),
            "can_escalate": prediction.get("can_escalate", False),
            "should_alert": should_alert,
            "suppressed_by_cooldown": suppressed,
            "cooldown_remaining_sec": max(0.0, round(cooldown_duration - time_since_same, 1)) if in_same_cooldown else 0.0,
            "is_enabled": is_enabled,
            "timestamp": now,
            "edge_telemetry": inference_out["edge_telemetry"],
            "features_summary": inference_out["features_summary"],
            "all_probabilities": prediction.get("probabilities", {})
        }

        if should_alert:
            self.last_detection_result = result

        return result

    def reset_cooldowns(self):
        """Clear all active cooldown timers."""
        self.last_alert_times.clear()
        self.global_last_alert_time = 0.0
