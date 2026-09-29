package com.safesphere.soundguard;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * SoundGuard - Unified Detection Result
 * Common model passed through the alert pipeline (Detector, Test Popup, Quick Test)
 * to AlertManager, Notification, TTS, and History.
 */
public class DetectionResult {
    public long id;
    public final String soundId;
    public final String soundName;
    public final String category;
    public final String dangerLevel; // "high", "medium", "low"
    public final float confidence;
    public final int confidencePercent;
    public final String icon;
    public final String voicePhrase;
    public final String action;
    public final long timestamp;
    public final String dateStr;
    public final String timeStr;
    public final String source; // "Microphone", "Test Popup", "Quick Test"

    public DetectionResult(String soundId, float confidence, String source) {
        SoundClasses.Definition def = SoundClasses.get(soundId);
        this.soundId = def.id;
        this.soundName = def.name;
        this.category = def.category;
        this.dangerLevel = def.dangerLevel;
        this.confidence = Math.max(0.5f, Math.min(0.99f, confidence));
        this.confidencePercent = Math.round(this.confidence * 100);
        this.icon = def.icon;
        this.voicePhrase = def.voicePhrase;
        this.action = def.action;
        this.timestamp = System.currentTimeMillis();
        this.source = source != null ? source : "Microphone";

        Date date = new Date(this.timestamp);
        SimpleDateFormat dateFormat = new SimpleDateFormat("dd MMM yyyy", Locale.getDefault());
        SimpleDateFormat timeFormat = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        this.dateStr = dateFormat.format(date);
        this.timeStr = timeFormat.format(date);
    }

    public DetectionResult(long id, String soundId, String soundName, String category,
                           String dangerLevel, float confidence, int confidencePercent,
                           String icon, String voicePhrase, String action, long timestamp,
                           String dateStr, String timeStr, String source) {
        this.id = id;
        this.soundId = soundId;
        this.soundName = soundName;
        this.category = category;
        this.dangerLevel = dangerLevel;
        this.confidence = confidence;
        this.confidencePercent = confidencePercent;
        this.icon = icon;
        this.voicePhrase = voicePhrase;
        this.action = action;
        this.timestamp = timestamp;
        this.dateStr = dateStr;
        this.timeStr = timeFormatFallback(timestamp, timeStr);
        this.source = source != null ? source : "Microphone";
    }

    private static String timeFormatFallback(long ts, String existing) {
        if (existing != null && !existing.isEmpty()) return existing;
        return new SimpleDateFormat("hh:mm a", Locale.getDefault()).format(new Date(ts));
    }

    public JSONObject toJsonObject() {
        JSONObject obj = new JSONObject();
        try {
            obj.put("id", id > 0 ? id : System.currentTimeMillis());
            obj.put("sound_id", soundId);
            obj.put("sound_name", soundName);
            obj.put("category", category);
            obj.put("priority", dangerLevel);
            obj.put("danger_level", dangerLevel.toUpperCase());
            obj.put("confidence", confidence);
            obj.put("confidence_percent", confidencePercent);
            obj.put("icon", icon);
            obj.put("voice_phrase", voicePhrase);
            obj.put("action", action);
            obj.put("timestamp", timestamp / 1000.0);
            obj.put("date_str", dateStr);
            obj.put("time_str", timeStr);
            obj.put("source", source);

            // Pop-up styling metadata
            JSONObject theme = new JSONObject();
            boolean isHigh = "high".equalsIgnoreCase(dangerLevel);
            boolean isMedium = "medium".equalsIgnoreCase(dangerLevel);
            theme.put("badge_text", isHigh ? "🚨 DANGER DETECTED" : (isMedium ? "⚠️ IMPORTANT SOUND" : "ℹ️ SOUND DETECTED"));
            theme.put("bg_color", isHigh ? "#dc2626" : (isMedium ? "#d97706" : "#ca8a04"));
            theme.put("border_color", isHigh ? "#ef4444" : (isMedium ? "#f59e0b" : "#eab308"));
            theme.put("glow_color", isHigh ? "rgba(239, 68, 68, 0.7)" : "rgba(245, 158, 11, 0.5)");
            theme.put("flash_screen", isHigh);
            obj.put("theme", theme);
            obj.put("can_escalate", isHigh);
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return obj;
    }
}
