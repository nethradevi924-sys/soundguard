"""SoundGuard - Visual Pop-up Alert Formatter.

Formats clear, high-contrast, accessible visual notifications
adhering to accessibility requirements for hearing-impaired users:
- Large font titles
- High contrast color schemes
- Prominent icons
- Screen flash triggers for High Priority emergencies
"""

from typing import Dict, Any
from datetime import datetime
from ai.labels.categories import get_sound_info, PRIORITY_HIGH, PRIORITY_MEDIUM, PRIORITY_LOW


class VisualAlertFormatter:
    """Formats visual alert payloads with priority styling and accessibility metadata."""

    PRIORITY_THEMES = {
        PRIORITY_HIGH: {
            "badge_text": "🚨 DANGER DETECTED",
            "bg_color": "#dc2626",        # Rich Alert Red
            "border_color": "#ef4444",
            "text_color": "#ffffff",
            "glow_color": "rgba(239, 68, 68, 0.6)",
            "flash_screen": True,
            "escalation_eligible": True,
            "badge_bg": "#991b1b"
        },
        PRIORITY_MEDIUM: {
            "badge_text": "⚠️ IMPORTANT SOUND",
            "bg_color": "#d97706",        # Amber / Orange
            "border_color": "#f59e0b",
            "text_color": "#ffffff",
            "glow_color": "rgba(245, 158, 11, 0.5)",
            "flash_screen": False,
            "escalation_eligible": False,
            "badge_bg": "#92400e"
        },
        PRIORITY_LOW: {
            "badge_text": "ℹ️ SOUND DETECTED",
            "bg_color": "#ca8a04",        # Warm Yellow / Olive
            "border_color": "#eab308",
            "text_color": "#ffffff",
            "glow_color": "rgba(234, 179, 8, 0.4)",
            "flash_screen": False,
            "escalation_eligible": False,
            "badge_bg": "#854d0e"
        }
    }

    @classmethod
    def format_alert(
        cls,
        sound_id: str,
        confidence: float,
        timestamp: float = None,
        priority_override: str = None
    ) -> Dict[str, Any]:
        """Generate a complete visual alert payload."""
        info = get_sound_info(sound_id)
        priority = priority_override or info.get("priority", PRIORITY_LOW)
        theme = cls.PRIORITY_THEMES.get(priority, cls.PRIORITY_THEMES[PRIORITY_LOW])

        dt = datetime.fromtimestamp(timestamp) if timestamp else datetime.now()
        formatted_time = dt.strftime("%I:%M:%S %p")
        formatted_date = dt.strftime("%B %d, %Y")

        sound_name_upper = info["name"].upper()
        main_headline = f"{sound_name_upper} DETECTED"

        return {
            "id": f"alert_{int(dt.timestamp() * 1000)}",
            "sound_id": sound_id,
            "sound_name": info["name"],
            "headline": main_headline,
            "category": info["category"],
            "priority": priority,
            "icon": info["icon"],
            "confidence": round(confidence, 4),
            "confidence_percent": int(confidence * 100),
            "time_str": formatted_time,
            "date_str": formatted_date,
            "timestamp": dt.timestamp(),
            "theme": theme,
            "description": info.get("description", ""),
            "voice_phrase": info.get("voice_phrase", f"{info['name']} detected."),
            "acknowledge_required": priority == PRIORITY_HIGH,
            "can_escalate": info.get("can_escalate", False) and (priority == PRIORITY_HIGH)
        }
