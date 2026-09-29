"""Unit tests for SoundGuard Edge AI Sound Assistant."""

import unittest
import numpy as np
import os
import shutil

from ai.labels.categories import (
    SOUND_CLASSES,
    SOUND_DEFINITIONS,
    get_sound_info,
    PRIORITY_HIGH,
    PRIORITY_MEDIUM,
    PRIORITY_LOW,
)
from ai.preprocessing.audio_features import AudioFeatureExtractor
from ai.model.classifier import SoundClassifierModel
from ai.inference.engine import EdgeInferenceEngine
from audio.capture.microphone import MicrophoneCaptureBuffer
from audio.preprocessing.noise_filter import AudioNoiseFilter
from audio.detection.detector import RealTimeSoundDetector
from audio.simulation.synthetic_sounds import generate_sound
from notifications.voice.tts_engine import VoiceAlertEngine
from notifications.visual.alert_formatter import VisualAlertFormatter
from notifications.vibration.haptic_patterns import get_vibration_pattern
from database.detection_history import DetectionHistoryDB


class TestSoundGuardCore(unittest.TestCase):
    """Test core classification, debouncing, and pipeline execution."""

    def setUp(self):
        self.test_dir = os.path.join(os.path.dirname(__file__), "test_scratch")
        os.makedirs(self.test_dir, exist_ok=True)
        self.test_db_path = os.path.join(self.test_dir, "test_history.db")
        self.db = DetectionHistoryDB(self.test_db_path)
        self.db.clear_all()
        self.detector = RealTimeSoundDetector(default_confidence_threshold=0.60, default_cooldown_seconds=4.0)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_all_13_sound_classes_defined(self):
        """Verify all 13 required sound classes are defined with proper priorities."""
        self.assertEqual(len(SOUND_CLASSES), 13)
        expected = [
            "fire_alarm", "siren", "security_alarm", "distress_shouting",
            "glass_breaking", "doorbell", "baby_crying", "door_knocking",
            "car_horn", "train", "motorcycle", "dog_barking", "construction_noise"
        ]
        for s in expected:
            self.assertIn(s, SOUND_CLASSES)
            info = get_sound_info(s)
            self.assertIn("name", info)
            self.assertIn("category", info)
            self.assertIn("priority", info)
            self.assertIn("voice_phrase", info)
            self.assertIn("icon", info)

    def test_feature_extraction(self):
        """Verify AudioFeatureExtractor generates 49-dim feature vectors."""
        extractor = AudioFeatureExtractor()
        sample_audio = np.random.randn(16000).astype(np.float32)
        features = extractor.extract_features(sample_audio)
        self.assertIn("feature_vector", features)
        self.assertEqual(len(features["feature_vector"]), 49)
        self.assertIn("spectral_centroid", features)
        self.assertIn("zcr", features)
        self.assertIn("rms", features)

    def test_demo_sounds_classification(self):
        """Verify Section 19 Demo Scenarios (Fire alarm, Car horn, Glass breaking, Doorbell)."""
        demo_sounds = ["fire_alarm", "car_horn", "glass_breaking", "doorbell", "siren"]
        engine = EdgeInferenceEngine()

        for s in demo_sounds:
            audio = generate_sound(s, duration_sec=1.0)
            res = engine.process_audio(audio)
            pred = res["prediction"]
            self.assertEqual(pred["sound"], s, f"Expected {s}, got {pred['sound']}")
            self.assertGreaterEqual(pred["confidence"], 0.70, f"Confidence for {s} was {pred['confidence']}")
            self.assertTrue(pred["is_detected"])

    def test_debounce_cooldown(self):
        """Verify duplicate alerts for continuous sounds are suppressed within cooldown."""
        fire_audio = generate_sound("fire_alarm", duration_sec=1.0)

        # 1st detection -> alert triggered
        res1 = self.detector.process_window(fire_audio)
        self.assertTrue(res1["should_alert"])
        self.assertFalse(res1["suppressed_by_cooldown"])

        # Immediate 2nd detection (same continuous alarm) -> should be suppressed
        res2 = self.detector.process_window(fire_audio)
        self.assertFalse(res2["should_alert"])
        self.assertTrue(res2["suppressed_by_cooldown"])
        self.assertGreater(res2["cooldown_remaining_sec"], 0)

    def test_database_persistence_and_stats(self):
        """Verify SQLite detection logging, stats, acknowledge, and CSV export."""
        rec_id = self.db.add_detection(
            sound_id="fire_alarm",
            sound_name="Fire Alarm",
            category="emergency",
            priority="high",
            confidence=0.96,
            icon="🔥"
        )
        self.assertGreater(rec_id, 0)

        # Query
        history = self.db.get_history()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["sound_id"], "fire_alarm")
        self.assertEqual(history[0]["confidence_percent"], 96)

        # Acknowledge
        self.db.acknowledge_detection(rec_id)
        history = self.db.get_history()
        self.assertEqual(history[0]["acknowledged"], 1)

        # Stats
        stats = self.db.get_statistics()
        self.assertEqual(stats["total_detections"], 1)
        self.assertEqual(stats["by_priority"]["high"], 1)

        # CSV Export
        csv_str = self.db.export_csv()
        self.assertIn("fire_alarm", csv_str)
        self.assertIn("Fire Alarm", csv_str)

    def test_alert_formatting_and_accessibility(self):
        """Verify high/medium/low visual alert schemas."""
        alert_high = VisualAlertFormatter.format_alert("fire_alarm", confidence=0.95)
        self.assertEqual(alert_high["priority"], PRIORITY_HIGH)
        self.assertTrue(alert_high["theme"]["flash_screen"])
        self.assertTrue(alert_high["can_escalate"])

        alert_med = VisualAlertFormatter.format_alert("car_horn", confidence=0.91)
        self.assertEqual(alert_med["priority"], PRIORITY_MEDIUM)
        self.assertFalse(alert_med["theme"]["flash_screen"])

        # Voice phrase
        voice_engine = VoiceAlertEngine()
        voice_payload = voice_engine.generate_speech_payload("fire_alarm")
        self.assertEqual(voice_payload["spoken_text"], "Fire alarm detected.")

        # Vibration
        vib_pattern = get_vibration_pattern("fire_alarm", PRIORITY_HIGH)
        self.assertIsInstance(vib_pattern, list)
        self.assertGreater(len(vib_pattern), 0)


if __name__ == "__main__":
    unittest.main()
