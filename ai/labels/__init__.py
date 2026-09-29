"""AI labels package for SoundGuard."""
from .categories import (
    CATEGORY_EMERGENCY,
    CATEGORY_ENVIRONMENTAL,
    CATEGORY_HOUSEHOLD,
    PRIORITY_HIGH,
    PRIORITY_MEDIUM,
    PRIORITY_LOW,
    SOUND_DEFINITIONS,
    SOUND_CLASSES,
    get_sound_info,
    get_all_sounds,
)

__all__ = [
    "CATEGORY_EMERGENCY",
    "CATEGORY_ENVIRONMENTAL",
    "CATEGORY_HOUSEHOLD",
    "PRIORITY_HIGH",
    "PRIORITY_MEDIUM",
    "PRIORITY_LOW",
    "SOUND_DEFINITIONS",
    "SOUND_CLASSES",
    "get_sound_info",
    "get_all_sounds",
]
