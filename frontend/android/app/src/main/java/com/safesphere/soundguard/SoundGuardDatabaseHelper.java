package com.safesphere.soundguard;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

/**
 * SoundGuard - SQLite Database Helper
 * Provides durable local storage on Android phone. Survives app termination and reboot.
 */
public class SoundGuardDatabaseHelper extends SQLiteOpenHelper {

    private static final String TAG = "HistoryRepository";
    public static final String DATABASE_NAME = "soundguard.db";
    public static final int DATABASE_VERSION = 1;

    public static final String TABLE_HISTORY = "detection_history";
    public static final String COLUMN_ID = "id";
    public static final String COLUMN_SOUND_ID = "sound_id";
    public static final String COLUMN_SOUND_NAME = "sound_name";
    public static final String COLUMN_CATEGORY = "category";
    public static final String COLUMN_PRIORITY = "priority";
    public static final String COLUMN_CONFIDENCE = "confidence";
    public static final String COLUMN_CONFIDENCE_PERCENT = "confidence_percent";
    public static final String COLUMN_ICON = "icon";
    public static final String COLUMN_VOICE_PHRASE = "voice_phrase";
    public static final String COLUMN_ACTION = "action";
    public static final String COLUMN_TIMESTAMP = "timestamp";
    public static final String COLUMN_DATE_STR = "date_str";
    public static final String COLUMN_TIME_STR = "time_str";
    public static final String COLUMN_SOURCE = "source";

    private static final String TABLE_CREATE =
            "CREATE TABLE " + TABLE_HISTORY + " (" +
                    COLUMN_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    COLUMN_SOUND_ID + " TEXT NOT NULL, " +
                    COLUMN_SOUND_NAME + " TEXT NOT NULL, " +
                    COLUMN_CATEGORY + " TEXT, " +
                    COLUMN_PRIORITY + " TEXT, " +
                    COLUMN_CONFIDENCE + " REAL, " +
                    COLUMN_CONFIDENCE_PERCENT + " INTEGER, " +
                    COLUMN_ICON + " TEXT, " +
                    COLUMN_VOICE_PHRASE + " TEXT, " +
                    COLUMN_ACTION + " TEXT, " +
                    COLUMN_TIMESTAMP + " INTEGER, " +
                    COLUMN_DATE_STR + " TEXT, " +
                    COLUMN_TIME_STR + " TEXT, " +
                    COLUMN_SOURCE + " TEXT" +
                    ");";

    public SoundGuardDatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        try {
            db.execSQL(TABLE_CREATE);
            Log.d(TAG, "Database created successfully with table: " + TABLE_HISTORY);
        } catch (Exception e) {
            Log.e(TAG, "Error creating database table", e);
        }
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_HISTORY);
        onCreate(db);
    }
}
