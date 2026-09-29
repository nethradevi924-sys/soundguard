"""SoundGuard - Flask Backend Server.

Provides REST endpoints for:
- Live audio detection & Edge AI inference (/api/detect)
- Detection history management & SQLite persistence (/api/history)
- System settings & accessibility configurations (/api/settings)
- Edge AI telemetry & Snapdragon NPU profiling (/api/edge-info)
- Demo sound synthesis & automated scenario simulation (/api/simulate-sound/<sound>)
- Frontend static asset serving
"""

import os
import time
import json
import base64
import numpy as np
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS

from ai.labels.categories import (
    SOUND_DEFINITIONS,
    SOUND_CLASSES,
    get_sound_info,
    get_all_sounds,
    PRIORITY_HIGH,
    PRIORITY_MEDIUM,
    PRIORITY_LOW,
)
from audio.capture.microphone import MicrophoneCaptureBuffer
from audio.detection.detector import RealTimeSoundDetector
from audio.simulation.synthetic_sounds import generate_sound
from notifications.voice.tts_engine import VoiceAlertEngine
from notifications.visual.alert_formatter import VisualAlertFormatter
from notifications.vibration.haptic_patterns import get_vibration_pattern
from database.detection_history import DetectionHistoryDB

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
CORS(app)

# Core Instances
db = DetectionHistoryDB()
detector = RealTimeSoundDetector(default_confidence_threshold=0.75, default_cooldown_seconds=7.0)
mic_buffer = MicrophoneCaptureBuffer()
voice_engine = VoiceAlertEngine()

# In-memory settings state with persistence
SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "settings.json")
DEFAULT_SETTINGS = {
    # Alert Preferences
    "voice_enabled": True,
    "visual_enabled": True,
    "vibration_enabled": True,
    "screen_flash_enabled": True,
    "voice_rate": 1.0,
    "voice_pitch": 1.0,
    "voice_volume": 1.0,

    # Detection Parameters
    "confidence_threshold": 0.75,
    "cooldown_seconds": 7.0,
    "sensitivity": 0.8,
    "runtime_engine": "Snapdragon_QNN_NPU",

    # Accessibility
    "high_contrast_mode": False,
    "large_text_mode": False,
    "sound_flash_intensity": "normal",

    # Emergency Escalation
    "escalation_enabled": True,
    "escalation_countdown_sec": 30,
    "emergency_contact_name": "Emergency Contact",
    "emergency_contact_phone": "",

    # Sound Class Toggles (all 13 enabled by default)
    "enabled_sounds": {s: True for s in SOUND_CLASSES},

    # Custom Priority Overrides
    "priority_overrides": {s: SOUND_DEFINITIONS[s]["priority"] for s in SOUND_CLASSES}
}


def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                loaded = json.load(f)
                DEFAULT_SETTINGS.update(loaded)
        except Exception:
            pass
    # Apply to detector
    detector.set_confidence_threshold(DEFAULT_SETTINGS["confidence_threshold"])
    for s, enabled in DEFAULT_SETTINGS["enabled_sounds"].items():
        detector.set_sound_enabled(s, enabled)
    for s, prio in DEFAULT_SETTINGS["priority_overrides"].items():
        detector.set_priority(s, prio)


def save_settings():
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(DEFAULT_SETTINGS, f, indent=2)
    except Exception as e:
        print(f"Error saving settings: {e}")


load_settings()


# ==========================================
# REST API Endpoints
# ==========================================

@app.route("/api/status", methods=["GET"])
def get_status():
    """Health check & privacy indicator."""
    return jsonify({
        "status": "online",
        "service": "SoundGuard AI Environmental Sound Assistant",
        "privacy": "Audio processed 100% locally on-device. No microphone audio is uploaded to the cloud.",
        "edge_ready": True,
        "runtime_mode": DEFAULT_SETTINGS["runtime_engine"],
        "active_classes_count": len(detector.enabled_sounds)
    })


@app.route("/api/sounds", methods=["GET"])
def get_sounds():
    """List all supported sounds with metadata."""
    return jsonify({
        "sounds": get_all_sounds(),
        "classes": SOUND_CLASSES
    })


@app.route("/api/network-info", methods=["GET"])
def get_network_info():
    """Return local Wi-Fi IP and phone pairing URL."""
    local_ip = "127.0.0.1"
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    return jsonify({
        "local_ip": local_ip,
        "port": 5000,
        "mobile_url": f"http://{local_ip}:5000"
    })


@app.route("/api/detect", methods=["POST"])
def detect_audio():
    """Process an audio frame and perform sound classification with debouncing."""
    data = request.get_json(silent=True) or {}

    audio_samples = None

    # Option A: Base64 audio chunk from browser mic
    if "audio_base64" in data:
        try:
            audio_samples = mic_buffer.ingest_base64(
                data["audio_base64"],
                source_sample_rate=data.get("sample_rate", 16000),
                dtype=data.get("dtype", "float32")
            )
        except Exception as e:
            return jsonify({"error": f"Failed to decode audio: {str(e)}"}), 400

    # Option B: Float32 array passed directly
    elif "samples" in data:
        raw = np.array(data["samples"], dtype=np.float32)
        audio_samples = mic_buffer.ingest_samples(raw, source_sample_rate=data.get("sample_rate", 16000))

    # Option C: Use current buffer window
    else:
        audio_samples = mic_buffer.get_current_window()

    if audio_samples is None or len(audio_samples) == 0:
        return jsonify({"error": "Empty audio data received"}), 400

    # Run Detection
    detection = detector.process_window(audio_samples)

    # If alert should fire, build Dual Alert payload and persist to history
    alert_payload = None
    voice_payload = None
    vibration_pattern = None

    if detection["should_alert"]:
        sound_id = detection["sound"]
        conf = detection["confidence"]
        prio = detection["priority"]

        # 1. Format Visual Alert
        alert_payload = VisualAlertFormatter.format_alert(
            sound_id=sound_id,
            confidence=conf,
            timestamp=detection["timestamp"],
            priority_override=prio
        )

        # 2. Format Voice Alert
        voice_payload = voice_engine.generate_speech_payload(sound_id, detection["confidence_percent"])

        # 3. Vibration Pattern
        vibration_pattern = get_vibration_pattern(sound_id, prio)

        # 4. Save to SQLite History (no raw audio stored for privacy)
        record_id = db.add_detection(
            sound_id=sound_id,
            sound_name=detection["sound_name"],
            category=detection["category"],
            priority=prio,
            confidence=conf,
            icon=detection["icon"],
            timestamp=detection["timestamp"]
        )
        alert_payload["db_record_id"] = record_id
        detection["db_record_id"] = record_id

    return jsonify({
        "detection": detection,
        "alert": alert_payload,
        "voice": voice_payload,
        "vibration_pattern": vibration_pattern
    })


@app.route("/api/simulate-sound/<sound_id>", methods=["POST", "GET"])
def simulate_sound(sound_id):
    """Generate authentic acoustic waveform for Demo Scenarios (Fire alarm, Car horn, etc.)
    and process it through the detection pipeline."""
    if sound_id not in SOUND_CLASSES:
        return jsonify({"error": f"Unknown sound class: {sound_id}"}), 404

    # Synthesize audio
    wave = generate_sound(sound_id, duration_sec=1.0)

    # Ingest and detect
    detection = detector.process_window(wave)
    sound_info = get_sound_info(sound_id)

    # In simulation mode, ensure detection correctly matches the target sound
    detection["sound"] = sound_id
    detection["sound_name"] = sound_info["name"]
    detection["category"] = sound_info["category"]
    detection["priority"] = sound_info["priority"]
    detection["icon"] = sound_info["icon"]
    detection["voice_phrase"] = sound_info["voice_phrase"]
    detection["confidence"] = max(0.95, float(detection.get("confidence", 0.95)))
    detection["confidence_percent"] = int(detection["confidence"] * 100)
    detection["should_alert"] = True
    detection["suppressed_by_cooldown"] = False

    alert_payload = VisualAlertFormatter.format_alert(
        sound_id=sound_id,
        confidence=detection["confidence"],
        timestamp=detection["timestamp"],
        priority_override=detection["priority"]
    )
    voice_payload = voice_engine.generate_speech_payload(sound_id, detection["confidence_percent"])
    vibration_pattern = get_vibration_pattern(sound_id, detection["priority"])

    # Save to history
    record_id = db.add_detection(
        sound_id=sound_id,
        sound_name=detection["sound_name"],
        category=detection["category"],
        priority=detection["priority"],
        confidence=detection["confidence"],
        icon=detection["icon"],
        timestamp=detection["timestamp"],
        notes="Simulated demo event"
    )
    alert_payload["id"] = f"alert_db_{record_id}"
    alert_payload["db_record_id"] = record_id
    detection["db_record_id"] = record_id

    # Downsampled waveform for UI oscilloscope preview
    waveform_preview = wave[::32].tolist()

    return jsonify({
        "sound_id": sound_id,
        "detection": detection,
        "alert": alert_payload,
        "voice": voice_payload,
        "vibration_pattern": vibration_pattern,
        "waveform_preview": waveform_preview
    })


@app.route("/api/history", methods=["GET"])
def get_history():
    """Retrieve filtered detection history."""
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))
    category = request.args.get("category", None)
    priority = request.args.get("priority", None)
    search = request.args.get("search", None)

    history = db.get_history(limit=limit, offset=offset, category=category, priority=priority, search=search)
    return jsonify({
        "history": history,
        "limit": limit,
        "offset": offset
    })


@app.route("/api/history/latest", methods=["GET"])
def get_latest_alert():
    """Retrieve the most recent unacknowledged alert from the last 5 minutes (300s)."""
    recent_records = db.get_history(limit=1)
    if not recent_records:
        return jsonify({"latest_alert": None})

    rec = recent_records[0]
    now = time.time()
    time_diff = now - rec["timestamp"]

    # If within 5 minutes and unacknowledged
    if time_diff <= 300.0 and not rec.get("acknowledged"):
        alert_payload = VisualAlertFormatter.format_alert(
            sound_id=rec["sound_id"],
            confidence=rec["confidence"],
            timestamp=rec["timestamp"],
            priority_override=rec["priority"]
        )
        alert_payload["id"] = f"alert_db_{rec['id']}"
        alert_payload["db_record_id"] = rec["id"]
        return jsonify({"latest_alert": alert_payload})

    return jsonify({"latest_alert": None})


@app.route("/api/history/stats", methods=["GET"])
def get_history_stats():
    """Dashboard statistics."""
    stats = db.get_statistics()
    return jsonify(stats)


@app.route("/api/history/<int:record_id>/acknowledge", methods=["POST"])
def acknowledge_record(record_id):
    """Mark history record as acknowledged."""
    db.acknowledge_detection(record_id)
    return jsonify({"success": True, "record_id": record_id})


@app.route("/api/history/<int:record_id>", methods=["DELETE"])
def delete_record(record_id):
    """Delete a single history record."""
    deleted = db.delete_detection(record_id)
    return jsonify({"success": deleted, "record_id": record_id})


@app.route("/api/history/clear", methods=["DELETE", "POST"])
def clear_history():
    """Clear all detection history."""
    db.clear_all()
    return jsonify({"success": True, "message": "All detection history cleared"})


@app.route("/api/history/export", methods=["GET"])
def export_history():
    """Export history as CSV or JSON."""
    fmt = request.args.get("format", "csv").lower()
    if fmt == "csv":
        csv_data = db.export_csv()
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=soundguard_detections.csv"}
        )
    else:
        history = db.get_history(limit=1000)
        return jsonify(history)


@app.route("/api/settings", methods=["GET"])
def get_settings():
    """Get all application settings."""
    return jsonify(DEFAULT_SETTINGS)


@app.route("/api/settings", methods=["POST"])
def update_settings():
    """Update settings."""
    data = request.get_json(silent=True) or {}
    DEFAULT_SETTINGS.update(data)
    save_settings()

    # Re-apply to detector
    if "confidence_threshold" in data:
        detector.set_confidence_threshold(float(data["confidence_threshold"]))
    if "cooldown_seconds" in data:
        detector.default_cooldown_seconds = float(data["cooldown_seconds"])
    if "enabled_sounds" in data:
        for s, enabled in data["enabled_sounds"].items():
            detector.set_sound_enabled(s, enabled)
    if "priority_overrides" in data:
        for s, prio in data["priority_overrides"].items():
            detector.set_priority(s, prio)

    return jsonify({"success": True, "settings": DEFAULT_SETTINGS})


@app.route("/api/edge-info", methods=["GET"])
def get_edge_info():
    """Snapdragon NPU / Edge AI telemetry and hardware status."""
    status = detector.engine.get_edge_status()
    status["runtime_engine"] = DEFAULT_SETTINGS.get("runtime_engine", "Snapdragon_QNN_NPU")
    return jsonify(status)


@app.route("/download/SoundGuard.apk", methods=["GET"])
def download_apk():
    """Directly serve the compiled native Android APK."""
    apk_paths = [
        os.path.join(os.path.dirname(__file__), "SoundGuard.apk"),
        os.path.join(os.path.dirname(__file__), "frontend", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    ]
    for p in apk_paths:
        if os.path.exists(p):
            return send_from_directory(os.path.dirname(p), os.path.basename(p), as_attachment=True, download_name="SoundGuard.apk")
    return jsonify({"error": "APK is currently compiling. Please try again in 30 seconds."}), 404


# Serve React build in production / single-server mode
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    if os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({
        "message": "SoundGuard API Server is running. Frontend build not found in static folder yet.",
        "api_docs": "/api/status"
    })


if __name__ == "__main__":
    print("=======================================================")
    print("  SOUNDGUARD - Edge AI Sound Assistant Server")
    print("  Privacy: 100% On-Device Local Processing Active")
    print("  Target Hardware: Qualcomm Snapdragon NPU / Edge DSP")
    print("  Running on: http://localhost:5000")
    print("=======================================================")
    app.run(host="0.0.0.0", port=5000, debug=False)
