"""SoundGuard - Sound Categories and Metadata Specification.

Defines all 13 supported sound classes across 3 major categories:
- Emergency Sounds (High Priority)
- Environmental Sounds (Medium / Low Priority)
- Household Sounds (High / Medium / Low Priority)
"""

from typing import Dict, Any, List

# Categories
CATEGORY_EMERGENCY = "emergency"
CATEGORY_ENVIRONMENTAL = "environmental"
CATEGORY_HOUSEHOLD = "household"

# Priorities
PRIORITY_HIGH = "high"
PRIORITY_MEDIUM = "medium"
PRIORITY_LOW = "low"

# Sound Classes Definition
SOUND_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    # Emergency Sounds
    "fire_alarm": {
        "id": "fire_alarm",
        "name": "Fire Alarm",
        "category": CATEGORY_EMERGENCY,
        "priority": PRIORITY_HIGH,
        "icon": "🔥",
        "voice_phrase": "Fire alarm detected.",
        "description": "High-pitched repeating emergency alarm pattern",
        "cooldown_seconds": 8.0,
        "danger_level": 5,
        "color": "#ef4444",
        "can_escalate": True
    },
    "siren": {
        "id": "siren",
        "name": "Siren",
        "category": CATEGORY_EMERGENCY,
        "priority": PRIORITY_HIGH,
        "icon": "🚨",
        "voice_phrase": "Emergency siren detected.",
        "description": "Ambulance, police, or emergency vehicle wail",
        "cooldown_seconds": 8.0,
        "danger_level": 5,
        "color": "#ef4444",
        "can_escalate": True
    },
    "security_alarm": {
        "id": "security_alarm",
        "name": "Security Alarm",
        "category": CATEGORY_EMERGENCY,
        "priority": PRIORITY_HIGH,
        "icon": "🚨",
        "voice_phrase": "Security alarm sounding.",
        "description": "Burglar alarm or building evacuation alarm",
        "cooldown_seconds": 8.0,
        "danger_level": 4,
        "color": "#f97316",
        "can_escalate": True
    },
    "distress_shouting": {
        "id": "distress_shouting",
        "name": "Distress Shouting",
        "category": CATEGORY_EMERGENCY,
        "priority": PRIORITY_HIGH,
        "icon": "🆘",
        "voice_phrase": "Distress shouting detected.",
        "description": "Human scream, help shout, or panicked cries",
        "cooldown_seconds": 6.0,
        "danger_level": 5,
        "color": "#ef4444",
        "can_escalate": True
    },

    # Household Sounds (Glass Breaking is High Priority per requirements)
    "glass_breaking": {
        "id": "glass_breaking",
        "name": "Glass Breaking",
        "category": CATEGORY_HOUSEHOLD,
        "priority": PRIORITY_HIGH,
        "icon": "🪟",
        "voice_phrase": "Glass breaking detected.",
        "description": "Sharp high-frequency glass shattering impact",
        "cooldown_seconds": 5.0,
        "danger_level": 4,
        "color": "#ef4444",
        "can_escalate": True
    },
    "doorbell": {
        "id": "doorbell",
        "name": "Doorbell",
        "category": CATEGORY_HOUSEHOLD,
        "priority": PRIORITY_MEDIUM,
        "icon": "🔔",
        "voice_phrase": "Doorbell ringing.",
        "description": "Two-tone chime or electronic chime",
        "cooldown_seconds": 6.0,
        "danger_level": 2,
        "color": "#f59e0b",
        "can_escalate": False
    },
    "baby_crying": {
        "id": "baby_crying",
        "name": "Baby Crying",
        "category": CATEGORY_HOUSEHOLD,
        "priority": PRIORITY_MEDIUM,
        "icon": "👶",
        "voice_phrase": "Baby crying detected.",
        "description": "Infant crying or wailing acoustics",
        "cooldown_seconds": 6.0,
        "danger_level": 3,
        "color": "#f59e0b",
        "can_escalate": False
    },
    "door_knocking": {
        "id": "door_knocking",
        "name": "Door Knocking",
        "category": CATEGORY_HOUSEHOLD,
        "priority": PRIORITY_LOW,
        "icon": "🚪",
        "voice_phrase": "Door knocking detected.",
        "description": "Rhythmic low-frequency wood/surface knocking",
        "cooldown_seconds": 4.0,
        "danger_level": 1,
        "color": "#eab308",
        "can_escalate": False
    },

    # Environmental Sounds
    "car_horn": {
        "id": "car_horn",
        "name": "Car Horn",
        "category": CATEGORY_ENVIRONMENTAL,
        "priority": PRIORITY_MEDIUM,
        "icon": "🚗",
        "voice_phrase": "Car horn detected nearby.",
        "description": "Automotive horn blast",
        "cooldown_seconds": 5.0,
        "danger_level": 3,
        "color": "#f59e0b",
        "can_escalate": False
    },
    "train": {
        "id": "train",
        "name": "Train",
        "category": CATEGORY_ENVIRONMENTAL,
        "priority": PRIORITY_MEDIUM,
        "icon": "🚆",
        "voice_phrase": "Train noise detected.",
        "description": "Train horn or rhythmic rail rumble",
        "cooldown_seconds": 10.0,
        "danger_level": 3,
        "color": "#f59e0b",
        "can_escalate": False
    },
    "motorcycle": {
        "id": "motorcycle",
        "name": "Motorcycle",
        "category": CATEGORY_ENVIRONMENTAL,
        "priority": PRIORITY_MEDIUM,
        "icon": "🏍️",
        "voice_phrase": "Motorcycle passing nearby.",
        "description": "Rapid acceleration engine revving",
        "cooldown_seconds": 5.0,
        "danger_level": 2,
        "color": "#f59e0b",
        "can_escalate": False
    },
    "dog_barking": {
        "id": "dog_barking",
        "name": "Dog Barking",
        "category": CATEGORY_ENVIRONMENTAL,
        "priority": PRIORITY_LOW,
        "icon": "🐕",
        "voice_phrase": "Dog barking detected.",
        "description": "Canine barking or woofing sequence",
        "cooldown_seconds": 4.0,
        "danger_level": 1,
        "color": "#eab308",
        "can_escalate": False
    },
    "construction_noise": {
        "id": "construction_noise",
        "name": "Construction Noise",
        "category": CATEGORY_ENVIRONMENTAL,
        "priority": PRIORITY_LOW,
        "icon": "🔨",
        "voice_phrase": "Construction noise nearby.",
        "description": "Hammering, drilling, or jackhammering",
        "cooldown_seconds": 10.0,
        "danger_level": 1,
        "color": "#eab308",
        "can_escalate": False
    }
}

SOUND_CLASSES: List[str] = list(SOUND_DEFINITIONS.keys())


def get_sound_info(sound_id: str) -> Dict[str, Any]:
    """Retrieve metadata for a specific sound identifier."""
    if sound_id in SOUND_DEFINITIONS:
        return SOUND_DEFINITIONS[sound_id]
    return {
        "id": sound_id,
        "name": sound_id.replace("_", " ").title(),
        "category": CATEGORY_ENVIRONMENTAL,
        "priority": PRIORITY_LOW,
        "icon": "🔊",
        "voice_phrase": f"{sound_id.replace('_', ' ').title()} detected.",
        "description": "Environmental sound",
        "cooldown_seconds": 5.0,
        "danger_level": 1,
        "color": "#64748b",
        "can_escalate": False
    }


def get_all_sounds() -> List[Dict[str, Any]]:
    """Return list of all sound specifications."""
    return list(SOUND_DEFINITIONS.values())
