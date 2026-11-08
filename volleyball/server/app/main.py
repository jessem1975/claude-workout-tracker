"""HTTP API for uploading match video and running analysis.

Run with:  uvicorn app.main:app --port 8000
"""
from __future__ import annotations

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import Settings, load_settings
from .db import Database, new_id
from .pipeline import media
from .pipeline.run import STAGES
from .storage import LocalStorage, UploadTooLarge

ANGLES = {"endline", "sideline", "other"}


class AnalyzeRequest(BaseModel):
    stages: list[str] = Field(default_factory=lambda: ["rallies"])


VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".mts", ".ts"}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    db = Database(settings.db_path)
    storage = LocalStorage(settings.video_dir)

    app = FastAPI(title="Volleyball Stats analysis API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.state.settings, app.state.db, app.state.storage = settings, db, storage

    def owner(authorization: str | None = Header(default=None)) -> str:
        """Who is calling. Today: a bearer token mapped to an owner name.
        Later: a real account/team id from your auth provider."""
        if settings.dev_no_auth:
            return "dev"
        token = (authorization or "").removeprefix("Bearer ").strip()
        who = settings.api_tokens.get(token) if token else None
        if not who:
            raise HTTPException(401, "Missing or invalid API token")
        return who

    def video_or_404(video_id: str, who: str) -> dict:
        v = db.get_video(video_id, who)
        if v is None:
            raise HTTPException(404, "Video not found")
        return v

    def public_video(v: dict) -> dict:
        return {k: v[k] for k in ("id", "filename", "angle", "match_ref", "size_bytes", "duration_s",
                                  "width", "height", "has_audio", "created_at")}

    def public_job(j: dict) -> dict:
        return {k: j[k] for k in ("id", "video_id", "stages", "status", "progress", "message", "error",
                                  "pipeline_version", "created_at", "started_at", "finished_at", "result")}

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True, "stages": sorted(STAGES)}

    @app.post("/api/videos", status_code=201)
    def upload_video(
        file: UploadFile = File(...),
        angle: str = Form("other"),
        match_ref: str | None = Form(None),
        who: str = Depends(owner),
    ) -> dict:
        if angle not in ANGLES:
            raise HTTPException(422, f"angle must be one of {sorted(ANGLES)}")
        name = (file.filename or "video").rsplit("/", 1)[-1][:200]
        ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
        if ext not in VIDEO_EXTS:
            raise HTTPException(415, "Upload a video file (mp4, mov, webm, mkv…)")
        vid = new_id("vid")
        key = f"{vid}/source{ext}"
        try:
            size = storage.save(key, file.file, settings.max_upload_mb * 1024 * 1024)
        except UploadTooLarge:
            raise HTTPException(413, f"Video is larger than {settings.max_upload_mb} MB")
        try:
            info = media.probe(storage.local_path(key))
        except media.MediaError as e:
            storage.delete(key)
            raise HTTPException(422, str(e))
        v = db.add_video(id=vid, owner=who, filename=name, angle=angle, match_ref=match_ref,
                         storage_key=key, size_bytes=size, duration_s=info.duration_s,
                         width=info.width, height=info.height, has_audio=int(info.has_audio))
        return public_video(v)

    @app.get("/api/videos")
    def list_videos(who: str = Depends(owner)) -> list[dict]:
        return [public_video(v) for v in db.list_videos(who)]

    @app.get("/api/videos/{video_id}")
    def get_video(video_id: str, who: str = Depends(owner)) -> dict:
        v = video_or_404(video_id, who)
        jobs = db.jobs_for_video(video_id, who)
        return public_video(v) | {"jobs": [public_job(j) | {"result": None} for j in jobs]}

    @app.delete("/api/videos/{video_id}", status_code=204, response_class=Response)
    def delete_video(video_id: str, who: str = Depends(owner)) -> Response:
        v = video_or_404(video_id, who)
        storage.delete(v["storage_key"])
        db.delete_video(video_id, who)
        return Response(status_code=204)

    @app.post("/api/videos/{video_id}/analyze", status_code=202)
    def analyze(video_id: str, body: AnalyzeRequest | None = None, who: str = Depends(owner)) -> dict:
        video_or_404(video_id, who)
        stages = (body or AnalyzeRequest()).stages
        unknown = [s for s in stages if s not in STAGES]
        if not stages or unknown:
            raise HTTPException(422, f"Unknown stage(s): {unknown}. Available: {sorted(STAGES)}")
        return public_job(db.add_job(who, video_id, stages))

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str, who: str = Depends(owner)) -> dict:
        j = db.get_job(job_id, who)
        if j is None:
            raise HTTPException(404, "Job not found")
        return public_job(j)

    return app


app = create_app()
