"""SQLite persistence for videos and analysis jobs.

Every row carries an `owner` so the same schema works when real accounts
(teams/clubs) replace the token-based owners used today. Swapping SQLite
for Postgres later only touches this module.
"""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  filename TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT 'other',
  match_ref TEXT,
  storage_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_s REAL,
  width INTEGER,
  height INTEGER,
  has_audio INTEGER NOT NULL DEFAULT 0,
  created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS videos_owner ON videos(owner);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  stages TEXT NOT NULL,
  status TEXT NOT NULL,            -- queued | running | done | failed
  progress REAL NOT NULL DEFAULT 0,
  message TEXT,
  result TEXT,
  error TEXT,
  pipeline_version TEXT,
  created_at REAL NOT NULL,
  started_at REAL,
  finished_at REAL
);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, created_at);
"""


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:20]}"


class Database:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as c:
            c.executescript(SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=30, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
        finally:
            conn.close()

    # ----- videos -----
    def add_video(self, **v: Any) -> dict:
        v.setdefault("id", new_id("vid"))
        v.setdefault("created_at", time.time())
        cols = ", ".join(v)
        marks = ", ".join("?" for _ in v)
        with self.connect() as c:
            c.execute(f"INSERT INTO videos ({cols}) VALUES ({marks})", list(v.values()))
        return self.get_video(v["id"], v["owner"])

    def get_video(self, video_id: str, owner: str) -> dict | None:
        with self.connect() as c:
            row = c.execute("SELECT * FROM videos WHERE id = ? AND owner = ?", (video_id, owner)).fetchone()
        return _video(row)

    def list_videos(self, owner: str) -> list[dict]:
        with self.connect() as c:
            rows = c.execute("SELECT * FROM videos WHERE owner = ? ORDER BY created_at DESC", (owner,)).fetchall()
        return [_video(r) for r in rows]

    def delete_video(self, video_id: str, owner: str) -> bool:
        with self.connect() as c:
            cur = c.execute("DELETE FROM videos WHERE id = ? AND owner = ?", (video_id, owner))
        return cur.rowcount > 0

    def expired_videos(self, older_than: float) -> list[dict]:
        with self.connect() as c:
            rows = c.execute("SELECT * FROM videos WHERE created_at < ?", (older_than,)).fetchall()
        return [_video(r) for r in rows]

    def delete_video_any_owner(self, video_id: str) -> None:
        with self.connect() as c:
            c.execute("DELETE FROM videos WHERE id = ?", (video_id,))

    # ----- jobs -----
    def add_job(self, owner: str, video_id: str, stages: list[str]) -> dict:
        job_id = new_id("job")
        with self.connect() as c:
            c.execute(
                "INSERT INTO jobs (id, owner, video_id, stages, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)",
                (job_id, owner, video_id, json.dumps(stages), time.time()),
            )
        return self.get_job(job_id, owner)

    def get_job(self, job_id: str, owner: str) -> dict | None:
        with self.connect() as c:
            row = c.execute("SELECT * FROM jobs WHERE id = ? AND owner = ?", (job_id, owner)).fetchone()
        return _job(row)

    def jobs_for_video(self, video_id: str, owner: str) -> list[dict]:
        with self.connect() as c:
            rows = c.execute(
                "SELECT * FROM jobs WHERE video_id = ? AND owner = ? ORDER BY created_at DESC", (video_id, owner)
            ).fetchall()
        return [_job(r) for r in rows]

    def claim_job(self) -> dict | None:
        """Atomically move the oldest queued job to running and return it."""
        with self.connect() as c:
            row = c.execute(
                """UPDATE jobs SET status = 'running', started_at = ?, progress = 0
                   WHERE id = (SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1)
                     AND status = 'queued'
                   RETURNING *""",
                (time.time(),),
            ).fetchone()
        return _job(row)

    def requeue_stale(self, older_than: float) -> int:
        """Jobs left 'running' by a crashed worker go back in the queue."""
        with self.connect() as c:
            cur = c.execute(
                "UPDATE jobs SET status = 'queued', started_at = NULL WHERE status = 'running' AND started_at < ?",
                (older_than,),
            )
        return cur.rowcount

    def update_job(self, job_id: str, **fields: Any) -> None:
        if "result" in fields and fields["result"] is not None:
            fields["result"] = json.dumps(fields["result"])
        sets = ", ".join(f"{k} = ?" for k in fields)
        with self.connect() as c:
            c.execute(f"UPDATE jobs SET {sets} WHERE id = ?", [*fields.values(), job_id])


def _video(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    d["has_audio"] = bool(d["has_audio"])
    return d


def _job(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    d["stages"] = json.loads(d["stages"])
    d["result"] = json.loads(d["result"]) if d["result"] else None
    return d
