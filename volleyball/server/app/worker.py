"""Background worker: claims queued jobs and runs the pipeline.

Run with:  python -m app.worker
Run several copies (or machines) to process jobs in parallel; claiming
is atomic in the database.
"""
from __future__ import annotations

import logging
import signal
import time
import traceback

from .config import Settings, load_settings
from .db import Database
from .pipeline import run as pipeline
from .storage import LocalStorage

log = logging.getLogger("vbstats.worker")

STALE_RUNNING_S = 3 * 3600


def process_one(db: Database, storage: LocalStorage, settings: Settings) -> bool:
    """Run one queued job. Returns False when the queue is empty."""
    job = db.claim_job()
    if job is None:
        return False
    video = db.get_video(job["video_id"], job["owner"])
    if video is None:
        db.update_job(job["id"], status="failed", error="Video was deleted", finished_at=time.time())
        return True
    log.info("job %s: %s on %s", job["id"], job["stages"], video["filename"])
    last = [0.0]

    def progress(frac: float, message: str) -> None:
        now = time.time()
        if now - last[0] > 1.0 or frac >= 1.0:
            last[0] = now
            db.update_job(job["id"], progress=round(frac, 3), message=message)

    try:
        result = pipeline.run(storage.local_path(video["storage_key"]), job["stages"], progress)
        db.update_job(job["id"], status="done", progress=1.0, message="Done", result=result,
                      pipeline_version=settings.pipeline_version, finished_at=time.time())
    except Exception as e:  # noqa: BLE001 - report any failure on the job
        log.error("job %s failed: %s", job["id"], traceback.format_exc())
        db.update_job(job["id"], status="failed", error=str(e)[:500], finished_at=time.time())
    return True


def purge_expired(db: Database, storage: LocalStorage, settings: Settings) -> int:
    """Delete videos (and their jobs) past the retention window."""
    if settings.retention_days <= 0:
        return 0
    cutoff = time.time() - settings.retention_days * 86400
    expired = db.expired_videos(cutoff)
    for v in expired:
        storage.delete(v["storage_key"])
        db.delete_video_any_owner(v["id"])
    return len(expired)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    settings = load_settings()
    db = Database(settings.db_path)
    storage = LocalStorage(settings.video_dir)
    stop = [False]
    signal.signal(signal.SIGTERM, lambda *_: stop.__setitem__(0, True))
    signal.signal(signal.SIGINT, lambda *_: stop.__setitem__(0, True))
    log.info("worker started, data dir %s", settings.data_dir)
    last_maintenance = 0.0
    while not stop[0]:
        if time.time() - last_maintenance > 600:
            last_maintenance = time.time()
            n = db.requeue_stale(time.time() - STALE_RUNNING_S)
            if n:
                log.warning("requeued %d stale job(s)", n)
            n = purge_expired(db, storage, settings)
            if n:
                log.info("deleted %d expired video(s)", n)
        if not process_one(db, storage, settings):
            time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    main()
