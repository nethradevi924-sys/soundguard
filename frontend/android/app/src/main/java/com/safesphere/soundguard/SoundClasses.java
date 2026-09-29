package com.safesphere.soundguard;

import java.util.HashMap;
import java.util.Map;

/**
 * SoundGuard - Centralized Sound Classes and Definitions
 * 
 * Defines the authoritative 14 sound classes (13 target hazards + Background/Unknown),
 * fixed integer model indices (0-13), danger levels, icons, voice phrases, and action guidance.
 */
public class SoundClasses {

    public static final int NUM_CLASSES = 14;

    public static class Definition {
        public final int index;
        public final String id;
        public final String name;
        public final String category; // "emergency", "environmental", "household"
        public final String dangerLevel; // "high", "medium", "low"
        public final String icon;
        public final String voicePhrase;
        public final String action;

        public Definition(int index, String id, String name, String category, String dangerLevel,
                          String icon, String voicePhrase, String action) {
            this.index = index;
            this.id = id;
            this.name = name;
            this.category = category;
            this.dangerLevel = dangerLevel;
            this.icon = icon;
            this.voicePhrase = voicePhrase;
            this.action = action;
        }
    }

    private static final Map<String, Definition> DEFINITIONS = new HashMap<>();
    private static final Map<Integer, Definition> BY_INDEX = new HashMap<>();

    static {
        // EMERGENCY (Indices 0 - 3)
        register(new Definition(0, "fire_alarm", "Fire Alarm", "emergency", "high",
                "🔥", "Warning. Fire alarm detected.", "Please evacuate immediately and move to safety."));
        register(new Definition(1, "siren", "Siren", "emergency", "high",
                "🚨", "Warning. Siren detected.", "Move to a safe location away from road or hazard."));
        register(new Definition(2, "security_alarm", "Alarm", "emergency", "high",
                "🚨", "Warning. Alarm sounding.", "Check property perimeter and seek safety."));
        register(new Definition(3, "distress_shouting", "Distress Shouting", "emergency", "high",
                "🗣️", "Warning. Distress shouting detected.", "Check on individual or contact emergency assistance."));

        // ENVIRONMENTAL (Indices 4 - 8)
        register(new Definition(4, "car_horn", "Car Horn", "environmental", "medium",
                "🚗", "Car horn detected nearby.", "Watch out for approaching vehicle traffic."));
        register(new Definition(5, "train", "Train", "environmental", "medium",
                "🚆", "Train approach detected.", "Stay completely clear of railway tracks."));
        register(new Definition(6, "motorcycle", "Motorcycle", "environmental", "medium",
                "🏍️", "Motorcycle approaching.", "Be aware of nearby vehicle traffic."));
        register(new Definition(7, "dog_barking", "Dog Barking", "environmental", "low",
                "🐕", "Dog barking detected.", "Notice nearby animal activity."));
        register(new Definition(8, "construction_noise", "Construction", "environmental", "low",
                "🔨", "Construction noise detected.", "Expect ongoing mechanical sound."));

        // HOUSEHOLD (Indices 9 - 12)
        register(new Definition(9, "glass_breaking", "Glass Breaking", "household", "high",
                "🪟", "Warning. Glass breaking detected.", "Check windows and doors for hazards."));
        register(new Definition(10, "door_knocking", "Door Knocking", "household", "low",
                "🚪", "Door knocking detected.", "Someone is at the door."));
        register(new Definition(11, "baby_crying", "Baby Crying", "household", "medium",
                "👶", "Baby crying detected.", "Check on infant immediately."));
        register(new Definition(12, "doorbell", "Doorbell", "household", "medium",
                "🔔", "Doorbell ringing.", "A visitor is waiting at the entrance."));

        // BACKGROUND / UNKNOWN (Index 13)
        register(new Definition(13, "ambient", "Background / Unknown", "environmental", "low",
                "🎧", "", "Normal room audio. No dangerous sound detected."));
    }

    private static void register(Definition def) {
        DEFINITIONS.put(def.id, def);
        BY_INDEX.put(def.index, def);
    }

    public static Definition get(String soundId) {
        Definition def = DEFINITIONS.get(soundId);
        if (def != null) {
            return def;
        }
        return new Definition(-1, soundId, soundId.replace("_", " "), "environmental", "medium",
                "🔊", "Sound detected: " + soundId, "Please check your surroundings.");
    }

    public static Definition getByIndex(int index) {
        Definition def = BY_INDEX.get(index);
        if (def != null) {
            return def;
        }
        return get("ambient");
    }

    public static String getSoundName(String soundId) {
        return get(soundId).name;
    }

    public static int getClassIndex(String soundId) {
        Definition def = DEFINITIONS.get(soundId);
        return def != null ? def.index : 13;
    }

    public static Map<String, Definition> getAll() {
        return new HashMap<>(DEFINITIONS);
    }
}
