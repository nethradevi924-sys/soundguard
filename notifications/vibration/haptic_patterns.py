"""SoundGuard - Haptic Vibration Patterns.

Defines accessibility vibration patterns (in milliseconds [vibrate, pause, vibrate...])
for mobile and Edge AI devices supporting the Web Vibration API (navigator.vibrate).
"""

from typing import Dict, List, Any
from ai.labels.categories import PRIORITY_HIGH, PRIORITY_MEDIUM, PRIORITY_LOW

# Vibration pulses [vibrate_ms, pause_ms, vibrate_ms, ...]
VIBRATION_PATTERNS: Dict[str, List[int]] = {
    # Emergency / High Priority: Urgent, intense, repeating vibration
    PRIORITY_HIGH: [400, 150, 400, 150, 600, 200, 600],

    # Medium Priority: Moderate double-pulse
    PRIORITY_MEDIUM: [250, 120, 250],

    # Low Priority: Gentle single tap
    PRIORITY_LOW: [150],

    # Specific Sound Overrides
    "fire_alarm": [500, 150, 500, 150, 800, 200, 800],
    "siren": [400, 150, 400, 150, 600, 200, 600],
    "glass_breaking": [300, 80, 500, 80, 700],
    "doorbell": [200, 100, 300],
    "car_horn": [350, 150, 350],
    "baby_crying": [300, 120, 300, 120, 300],
}


def get_vibration_pattern(sound_id: str, priority: str = PRIORITY_LOW) -> List[int]:
    """Retrieve haptic vibration pattern for a given sound or priority."""
    if sound_id in VIBRATION_PATTERNS:
        return VIBRATION_PATTERNS[sound_id]
    return VIBRATION_PATTERNS.get(priority, VIBRATION_PATTERNS[PRIORITY_LOW])
