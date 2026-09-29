package com.safesphere.soundguard;

import android.content.Context;
import android.util.Log;

/**
 * SoundGuard - Centralized Alert Manager
 * Architecture:
 * SoundDetector / TestPopup / QuickTest
 *       ↓
 * DetectionResult
 *       ↓
 * AlertManager
 *       ├── VisualAlertManager (UI popup callback)
 *       ├── NotificationManager (Native Android Notification)
 *       ├── VoiceAlertManager (Android TextToSpeech)
 *       └── HistoryRepository (Native SQLite Database)
 */
public class AlertManager {

    private static final String TAG = "SoundGuard-Alert";
    private static AlertManager instance;

    public interface VisualAlertListener {
        void onVisualAlert(DetectionResult result);
    }

    private final Context context;
    private final NotificationHelper notificationHelper;
    private final VoiceAlertManager voiceAlertManager;
    private final HistoryRepository historyRepository;
    private VisualAlertListener visualAlertListener;

    // Cooldown tracking to eliminate duplicate alert fatigue (5000 ms cooldown)
    private final java.util.Map<String, Long> lastAlertTimestamps = new java.util.concurrent.ConcurrentHashMap<>();
    public static final long ALERT_COOLDOWN_MS = 5000L;

    public static synchronized AlertManager getInstance(Context context) {
        if (instance == null) {
            instance = new AlertManager(context.getApplicationContext());
        }
        return instance;
    }

    private AlertManager(Context context) {
        this.context = context;
        this.notificationHelper = new NotificationHelper(context);
        this.voiceAlertManager = new VoiceAlertManager(context);
        this.historyRepository = new HistoryRepository(context);
        Log.d(TAG, "Centralized AlertManager initialized");
    }

    public void setVisualAlertListener(VisualAlertListener listener) {
        this.visualAlertListener = listener;
    }

    public NotificationHelper getNotificationHelper() {
        return notificationHelper;
    }

    public VoiceAlertManager getVoiceAlertManager() {
        return voiceAlertManager;
    }

    public HistoryRepository getHistoryRepository() {
        return historyRepository;
    }

    /**
     * Unified Alert Pipeline entry point.
     * Real Detection, Test Popup, and Quick Test ALL pass through here!
     */
    public synchronized DetectionResult triggerAlert(String soundId, float confidence, String source) {
        long now = System.currentTimeMillis();

        // Enforce cooldown unless it's an explicit manual test
        boolean isManualTest = "Test Popup".equalsIgnoreCase(source) || "Quick Test".equalsIgnoreCase(source);
        if (!isManualTest) {
            Long lastTime = lastAlertTimestamps.get(soundId);
            if (lastTime != null && (now - lastTime < ALERT_COOLDOWN_MS)) {
                Log.d(TAG, "Alert for " + soundId + " suppressed by cooldown (" + (now - lastTime) + "ms < " + ALERT_COOLDOWN_MS + "ms)");
                return null;
            }
        }
        lastAlertTimestamps.put(soundId, now);

        Log.d("SoundGuard-Alert", "Dangerous sound detected: " + soundId + ", confidence=" + confidence + ", source=" + source);
        Log.d("SoundGuard-Alert", "Triggering alert pipeline");

        // 1. Construct unified DetectionResult
        DetectionResult result = new DetectionResult(soundId, confidence, source);

        // 2. Persist to SQLite History Database
        historyRepository.addDetection(result);
        Log.d("SoundGuard-History", "Detection saved to SQLite: " + result.soundName + " (" + result.confidencePercent + "%, " + result.dangerLevel + ")");

        // 3. Post Native System Notification
        notificationHelper.showDangerAlertNotification(result);

        // 4. Speak Native TextToSpeech Voice Alert
        voiceAlertManager.speak(result.voicePhrase);

        // 5. Dispatch Visual Alert to In-App UI Pop-up
        if (visualAlertListener != null) {
            try {
                visualAlertListener.onVisualAlert(result);
            } catch (Exception e) {
                Log.e(TAG, "Error in VisualAlertListener callback", e);
            }
        }

        // 6. For Test Popup, also launch native AlertDetailsActivity directly to guarantee instant visible popup
        if ("Test Popup".equalsIgnoreCase(source)) {
            notificationHelper.launchAlertDetailsDirect(result);
        }

        Log.d(TAG, "Alert pipeline finished for: " + result.soundName + " (Source: " + source + ")");
        return result;
    }

    /**
     * Test Popup execution: Simulates Fire Alarm detection with 0.92 confidence
     */
    public DetectionResult triggerTestPopup() {
        Log.d(TAG, "Triggering Test Popup...");
        return triggerAlert("fire_alarm", 0.92f, "Test Popup");
    }

    /**
     * Quick Test execution for any specific sound
     */
    public DetectionResult triggerQuickTest(String soundId) {
        Log.d(TAG, "Triggering Quick Test for: " + soundId);
        float testConf = 0.94f;
        if ("fire_alarm".equals(soundId) || "glass_breaking".equals(soundId)) {
            testConf = 0.98f;
        } else if ("siren".equals(soundId) || "car_horn".equals(soundId)) {
            testConf = 0.96f;
        }
        return triggerAlert(soundId, testConf, "Quick Test");
    }
}
