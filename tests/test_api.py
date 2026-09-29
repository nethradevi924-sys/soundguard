"""Integration tests for SoundGuard REST API endpoints."""

import unittest
import json
import numpy as np
from server import app, db, detector


class TestSoundGuardAPI(unittest.TestCase):
    """Test REST API responses."""

    def setUp(self):
        self.client = app.test_client()
        db.clear_all()

    def test_status_endpoint(self):
        res = self.client.get("/api/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "online")
        self.assertIn("privacy", data)
        self.assertTrue(data["edge_ready"])

    def test_sounds_endpoint(self):
        res = self.client.get("/api/sounds")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data["sounds"]), 13)
        self.assertEqual(len(data["classes"]), 13)

    def test_simulate_fire_alarm(self):
        res = self.client.post("/api/simulate-sound/fire_alarm")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["sound_id"], "fire_alarm")
        self.assertIsNotNone(data["alert"])
        self.assertEqual(data["alert"]["priority"], "high")
        self.assertIsNotNone(data["voice"])
        self.assertIn("Fire alarm detected", data["voice"]["spoken_text"])
        self.assertIsNotNone(data["vibration_pattern"])

    def test_simulate_car_horn(self):
        res = self.client.post("/api/simulate-sound/car_horn")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["sound_id"], "car_horn")
        self.assertIsNotNone(data["alert"])
        self.assertEqual(data["alert"]["priority"], "medium")

    def test_history_and_export(self):
        # Trigger one simulation
        self.client.post("/api/simulate-sound/doorbell")

        # Check history
        res = self.client.get("/api/history")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data["history"]), 1)

        # Check export CSV
        res_csv = self.client.get("/api/history/export?format=csv")
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn(b"doorbell", res_csv.data)

        # Check stats
        res_stats = self.client.get("/api/history/stats")
        self.assertEqual(res_stats.status_code, 200)
        stats = res_stats.get_json()
        self.assertEqual(stats["total_detections"], 1)

    def test_settings_get_and_post(self):
        res = self.client.get("/api/settings")
        self.assertEqual(res.status_code, 200)
        settings = res.get_json()
        self.assertIn("confidence_threshold", settings)

        # Update threshold
        update_res = self.client.post("/api/settings", json={"confidence_threshold": 0.85})
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.get_json()["settings"]["confidence_threshold"], 0.85)

    def test_edge_info(self):
        res = self.client.get("/api/edge-info")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["is_on_device"])
        self.assertIn("target_hardware", data)


if __name__ == "__main__":
    unittest.main()
