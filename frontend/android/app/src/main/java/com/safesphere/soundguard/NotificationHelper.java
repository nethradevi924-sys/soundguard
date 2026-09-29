package com.safesphere.soundguard;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * SoundGuard - Notification Helper
 * Sets up NotificationChannels and posts native Android heads-up emergency notifications.
 */
public class NotificationHelper {

    private static final String TAG = "SoundGuard-Notification";

    public static final String CHANNEL_ALERTS_ID = "soundguard_alerts_channel";
    public static final String CHANNEL_ALERTS_NAME = "SoundGuard Emergency Alerts";

    public static final String CHANNEL_MONITOR_ID = "soundguard_monitor_channel";
    public static final String CHANNEL_MONITOR_NAME = "SoundGuard Monitoring Service";

    private final Context context;
    private final NotificationManager notificationManager;

    public NotificationHelper(Context context) {
        this.context = context.getApplicationContext();
        this.notificationManager = (NotificationManager) this.context.getSystemService(Context.NOTIFICATION_SERVICE);
        createChannels();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // 1. High-importance channel for dangerous sound alerts (heads-up popup, sound, vibration)
            NotificationChannel alertsChannel = new NotificationChannel(
                    CHANNEL_ALERTS_ID,
                    CHANNEL_ALERTS_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertsChannel.setDescription("Alerts for detected environmental hazards (fire alarms, sirens, car horns, etc.)");
            alertsChannel.enableLights(true);
            alertsChannel.setLightColor(Color.RED);
            alertsChannel.enableVibration(true);
            alertsChannel.setVibrationPattern(new long[]{0, 400, 150, 400, 150, 600});
            alertsChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            // 2. Low-importance channel for background continuous microphone monitoring
            NotificationChannel monitorChannel = new NotificationChannel(
                    CHANNEL_MONITOR_ID,
                    CHANNEL_MONITOR_NAME,
                    NotificationManager.IMPORTANCE_LOW
            );
            monitorChannel.setDescription("Persistent status indicator while SoundGuard listens for environmental sounds");
            monitorChannel.setShowBadge(false);

            if (notificationManager != null) {
                notificationManager.createNotificationChannel(alertsChannel);
                notificationManager.createNotificationChannel(monitorChannel);
                Log.d(TAG, "Notification channels created: " + CHANNEL_ALERTS_ID + ", " + CHANNEL_MONITOR_ID);
            }
        }
    }

    public boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    public void showDangerAlertNotification(DetectionResult result) {
        if (result == null) return;

        if (!hasNotificationPermission()) {
            Log.w(TAG, "POST_NOTIFICATIONS permission not granted. Notification blocked by Android OS.");
            return;
        }

        try {
            // Intent pointing directly to native AlertDetailsActivity with complete detection data
            Intent detailsIntent = new Intent(context, AlertDetailsActivity.class);
            detailsIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            detailsIntent.putExtra("sound_name", result.soundName);
            detailsIntent.putExtra("sound_id", result.soundId);
            detailsIntent.putExtra("confidence", result.confidence);
            detailsIntent.putExtra("confidence_percent", result.confidencePercent);
            detailsIntent.putExtra("danger_level", result.dangerLevel);
            detailsIntent.putExtra("time_str", result.timeStr);
            detailsIntent.putExtra("timestamp", result.timestamp);
            detailsIntent.putExtra("action", result.action);
            detailsIntent.putExtra("source", result.source);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    (int) (System.currentTimeMillis() % 10000),
                    detailsIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            String title = "⚠️ SoundGuard Alert";
            String body = result.soundName + " detected — Confidence " + result.confidencePercent + "%";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ALERTS_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_alert)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body + "\nDanger Level: " + result.dangerLevel + "\n" + result.action))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setColor(Color.RED)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setVibrate(new long[]{0, 500, 150, 500});

            int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            if (notificationManager != null) {
                notificationManager.notify(notificationId, builder.build());
                Log.d(TAG, "Danger alert notification posted: ID=" + notificationId + ", Sound=" + result.soundName + " (Source: " + result.source + ")");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to post danger notification", e);
        }
    }

    /**
     * Direct launch of AlertDetailsActivity for urgent foreground alerts
     */
    public void launchAlertDetailsDirect(DetectionResult result) {
        if (result == null) return;
        try {
            Intent detailsIntent = new Intent(context, AlertDetailsActivity.class);
            detailsIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            detailsIntent.putExtra("sound_name", result.soundName);
            detailsIntent.putExtra("sound_id", result.soundId);
            detailsIntent.putExtra("confidence", result.confidence);
            detailsIntent.putExtra("confidence_percent", result.confidencePercent);
            detailsIntent.putExtra("danger_level", result.dangerLevel);
            detailsIntent.putExtra("time_str", result.timeStr);
            detailsIntent.putExtra("timestamp", result.timestamp);
            detailsIntent.putExtra("action", result.action);
            detailsIntent.putExtra("source", result.source);
            context.startActivity(detailsIntent);
            Log.d("SoundGuard-Popup", "AlertDetailsActivity launched directly for: " + result.soundName);
        } catch (Exception e) {
            Log.e("SoundGuard-Popup", "Error launching AlertDetailsActivity directly", e);
        }
    }

    public Notification buildForegroundMonitoringNotification() {
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(context, CHANNEL_MONITOR_ID)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle("SoundGuard Active")
                .setContentText("SoundGuard is monitoring for dangerous sounds")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .build();
    }
}
