package com.safesphere.soundguard;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

/**
 * SoundGuard - History Repository
 * Manages persistent storage of detected sounds, queries newest first, and supports clearing.
 */
public class HistoryRepository {

    private static final String TAG = "HistoryRepository";
    private final SoundGuardDatabaseHelper dbHelper;

    public HistoryRepository(Context context) {
        this.dbHelper = new SoundGuardDatabaseHelper(context.getApplicationContext());
    }

    public synchronized long addDetection(DetectionResult result) {
        if (result == null) return -1;

        SQLiteDatabase db = null;
        try {
            db = dbHelper.getWritableDatabase();
            ContentValues values = new ContentValues();
            values.put(SoundGuardDatabaseHelper.COLUMN_SOUND_ID, result.soundId);
            values.put(SoundGuardDatabaseHelper.COLUMN_SOUND_NAME, result.soundName);
            values.put(SoundGuardDatabaseHelper.COLUMN_CATEGORY, result.category);
            values.put(SoundGuardDatabaseHelper.COLUMN_PRIORITY, result.dangerLevel);
            values.put(SoundGuardDatabaseHelper.COLUMN_CONFIDENCE, result.confidence);
            values.put(SoundGuardDatabaseHelper.COLUMN_CONFIDENCE_PERCENT, result.confidencePercent);
            values.put(SoundGuardDatabaseHelper.COLUMN_ICON, result.icon);
            values.put(SoundGuardDatabaseHelper.COLUMN_VOICE_PHRASE, result.voicePhrase);
            values.put(SoundGuardDatabaseHelper.COLUMN_ACTION, result.action);
            values.put(SoundGuardDatabaseHelper.COLUMN_TIMESTAMP, result.timestamp);
            values.put(SoundGuardDatabaseHelper.COLUMN_DATE_STR, result.dateStr);
            values.put(SoundGuardDatabaseHelper.COLUMN_TIME_STR, result.timeStr);
            values.put(SoundGuardDatabaseHelper.COLUMN_SOURCE, result.source);

            long insertedId = db.insert(SoundGuardDatabaseHelper.TABLE_HISTORY, null, values);
            result.id = insertedId;
            Log.d(TAG, "Detection saved to history: #" + insertedId + " - " + result.soundName + " (" + result.source + ")");
            return insertedId;
        } catch (Exception e) {
            Log.e(TAG, "Failed to insert detection into history", e);
            return -1;
        }
    }

    public synchronized List<DetectionResult> getAll(int limit) {
        List<DetectionResult> list = new ArrayList<>();
        SQLiteDatabase db = null;
        Cursor cursor = null;

        try {
            db = dbHelper.getReadableDatabase();
            String limitStr = limit > 0 ? String.valueOf(limit) : "100";
            cursor = db.query(
                    SoundGuardDatabaseHelper.TABLE_HISTORY,
                    null,
                    null,
                    null,
                    null,
                    null,
                    SoundGuardDatabaseHelper.COLUMN_TIMESTAMP + " DESC",
                    limitStr
            );

            if (cursor != null && cursor.moveToFirst()) {
                do {
                    long id = cursor.getLong(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_ID));
                    String soundId = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_SOUND_ID));
                    String soundName = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_SOUND_NAME));
                    String category = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_CATEGORY));
                    String priority = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_PRIORITY));
                    float confidence = cursor.getFloat(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_CONFIDENCE));
                    int confPercent = cursor.getInt(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_CONFIDENCE_PERCENT));
                    String icon = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_ICON));
                    String voicePhrase = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_VOICE_PHRASE));
                    String action = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_ACTION));
                    long timestamp = cursor.getLong(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_TIMESTAMP));
                    String dateStr = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_DATE_STR));
                    String timeStr = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_TIME_STR));
                    String source = cursor.getString(cursor.getColumnIndexOrThrow(SoundGuardDatabaseHelper.COLUMN_SOURCE));

                    DetectionResult r = new DetectionResult(
                            id, soundId, soundName, category, priority, confidence, confPercent,
                            icon, voicePhrase, action, timestamp, dateStr, timeStr, source
                    );
                    list.add(r);
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to load history from database", e);
        } finally {
            if (cursor != null) cursor.close();
        }
        return list;
    }

    public synchronized void clearAll() {
        SQLiteDatabase db = null;
        try {
            db = dbHelper.getWritableDatabase();
            int deleted = db.delete(SoundGuardDatabaseHelper.TABLE_HISTORY, null, null);
            Log.d(TAG, "History cleared. Deleted " + deleted + " records.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to clear history", e);
        }
    }

    public synchronized int getCount() {
        SQLiteDatabase db = null;
        Cursor cursor = null;
        try {
            db = dbHelper.getReadableDatabase();
            cursor = db.rawQuery("SELECT COUNT(*) FROM " + SoundGuardDatabaseHelper.TABLE_HISTORY, null);
            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getInt(0);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to get count", e);
        } finally {
            if (cursor != null) cursor.close();
        }
        return 0;
    }
}
