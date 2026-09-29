"""SoundGuard - Voice Alert & Text-to-Speech Engine.

Generates concise, natural speech announcements for detected environmental sounds:
- "Fire alarm detected."
- "Emergency siren detected."
- "Car horn detected nearby."
- "Glass breaking detected."
- "Doorbell ringing."
"""

from typing import Dict, Any, Optional
from ai.labels.categories import get_sound_info


class VoiceAlertEngine:
    """Manages voice alert synthesis parameters and formatting."""

    def __init__(self, speech_rate: float = 1.0, pitch: float = 1.0, volume: float = 1.0):
        self.speech_rate = speech_rate
        self.pitch = pitch
        self.volume = volume

    def generate_speech_payload(self, sound_id: str, confidence_percent: int = 90) -> Dict[str, Any]:
        """Generate parameters for Text-to-Speech execution."""
        info = get_sound_info(sound_id)
        phrase = info.get("voice_phrase", f"{info['name']} detected.")
        priority = info.get("priority", "low")

        # High priority sounds speak with slightly higher urgency/pitch
        effective_pitch = 1.15 if priority == "high" else self.pitch
        effective_rate = 1.05 if priority == "high" else self.speech_rate

        return {
            "sound_id": sound_id,
            "sound_name": info["name"],
            "spoken_text": phrase,
            "priority": priority,
            "rate": effective_rate,
            "pitch": effective_pitch,
            "volume": self.volume,
            "lang": "en-US"
        }
