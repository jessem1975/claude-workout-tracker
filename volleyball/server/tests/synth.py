"""Builds a synthetic "match" video with known rally times.

It is a stand-in until real footage is available: moving blobs for
players (fast during rallies, slow between), crowd noise, cheering after
points, sneaker squeaks, a quieter whistle from a neighboring court, and
the referee's whistle at each serve and rally end.
"""
from __future__ import annotations

import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 16000
FPS = 15
W, H = 320, 180

DEFAULT_RALLIES = [(8.0, 16.0), (34.0, 41.5), (60.0, 79.0), (98.0, 103.0), (121.0, 135.0), (152.0, 160.0)]


def _whistle(dur: float, freq: float, level: float) -> np.ndarray:
    t = np.arange(int(dur * SR)) / SR
    vib = 40 * np.sin(2 * np.pi * 25 * t)  # pea whistle warble
    phase = 2 * np.pi * np.cumsum(freq + vib) / SR
    env = np.minimum(1, np.minimum(t / 0.02, (dur - t) / 0.03))
    return level * env * (np.sin(phase) + 0.25 * np.sin(2 * phase))


def build_audio(duration: float, rallies, rng) -> np.ndarray:
    n = int(duration * SR)
    noise = rng.normal(0, 1, n)
    # Crowd murmur: low-passed noise.
    crowd = np.convolve(noise, np.ones(8) / 8, mode="same") * 0.05
    audio = crowd.copy()

    def put(sig, at):
        i = int(at * SR)
        j = min(n, i + len(sig))
        if i < n:
            audio[i:j] += sig[: j - i]

    for start, end in rallies:
        put(_whistle(0.45, 3150, 0.35), start)        # serve whistle
        put(_whistle(0.7, 3150, 0.35), end)           # rally over
        cheer_len = 2.5
        cheer = rng.normal(0, 1, int(cheer_len * SR)) * 0.18
        cheer *= np.linspace(1, 0, len(cheer))
        put(cheer, end + 0.8)                         # crowd reacts
        for _ in range(4):                            # sneaker squeaks
            put(_whistle(0.06, rng.uniform(1800, 2600), 0.2), rng.uniform(start + 1, end - 0.5))
    for t in rng.uniform(0, duration - 1, 4):         # neighboring court, quieter
        put(_whistle(0.4, 2900, 0.03), t)
    return np.clip(audio, -1, 1)


def build_frames(duration: float, rallies, rng):
    n_frames = int(duration * FPS)
    n_players = 12
    pos = rng.uniform([20, 20], [W - 20, H - 20], size=(n_players, 2))
    yy, xx = np.mgrid[0:H, 0:W]
    court = np.full((H, W), 70, np.float32)
    court[:, W // 2 - 1: W // 2 + 1] = 200  # net
    for f in range(n_frames):
        t = f / FPS
        live = any(s <= t <= e for s, e in rallies)
        speed = 9.0 if live else 0.9
        pos += rng.normal(0, speed, pos.shape)
        pos = np.clip(pos, [10, 10], [W - 10, H - 10])
        img = court.copy()
        for x, y in pos:
            img[(xx - x) ** 2 + (yy - y) ** 2 < 49] = 180
        if live:  # ball
            bx = (W / 2) + (W / 3) * np.sin(t * 2.3)
            by = (H / 2) + (H / 3) * np.cos(t * 3.1)
            img[(xx - bx) ** 2 + (yy - by) ** 2 < 9] = 255
        img += rng.normal(0, 2, img.shape)
        yield np.clip(img, 0, 255).astype(np.uint8)


def make_match(path: Path, duration: float = 170.0, rallies=DEFAULT_RALLIES, seed: int = 7, audio: bool = True) -> Path:
    rng = np.random.default_rng(seed)
    path.parent.mkdir(parents=True, exist_ok=True)
    wav = path.with_suffix(".wav")
    if audio:
        a = build_audio(duration, rallies, rng)
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((a * 32767).astype(np.int16).tobytes())
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if audio:
        cmd += ["-i", str(wav), "-c:a", "aac", "-b:a", "96k"]
    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-shortest", str(path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for frame in build_frames(duration, rallies, rng):
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg failed to build synthetic match")
    wav.unlink(missing_ok=True)
    return path


if __name__ == "__main__":
    import sys
    out = make_match(Path(sys.argv[1] if len(sys.argv) > 1 else "synthetic_match.mp4"))
    print(out)
