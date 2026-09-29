package com.safesphere.soundguard;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.content.ContextCompat;

/**
 * SoundGuard - Foreground Monitoring Service
 * Keeps microphone monitoring alive continuously when the screen is dimmed or
 * when navigating between apps, adhering to Android foreground service policies.
 */
public class SoundMonitoringService extends Service {

    private static final String TAG = "SoundMonitoringService";
    public static final String ACTION_START = "com.safesphere.soundguard.ACTION_START";
    public static final String ACTION_STOP = "com.safesphere.soundguard.ACTION_STOP";
    public static final int NOTIFICATION_ID = 1001;

    private AudioCaptureService audioCaptureService;
    private final IBinder binder = new LocalBinder();
    private static volatile boolean isServiceRunning = false;
    private static volatile SoundMonitoringService activeInstance;

    public interface GlobalTelemetryListener {
        void onTelemetry(int db, String prediction, int confidencePercent, float latencyMs, java.util.List<SoundClassifier.Prediction> top5);
    }
    private static GlobalTelemetryListener globalTelemetryListener;

    public static void setGlobalTelemetryListener(GlobalTelemetryListener listener) {
        globalTelemetryListener = listener;
    }

    public class LocalBinder extends Binder {
        public SoundMonitoringService getService() {
            return SoundMonitoringService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        activeInstance = this;
        this.audioCaptureService = new AudioCaptureService(this);
        this.audioCaptureService.setTelemetryListener(new AudioCaptureService.TelemetryListener() {
            @Override
            public void onTelemetry(int db, String prediction, int confidencePercent, float latencyMs, java.util.List<SoundClassifier.Prediction> top5) {
                if (globalTelemetryListener != null) {
                    globalTelemetryListener.onTelemetry(db, prediction, confidencePercent, latencyMs, top5);
                }
            }
        });
        Log.d(TAG, "SoundMonitoringService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "onStartCommand received action: " + action);

        if (ACTION_STOP.equals(action)) {
            stopMonitoring();
            stopSelf();
            return START_NOT_STICKY;
        }

        // Start Foreground Service
        NotificationHelper notificationHelper = AlertManager.getInstance(this).getNotificationHelper();
        Notification notification = notificationHelper.buildForegroundMonitoringNotification();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int serviceType = 0;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                }
                startForeground(NOTIFICATION_ID, notification, serviceType);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground error", e);
        }

        startAudioCapture();
        isServiceRunning = true;
        return START_STICKY;
    }

    private void startAudioCapture() {
        if (audioCaptureService != null && !audioCaptureService.isRunning()) {
            boolean success = audioCaptureService.start();
            if (!success) {
                Log.e(TAG, "Failed to start AudioCaptureService inside ForegroundService");
            }
        }
    }

    private void stopMonitoring() {
        isServiceRunning = false;
        if (audioCaptureService != null) {
            audioCaptureService.stop();
        }
        stopForeground(true);
        Log.d(TAG, "Monitoring stopped and foreground notification dismissed");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopMonitoring();
        if (activeInstance == this) {
            activeInstance = null;
        }
        Log.d(TAG, "SoundMonitoringService destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    public static boolean isRunning() {
        return isServiceRunning;
    }

    public static SoundMonitoringService getInstance() {
        return activeInstance;
    }

    public static void start(Context context) {
        Intent intent = new Intent(context, SoundMonitoringService.class);
        intent.setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        Intent intent = new Intent(context, SoundMonitoringService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    public AudioCaptureService getAudioCaptureService() {
        return audioCaptureService;
    }
}
