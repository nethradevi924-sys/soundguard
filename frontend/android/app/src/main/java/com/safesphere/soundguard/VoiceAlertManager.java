package com.safesphere.soundguard;

import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import java.util.Locale;

/**
 * SoundGuard - Voice Alert Manager
 * Manages native Android TextToSpeech engine with single-instance lifecycle,
 * queue flushing, and asynchronous audio execution.
 */
public class VoiceAlertManager implements TextToSpeech.OnInitListener {

    private static final String TAG = "VoiceAlert";
    private TextToSpeech tts;
    private boolean isInitialized = false;
    private String pendingSpeakText = null;
    private volatile boolean isSpeaking = false;
    private volatile long lastSpokenTimestamp = 0;

    public VoiceAlertManager(Context context) {
        try {
            Log.d(TAG, "Initializing Android TextToSpeech...");
            this.tts = new TextToSpeech(context.getApplicationContext(), this);
        } catch (Exception e) {
            Log.e(TAG, "Exception creating TextToSpeech", e);
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(Locale.US);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                // Fallback to device default locale
                tts.setLanguage(Locale.getDefault());
            }
            tts.setSpeechRate(1.0f);
            tts.setPitch(1.05f);

            // Track utterance progress to prevent acoustic feedback into microphone
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH_MR1) {
                tts.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        isSpeaking = true;
                        Log.d("SoundGuard-Alert", "TextToSpeech started speaking");
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        isSpeaking = false;
                        lastSpokenTimestamp = System.currentTimeMillis();
                        Log.d("SoundGuard-Alert", "TextToSpeech finished speaking");
                    }

                    @Override
                    public void onError(String utteranceId) {
                        isSpeaking = false;
                        lastSpokenTimestamp = System.currentTimeMillis();
                    }
                });
            }

            isInitialized = true;
            Log.d(TAG, "TextToSpeech initialized successfully");

            if (pendingSpeakText != null) {
                speak(pendingSpeakText);
                pendingSpeakText = null;
            }
        } else {
            Log.e(TAG, "TextToSpeech initialization failed with status: " + status);
            isInitialized = false;
        }
    }

    public boolean isSpeakingOrRecent() {
        return isSpeaking || (System.currentTimeMillis() - lastSpokenTimestamp < 2500L);
    }

    public synchronized void speak(String text) {
        if (text == null || text.trim().isEmpty()) return;

        if (!isInitialized || tts == null) {
            Log.w(TAG, "TTS not ready yet, queuing text: " + text);
            pendingSpeakText = text;
            return;
        }

        try {
            Log.d(TAG, "Speaking voice alert: " + text);
            String utteranceId = "sg_voice_" + System.currentTimeMillis();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                Bundle params = new Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
            } else {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error speaking text", e);
        }
    }

    public synchronized void stop() {
        if (tts != null && isInitialized) {
            try {
                tts.stop();
            } catch (Exception e) {
                Log.w(TAG, "Error stopping TTS", e);
            }
        }
    }

    public synchronized void shutdown() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
                Log.d(TAG, "TextToSpeech engine shut down cleanly");
            } catch (Exception e) {
                Log.w(TAG, "Error shutting down TTS", e);
            }
            tts = null;
            isInitialized = false;
        }
    }

    public boolean isReady() {
        return isInitialized && tts != null;
    }
}
