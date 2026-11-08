"""ffmpeg/ffprobe helpers. Everything is streamed so full matches
(1-2 hours, several GB) never have to fit in memory at once."""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np


class MediaError(Exception):
    pass


@dataclass
class ProbeInfo:
    duration_s: float
    width: int
    height: int
    has_audio: bool


def probe(path: Path) -> ProbeInfo:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
            capture_output=True, check=True, timeout=120,
        ).stdout
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        raise MediaError("Not a readable video file") from e
    info = json.loads(out)
    streams = info.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise MediaError("File has no video track")
    duration = float(info.get("format", {}).get("duration") or video.get("duration") or 0)
    if duration <= 0:
        raise MediaError("Could not read video duration")
    return ProbeInfo(
        duration_s=duration,
        width=int(video.get("width") or 0),
        height=int(video.get("height") or 0),
        has_audio=any(s.get("codec_type") == "audio" for s in streams),
    )


def read_audio(path: Path, sample_rate: int = 16000) -> np.ndarray:
    """Mono float32 audio in [-1, 1]. About 115 MB for a 2-hour match."""
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(sample_rate), "-f", "s16le", "-"],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise MediaError("Could not decode audio: " + proc.stderr.decode(errors="ignore")[-300:])
    return np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def motion_series(path: Path, fps: float = 5.0, width: int = 160, on_progress=None, duration_s: float = 0) -> np.ndarray:
    """Mean absolute pixel change between consecutive low-res grayscale
    frames, sampled at `fps`. Returns one value per frame step."""
    height = None
    info = probe(path)
    height = max(2, int(round(info.height * width / max(info.width, 1) / 2)) * 2)
    frame_bytes = width * height
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", str(path), "-an",
         "-vf", f"fps={fps},scale={width}:{height},format=gray", "-f", "rawvideo", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    values: list[float] = []
    prev = None
    total = max(1, int((duration_s or info.duration_s) * fps))
    assert proc.stdout is not None
    while True:
        buf = proc.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            break
        frame = np.frombuffer(buf, dtype=np.uint8).astype(np.int16)
        if prev is not None:
            values.append(float(np.abs(frame - prev).mean()))
        prev = frame
        if on_progress and len(values) % 200 == 0:
            on_progress(min(1.0, len(values) / total))
    proc.wait()
    if proc.returncode not in (0, None) and not values:
        raise MediaError("Could not decode video frames")
    return np.asarray(values, dtype=np.float32)
