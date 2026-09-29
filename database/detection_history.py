"""SoundGuard - Detection History SQLite Database.

Manages persistent logging of sound detections without storing raw audio recordings,
adhering strictly to privacy-first design principles.
Provides querying, filtering, statistical aggregations, and export capabilities.
"""

import sqlite3
import os
import json
import csv
import io
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple


class DetectionHistoryDB:
    """SQLite database manager for detection history."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(base_dir, "detection_history.db")
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Create tables and indexes if they do not exist."""
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS detections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sound_id TEXT NOT NULL,
                    sound_name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    confidence_percent INTEGER NOT NULL,
                    icon TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    date_str TEXT NOT NULL,
                    time_str TEXT NOT NULL,
                    acknowledged INTEGER DEFAULT 0,
                    escalated INTEGER DEFAULT 0,
                    notes TEXT DEFAULT ''
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_category ON detections (category)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_priority ON detections (priority)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON detections (timestamp DESC)")
            conn.commit()

    def add_detection(
        self,
        sound_id: str,
        sound_name: str,
        category: str,
        priority: str,
        confidence: float,
        icon: str,
        timestamp: Optional[float] = None,
        acknowledged: bool = False,
        escalated: bool = False,
        notes: str = ""
    ) -> int:
        """Insert a detection event into history."""
        dt = datetime.fromtimestamp(timestamp) if timestamp else datetime.now()
        ts = dt.timestamp()
        date_str = dt.strftime("%Y-%m-%d")
        time_str = dt.strftime("%I:%M:%S %p")
        confidence_percent = int(round(confidence * 100))

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO detections (
                    sound_id, sound_name, category, priority, confidence,
                    confidence_percent, icon, timestamp, date_str, time_str,
                    acknowledged, escalated, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sound_id, sound_name, category, priority, round(confidence, 4),
                confidence_percent, icon, ts, date_str, time_str,
                1 if acknowledged else 0, 1 if escalated else 0, notes
            ))
            conn.commit()
            return cursor.lastrowid

    def get_history(
        self,
        limit: int = 50,
        offset: int = 0,
        category: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve filtered detection records."""
        query = "SELECT * FROM detections WHERE 1=1"
        params: List[Any] = []

        if category and category.lower() != "all":
            query += " AND category = ?"
            params.append(category.lower())

        if priority and priority.lower() != "all":
            query += " AND priority = ?"
            params.append(priority.lower())

        if search:
            query += " AND (sound_name LIKE ? OR sound_id LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term])

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_statistics(self) -> Dict[str, Any]:
        """Calculate summary statistics for dashboard display."""
        today_str = date.today().strftime("%Y-%m-%d")

        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Total detections
            cursor.execute("SELECT COUNT(*) FROM detections")
            total_count = cursor.fetchone()[0]

            # Today's detections
            cursor.execute("SELECT COUNT(*) FROM detections WHERE date_str = ?", (today_str,))
            today_count = cursor.fetchone()[0]

            # By priority
            cursor.execute("""
                SELECT priority, COUNT(*) FROM detections
                GROUP BY priority
            """)
            priority_counts = {row[0]: row[1] for row in cursor.fetchall()}

            # By category
            cursor.execute("""
                SELECT category, COUNT(*) FROM detections
                GROUP BY category
            """)
            category_counts = {row[0]: row[1] for row in cursor.fetchall()}

            # Last detection
            cursor.execute("SELECT * FROM detections ORDER BY timestamp DESC LIMIT 1")
            last_row = cursor.fetchone()
            last_detection = dict(last_row) if last_row else None

            return {
                "total_detections": total_count,
                "today_detections": today_count,
                "by_priority": {
                    "high": priority_counts.get("high", 0),
                    "medium": priority_counts.get("medium", 0),
                    "low": priority_counts.get("low", 0)
                },
                "by_category": {
                    "emergency": category_counts.get("emergency", 0),
                    "environmental": category_counts.get("environmental", 0),
                    "household": category_counts.get("household", 0)
                },
                "last_detection": last_detection
            }

    def acknowledge_detection(self, record_id: int):
        """Mark detection as acknowledged by user."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE detections SET acknowledged = 1 WHERE id = ?", (record_id,))
            conn.commit()

    def delete_detection(self, record_id: int) -> bool:
        """Delete a single detection record."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM detections WHERE id = ?", (record_id,))
            conn.commit()
            return cursor.rowcount > 0

    def clear_all(self):
        """Clear all detection records."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM detections")
            conn.commit()

    def export_csv(self) -> str:
        """Export history as CSV string."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM detections ORDER BY timestamp DESC")
            rows = cursor.fetchall()
            if not rows:
                return "id,sound_id,sound_name,category,priority,confidence,date,time,acknowledged\n"

            output = io.StringIO()
            writer = csv.writer(output)
            headers = ["id", "sound_id", "sound_name", "category", "priority", "confidence_percent", "date_str", "time_str", "acknowledged", "escalated"]
            writer.writerow(headers)
            for r in rows:
                writer.writerow([r[h] for h in headers])
            return output.getvalue()
