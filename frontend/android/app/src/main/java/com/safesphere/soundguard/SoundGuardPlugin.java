package com.safesphere.soundguard;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * SoundGuard - Capacitor Native Android Plugin
 * Bridges web UI to native AudioRecord, ML SoundClassifier, AlertManager,
 * TextToSpeech, System Notifications, and SQLite History Repository.
 */
@CapacitorPlugin(
        name = "SoundGuard",
        permissions = {
                @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "microphone"),
                @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")
        }
)
public class SoundGuardPlugin extends Plugin implements AlertManager.VisualAlertListener {

    private static final String TAG = "SoundGuard";
    private AlertManager alertManager;
    private AudioCaptureService standaloneCaptureService;

    @Override
    public void load() {
        super.load();
        this.alertManager = AlertManager.getInstance(getContext());
        this.alertManager.setVisualAlertListener(this);

        // Forward real-time telemetry (dB, prediction, confidence, latency, top 5) to webview
        SoundMonitoringService.setGlobalTelemetryListener(new SoundMonitoringService.GlobalTelemetryListener() {
            @Override
            public void onTelemetry(int db, String prediction, int confidencePercent, float latencyMs, List<SoundClassifier.Prediction> top5) {
                try {
                    JSObject data = new JSObject();
                    data.put("db", db);
                    data.put("prediction", prediction);
                    data.put("confidencePercent", confidencePercent);
                    data.put("latencyMs", latencyMs);

                    JSArray top5Arr = new JSArray();
                    if (top5 != null) {
                        for (SoundClassifier.Prediction p : top5) {
                            JSObject item = new JSObject();
                            item.put("index", p.index);
                            item.put("id", p.id);
                            item.put("name", p.name);
                            item.put("confidence", p.confidence);
                            item.put("confidencePercent", p.confidencePercent);
                            top5Arr.put(item);
                        }
                    }
                    data.put("top5", top5Arr);
                    notifyListeners("onAudioTelemetry", data);
                } catch (Exception e) {
                    Log.w(TAG, "Error notifying telemetry", e);
                }
            }
        });

        Log.d(TAG, "SoundGuardPlugin loaded into Capacitor bridge");
    }

    @Override
    public void onVisualAlert(DetectionResult result) {
        if (result == null) return;
        try {
            JSObject jsData = JSObject.fromJSONObject(result.toJsonObject());
            Log.d(TAG, "Dispatching onAlertTriggered event to webview: " + result.soundName);
            notifyListeners("onAlertTriggered", jsData);
        } catch (Exception e) {
            Log.e(TAG, "Error notifying listeners of alert", e);
        }
    }

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        Log.d(TAG, "startMonitoring requested from UI");

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "RECORD_AUDIO not granted. Requesting permission...");
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }

        try {
            SoundMonitoringService.start(getContext());

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("status", "MONITORING");
            ret.put("message", "Microphone monitoring started in foreground");
            call.resolve(ret);
            Log.d(TAG, "Monitoring started successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start monitoring", e);
            call.reject("Failed to start monitoring: " + e.getMessage(), e);
        }
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Microphone permission granted via callback. Starting monitoring...");
            startMonitoring(call);
        } else {
            Log.e(TAG, "Microphone permission DENIED by user");
            call.reject("Microphone permission was denied. Cannot start audio monitoring.");
        }
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        Log.d(TAG, "stopMonitoring requested from UI");
        try {
            SoundMonitoringService.stop(getContext());

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("status", "IDLE");
            call.resolve(ret);
            Log.d(TAG, "Monitoring stopped successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop monitoring", e);
            call.reject("Failed to stop monitoring: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void testPopup(PluginCall call) {
        Log.d(TAG, "testPopup invoked from UI");
        try {
            DetectionResult result = alertManager.triggerTestPopup();
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("alert", JSObject.fromJSONObject(result.toJsonObject()));
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error executing testPopup", e);
            call.reject("Test popup failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void quickTest(PluginCall call) {
        String soundId = call.getString("soundId", "fire_alarm");
        Log.d(TAG, "quickTest invoked from UI for: " + soundId);
        try {
            DetectionResult result = alertManager.triggerQuickTest(soundId);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("alert", JSObject.fromJSONObject(result.toJsonObject()));
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error executing quickTest", e);
            call.reject("Quick test failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void recordAndTestRealWorld(PluginCall call) {
        Log.d(TAG, "recordAndTestRealWorld invoked from UI");

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "RECORD_AUDIO not granted for recordAndTest");
            call.reject("Microphone permission not granted");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    int durationSeconds = 3;
                    int sampleRate = 16000;
                    int targetSamples = durationSeconds * sampleRate; // 48000
                    short[] fullAudio = new short[targetSamples];

                    boolean isMonitoring = SoundMonitoringService.isRunning();
                    SoundMonitoringService serviceInstance = SoundMonitoringService.getInstance();

                    if (isMonitoring && serviceInstance != null && serviceInstance.getAudioCaptureService() != null) {
                        Log.d(TAG, "Collecting 3s samples from running AudioCaptureService...");
                        final CountDownLatch latch = new CountDownLatch(1);
                        final int[] collected = new int[]{0};

                        AudioCaptureService.SampleSink sink = new AudioCaptureService.SampleSink() {
                            @Override
                            public void onSamples(short[] samples, int count) {
                                if (collected[0] < targetSamples) {
                                    int copyLen = Math.min(count, targetSamples - collected[0]);
                                    System.arraycopy(samples, 0, fullAudio, collected[0], copyLen);
                                    collected[0] += copyLen;
                                    if (collected[0] >= targetSamples) {
                                        latch.countDown();
                                    }
                                }
                            }
                        };

                        serviceInstance.getAudioCaptureService().setSampleSink(sink);
                        boolean ok = latch.await(3800, TimeUnit.MILLISECONDS);
                        serviceInstance.getAudioCaptureService().setSampleSink(null);

                        if (!ok && collected[0] < 16000) {
                            Log.w(TAG, "Audio collection timed out with only " + collected[0] + " samples");
                        }
                    } else {
                        Log.d(TAG, "Recording 3s samples directly via AudioRecord...");
                        short[] recorded = AudioCaptureService.recordDirect(3000);
                        if (recorded != null && recorded.length > 0) {
                            System.arraycopy(recorded, 0, fullAudio, 0, Math.min(recorded.length, fullAudio.length));
                        }
                    }

                    // Process with SoundClassifier
                    SoundClassifier classifier = new SoundClassifier();
                    int windowSize = 16000;
                    int hopSize = 4000;

                    SoundClassifier.Classification bestResult = null;
                    float maxDangerConfidence = -1.0f;
                    float maxRms = 0;

                    for (int start = 0; start + windowSize <= fullAudio.length; start += hopSize) {
                        short[] win = new short[windowSize];
                        System.arraycopy(fullAudio, start, win, 0, windowSize);
                        SoundClassifier.Classification c = classifier.classify(win, windowSize);
                        if (c.rms > maxRms) maxRms = c.rms;

                        if (c.isDanger && c.confidence > maxDangerConfidence) {
                            maxDangerConfidence = c.confidence;
                            bestResult = c;
                        } else if (bestResult == null || (!bestResult.isDanger && c.confidence > bestResult.confidence)) {
                            if (maxDangerConfidence < 0) {
                                bestResult = c;
                            }
                        }
                    }

                    if (bestResult == null) {
                        bestResult = classifier.classify(fullAudio, Math.min(16000, fullAudio.length));
                    }

                    int db = maxRms > 0.0001f ? Math.min(110, Math.max(30, (int) (20 * Math.log10(maxRms * 32768.0f) + 20))) : 30;

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("soundId", bestResult.soundId);
                    ret.put("soundName", bestResult.soundName);
                    ret.put("confidence", bestResult.confidence);
                    ret.put("confidencePercent", bestResult.confidencePercent);
                    ret.put("isDanger", bestResult.isDanger);
                    ret.put("db", db);

                    JSArray top5Arr = new JSArray();
                    if (bestResult.topPredictions != null) {
                        for (SoundClassifier.Prediction p : bestResult.topPredictions) {
                            JSObject item = new JSObject();
                            item.put("index", p.index);
                            item.put("id", p.id);
                            item.put("name", p.name);
                            item.put("confidence", p.confidence);
                            item.put("confidencePercent", p.confidencePercent);
                            top5Arr.put(item);
                        }
                    }
                    ret.put("top5", top5Arr);

                    // If dangerous, trigger alert pipeline so it appears in history and shows popup
                    if (bestResult.isDanger) {
                        alertManager.triggerAlert(bestResult.soundId, bestResult.confidence, "RealWorldTest");
                    }

                    Log.d(TAG, "recordAndTestRealWorld complete: " + bestResult.soundName + " (" + bestResult.confidencePercent + "%)");
                    call.resolve(ret);

                } catch (Exception e) {
                    Log.e(TAG, "Error in recordAndTestRealWorld", e);
                    call.reject("Real-world audio test failed: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    @PluginMethod
    public void getHistory(PluginCall call) {
        int limit = call.getInt("limit", 100);
        try {
            List<DetectionResult> history = alertManager.getHistoryRepository().getAll(limit);
            JSArray arr = new JSArray();
            for (DetectionResult r : history) {
                arr.put(JSObject.fromJSONObject(r.toJsonObject()));
            }
            JSObject ret = new JSObject();
            ret.put("history", arr);
            ret.put("count", history.size());
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error fetching history", e);
            call.reject("Failed to load history: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void clearHistory(PluginCall call) {
        try {
            alertManager.getHistoryRepository().clearAll();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error clearing history", e);
            call.reject("Failed to clear history: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        boolean micGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
        boolean notifGranted = alertManager.getNotificationHelper().hasNotificationPermission();
        boolean voiceReady = alertManager.getVoiceAlertManager().isReady();
        boolean isMonitoring = SoundMonitoringService.isRunning();

        JSObject ret = new JSObject();
        ret.put("isMonitoring", isMonitoring);
        ret.put("micPermission", micGranted);
        ret.put("notificationPermission", notifGranted);
        ret.put("voiceReady", voiceReady);
        ret.put("modelReady", true);
        ret.put("isNative", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAllPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(call);
        } else {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
        }
    }
}
