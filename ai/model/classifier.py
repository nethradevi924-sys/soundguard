"""SoundGuard - Edge AI Acoustic Classification Model.

A lightweight, precision-tuned acoustic model designed for Edge AI deployment.
Uses multi-feature discriminative gating (RMS energy, spectral centroid,
tonality/flatness, ZCR, and temporal modulation) to reliably reject room noise,
microphone hiss, and background sounds, while accurately classifying the 13 target sounds.
"""

from typing import Dict, Any, List, Optional
import numpy as np
from ai.labels.categories import SOUND_CLASSES, get_sound_info


class SoundClassifierModel:
    """Acoustic classifier for environmental and emergency sounds."""

    def __init__(self):
        self.classes = SOUND_CLASSES
        self.num_classes = len(self.classes)
        # Minimum RMS energy threshold for sound detection (rejects room hiss, quiet fan, whisper)
        self.min_sound_rms = 0.015

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Perform acoustic inference on extracted features.

        Strictly rejects ambient/room noise unless acoustic signatures
        are decisively present.
        """
        rms = features.get("rms", 0.0)
        centroid = features.get("spectral_centroid", 0.0)
        flatness = features.get("spectral_flatness", 0.0)
        zcr = features.get("zcr", 0.0)
        subbands = features.get("subbands", {"low": 0.33, "mid": 0.33, "high": 0.33})
        low_r = subbands.get("low", 0.33)
        mid_r = subbands.get("mid", 0.33)
        high_r = subbands.get("high", 0.33)

        feature_vec = features.get("feature_vector", np.zeros(49))
        temp_var = float(feature_vec[-1]) if len(feature_vec) >= 49 else 0.0

        # Step 1: Strict Ambient / Quiet Room Gate
        # Low energy or flat stationary noise (like mic hiss / room reverb) is 100% ambient
        if rms < self.min_sound_rms or (flatness > 0.45 and temp_var < 0.10 and high_r < 0.60):
            return self._build_ambient_result(rms, confidence=0.98)

        # Step 2: Evaluate candidate matches against acoustic physical models
        candidates = {}

        # 1. Glass Breaking: Sharp transient, high centroid (>2800Hz), high ZCR (>0.22),
        # high high-frequency subband (>0.40), high temporal variation (>0.15).
        if (centroid >= 2800 and high_r >= 0.40 and zcr >= 0.22 and temp_var >= 0.15 and rms >= 0.03):
            score = 0.90 + 0.08 * min(1.0, temp_var / 0.6)
            candidates["glass_breaking"] = min(0.98, score)

        # 2. Fire Alarm: T-3 high pure tone (2200-4200 Hz), high high-frequency subband (>0.45), high ZCR (>0.12)
        if (2200 <= centroid <= 4200 and flatness <= 0.15 and high_r >= 0.45 and zcr >= 0.12):
            score = 0.92 + 0.06 * (1.0 - min(1.0, flatness / 0.15))
            candidates["fire_alarm"] = min(0.98, score)

        # 3. Siren: Mid-frequency tonal wail (700-1800 Hz), dominant mid-band energy (>0.60), low temp_var (<0.10)
        if (700 <= centroid <= 1800 and flatness <= 0.15 and mid_r >= 0.60 and temp_var < 0.10):
            score = 0.90 + 0.07 * (mid_r / 0.90)
            candidates["siren"] = min(0.97, score)

        # 4. Security Alarm: High-frequency repeating tone (2000-4200 Hz), high high-subband (>0.35), high temp_var
        if (2000 <= centroid <= 4200 and flatness <= 0.18 and high_r >= 0.35 and temp_var >= 0.08):
            score = 0.88 + 0.07 * (high_r / 0.65)
            candidates["security_alarm"] = min(0.96, score)

        # 5. Car Horn: Steady automotive dual blast (350-750 Hz), low-band dominant (>0.50), low ZCR
        if (350 <= centroid <= 750 and flatness <= 0.15 and (low_r + mid_r) >= 0.65 and zcr <= 0.15 and temp_var < 0.05 and low_r >= 0.50):
            score = 0.91 + 0.06 * (1.0 - min(1.0, flatness / 0.15))
            candidates["car_horn"] = min(0.97, score)

        # 6. Doorbell: Pure Ding-Dong chime (450-900 Hz), mid-dominant (>0.65), low low-band (<0.30)
        if (450 <= centroid <= 900 and flatness <= 0.15 and mid_r >= 0.65 and zcr <= 0.15 and temp_var < 0.08 and low_r < 0.30):
            score = 0.90 + 0.07 * (mid_r / 0.75)
            candidates["doorbell"] = min(0.96, score)

        # 7. Baby Crying: Infant vocal wailing (400-1300 Hz), harmonic formants, mid+low presence, pulsating flutter
        if (400 <= centroid <= 1300 and flatness <= 0.20 and mid_r >= 0.45 and low_r >= 0.25 and temp_var >= 0.05 and temp_var < 0.18):
            score = 0.88 + 0.07 * (mid_r / 0.70)
            candidates["baby_crying"] = min(0.95, score)

        # 8. Dog Barking: Down-chirp bursts (650-1800 Hz), impulsive envelope (temp_var >= 0.12)
        if (650 <= centroid <= 1800 and temp_var >= 0.12 and (mid_r + low_r) >= 0.60):
            score = 0.88 + 0.08 * min(1.0, temp_var / 0.4)
            candidates["dog_barking"] = min(0.96, score)

        # 9. Door Knocking: Low-frequency impulses (80-500 Hz), high low-frequency energy (>0.60), impulsive burst
        if (80 <= centroid <= 500 and low_r >= 0.60 and temp_var >= 0.12 and zcr <= 0.06):
            score = 0.90 + 0.07 * (low_r / 0.90)
            candidates["door_knocking"] = min(0.96, score)

        # 10. Train: Low heavy rumble (200-700 Hz), low subband (>0.60), sustained (temp_var < 0.15)
        if (200 <= centroid <= 700 and low_r >= 0.60 and temp_var <= 0.15 and rms >= 0.05):
            score = 0.85 + 0.07 * (low_r / 0.80)
            candidates["train"] = min(0.94, score)

        # 11. Motorcycle: Broad revving engine (600-1300 Hz), low+mid (>0.65), moderate flatness (0.04-0.25)
        if (600 <= centroid <= 1300 and (low_r + mid_r) >= 0.65 and 0.04 <= flatness <= 0.25 and rms >= 0.05):
            score = 0.85 + 0.07 * min(1.0, (low_r + mid_r) / 0.85)
            candidates["motorcycle"] = min(0.94, score)

        # 12. Distress Shouting: Loud human vocal scream (1500-3200 Hz), mid-energy (>0.45), high temp_var
        if (1500 <= centroid <= 3200 and mid_r >= 0.45 and temp_var >= 0.10 and rms >= 0.08):
            score = 0.88 + 0.08 * min(1.0, rms / 0.25)
            candidates["distress_shouting"] = min(0.96, score)

        # 13. Construction Noise: Mechanical impact / hammering (1200-3500 Hz), flatness >= 0.20,
        # temp_var >= 0.18, high RMS (>0.07)
        if (1200 <= centroid <= 3500 and flatness >= 0.20 and temp_var >= 0.18 and rms >= 0.07):
            score = 0.85 + 0.07 * (flatness / 0.40)
            candidates["construction_noise"] = min(0.93, score)

        # Step 3: Check if any candidate decisively won
        if not candidates:
            return self._build_ambient_result(rms, confidence=0.92)

        best_sound = max(candidates, key=candidates.get)
        best_confidence = candidates[best_sound]

        info = get_sound_info(best_sound)

        probs = {cls: 0.01 for cls in self.classes}
        for k, v in candidates.items():
            probs[k] = round(v, 4)
        probs[best_sound] = round(best_confidence, 4)

        return {
            "sound": best_sound,
            "sound_name": info["name"],
            "category": info["category"],
            "priority": info["priority"],
            "confidence": round(float(best_confidence), 4),
            "is_detected": True,
            "icon": info["icon"],
            "voice_phrase": info["voice_phrase"],
            "color": info["color"],
            "can_escalate": info["can_escalate"],
            "probabilities": probs,
            "rms": round(float(rms), 4)
        }

    def _build_ambient_result(self, rms: float, confidence: float = 0.95) -> Dict[str, Any]:
        """Construct a standardized ambient / normal environment response."""
        return {
            "sound": "ambient",
            "sound_name": "Ambient / Quiet",
            "category": "normal",
            "priority": "none",
            "confidence": round(confidence, 4),
            "is_detected": False,
            "icon": "🎧",
            "voice_phrase": "",
            "color": "#64748b",
            "can_escalate": False,
            "probabilities": {cls: 0.01 for cls in self.classes},
            "rms": round(float(rms), 4)
        }
