"""Runs the requested stages for one video and returns the result dict.

Stages are registered by name so later work (ball tracking, contact
detection, jersey numbers, scoreboard reading) plugs in without changing
the API: the app asks for stages, the result grows new keys.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from . import media, rallies

Progress = Callable[[float, str], None]


def stage_rallies(path: Path, info: media.ProbeInfo, progress: Progress) -> dict:
    audio = None
    if info.has_audio:
        progress(0.02, "Listening for whistles")
        audio = media.read_audio(path, rallies.SAMPLE_RATE)
    progress(0.15, "Measuring court motion")
    motion = media.motion_series(
        path, rallies.MOTION_FPS,
        on_progress=lambda f: progress(0.15 + 0.8 * f, "Measuring court motion"),
        duration_s=info.duration_s,
    )
    progress(0.96, "Finding rallies")
    return rallies.detect_rallies(audio, motion, rallies.MOTION_FPS)


STAGES: dict[str, Callable[[Path, media.ProbeInfo, Progress], dict]] = {
    "rallies": stage_rallies,
}


def run(path: Path, stages: list[str], progress: Progress) -> dict:
    unknown = [s for s in stages if s not in STAGES]
    if unknown:
        raise ValueError(f"Unknown stage(s): {', '.join(unknown)}")
    info = media.probe(path)
    result: dict = {"duration_s": info.duration_s}
    n = len(stages)
    for i, name in enumerate(stages):
        def scaled(f: float, msg: str, i=i) -> None:
            progress((i + f) / n, msg)
        result[name] = STAGES[name](path, info, scaled)
    progress(1.0, "Done")
    return result
