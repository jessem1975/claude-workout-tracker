"""Settings, read from environment variables (prefix VB_)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _tokens(raw: str) -> dict[str, str]:
    # "token1:owner1,token2:owner2" -> {token: owner}
    out: dict[str, str] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        token, _, owner = part.partition(":")
        out[token.strip()] = (owner or "default").strip()
    return out


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    api_tokens: dict[str, str]
    dev_no_auth: bool
    cors_origins: list[str]
    max_upload_mb: int
    retention_days: int
    worker_poll_seconds: float = 2.0
    pipeline_version: str = "rallies-0.1"
    extra: dict = field(default_factory=dict)

    @property
    def db_path(self) -> Path:
        return self.data_dir / "vbstats.sqlite3"

    @property
    def video_dir(self) -> Path:
        return self.data_dir / "videos"


def load_settings() -> Settings:
    data_dir = Path(os.environ.get("VB_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
    origins = os.environ.get("VB_CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080")
    return Settings(
        data_dir=data_dir,
        api_tokens=_tokens(os.environ.get("VB_API_TOKENS", "")),
        dev_no_auth=os.environ.get("VB_DEV_NO_AUTH", "") == "1",
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        max_upload_mb=int(os.environ.get("VB_MAX_UPLOAD_MB", "8000")),
        retention_days=int(os.environ.get("VB_RETENTION_DAYS", "30")),
        worker_poll_seconds=float(os.environ.get("VB_WORKER_POLL_SECONDS", "2")),
    )
