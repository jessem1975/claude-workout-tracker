"""Stage 1: split a match into rallies.

Signals
- Whistles: the referee whistles to authorize each serve and again when
  the rally ends. A whistle is a loud, nearly pure tone around 2-4.5 kHz,
  so we look for short bursts where one frequency in that band towers over
  the rest of the spectrum.
- Motion: during a rally, players move fast; between rallies they walk.
  Frame-to-frame pixel change separates the two well on a fixed camera
  (endline tripod). Panning broadcast cameras make this signal noisier.

Strategy
1. With enough whistles, the gaps between them alternate rally / dead
   time. Each gap is labeled a rally if its motion is high and its
   length is plausible.
2. Without usable audio, fall back to motion alone with hysteresis.

All thresholds are relative to the match's own statistics so different
gyms, mics and cameras need less tuning. They still need checking against
real footage; see the README.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np

SAMPLE_RATE = 16000
MOTION_FPS = 5.0

# Referee whistles last at least this long; sneaker squeaks are shorter.
MIN_WHISTLE_S = 0.2
# Whistles this many dB below the typical referee whistle are ignored.
NEIGHBOR_COURT_DB = 12.0

# Plausible rally length, seconds (serve to whistle).
MIN_RALLY_S = 2.0
MAX_RALLY_S = 75.0


@dataclass
class Whistle:
    t: float
    duration: float
    freq_hz: float
    strength: float
    level_db: float = 0.0


@dataclass
class Rally:
    start: float
    end: float
    confidence: float
    source: str  # "whistle+motion" | "motion"

    @property
    def duration(self) -> float:
        return self.end - self.start


# ---------- whistles ----------

def detect_whistles(audio: np.ndarray, sr: int = SAMPLE_RATE) -> list[Whistle]:
    n_fft, hop = 1024, 256
    if len(audio) < n_fft * 4:
        return []
    window = np.hanning(n_fft).astype(np.float32)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    band = (freqs >= 2000) & (freqs <= 4500)
    ref = (freqs >= 300) & (freqs <= 7500)

    n_frames = 1 + (len(audio) - n_fft) // hop
    tonal = np.empty(n_frames, dtype=np.float32)
    loud = np.empty(n_frames, dtype=np.float32)
    peak_f = np.empty(n_frames, dtype=np.float32)
    # Process in blocks to bound memory on long matches.
    block = 4096
    for b0 in range(0, n_frames, block):
        b1 = min(n_frames, b0 + block)
        idx = np.arange(b0, b1)[:, None] * hop + np.arange(n_fft)[None, :]
        spec = np.abs(np.fft.rfft(audio[idx] * window, axis=1)) ** 2
        band_spec = spec[:, band]
        k = band_spec.argmax(axis=1)
        peak = band_spec[np.arange(len(k)), k]
        # Sum a few bins around the peak (whistles warble slightly).
        lo = np.clip(k - 2, 0, band_spec.shape[1] - 1)
        hi = np.clip(k + 3, 1, band_spec.shape[1])
        csum = np.concatenate([np.zeros((len(k), 1)), np.cumsum(band_spec, axis=1)], axis=1)
        peak_energy = csum[np.arange(len(k)), hi] - csum[np.arange(len(k)), lo]
        total = spec[:, ref].sum(axis=1) + 1e-12
        tonal[b0:b1] = peak_energy / total
        loud[b0:b1] = 10 * np.log10(peak + 1e-12)
        peak_f[b0:b1] = freqs[band][k]

    # A frame is "whistle-like" when most of its energy sits in a narrow
    # peak AND that peak is loud compared with the match's typical level.
    loud_floor = np.median(loud) + 12.0
    hit = (tonal > 0.45) & (loud > loud_floor)

    whistles: list[Whistle] = []
    frame_s = hop / sr
    i = 0
    while i < n_frames:
        if not hit[i]:
            i += 1
            continue
        j = i
        gap = 0
        while j + 1 < n_frames and (hit[j + 1] or gap < 3):
            gap = 0 if hit[j + 1] else gap + 1
            j += 1
        j -= gap
        dur = (j - i + 1) * frame_s
        if MIN_WHISTLE_S <= dur <= 3.0:
            seg = slice(i, j + 1)
            whistles.append(Whistle(
                t=round(i * frame_s, 2), duration=round(dur, 2),
                freq_hz=float(np.median(peak_f[seg])), strength=float(np.mean(tonal[seg])),
                level_db=float(np.percentile(loud[seg], 75)),
            ))
        i = j + 1 + gap

    # Merge bursts that belong to one blow (e.g. a double toot).
    merged: list[Whistle] = []
    for w in whistles:
        if merged and w.t - (merged[-1].t + merged[-1].duration) < 0.6:
            m = merged[-1]
            m.duration = round(w.t + w.duration - m.t, 2)
            m.strength = max(m.strength, w.strength)
            m.level_db = max(m.level_db, w.level_db)
        else:
            merged.append(w)

    # The referee is the loudest consistent whistle in the recording.
    # Whistles far quieter than that come from a neighboring court.
    if len(merged) >= 4:
        levels = np.array([w.level_db for w in merged])
        ref_level = float(np.percentile(levels, 75))
        merged = [w for w in merged if w.level_db >= ref_level - NEIGHBOR_COURT_DB]
    for w in merged:
        w.level_db = round(w.level_db, 1)
        w.freq_hz = round(w.freq_hz, 1)
        w.strength = round(w.strength, 3)
    return merged


# ---------- motion ----------

def smooth(x: np.ndarray, n: int) -> np.ndarray:
    if n <= 1 or len(x) == 0:
        return x
    k = np.ones(n, dtype=np.float32) / n
    return np.convolve(x, k, mode="same")


def _two_means_threshold(values: np.ndarray) -> float:
    """Split values into low/high groups (1-D k-means) and return the midpoint."""
    lo, hi = np.percentile(values, 25), np.percentile(values, 75)
    for _ in range(30):
        mid = (lo + hi) / 2
        a, b = values[values <= mid], values[values > mid]
        if len(a) == 0 or len(b) == 0:
            break
        nlo, nhi = a.mean(), b.mean()
        if abs(nlo - lo) < 1e-6 and abs(nhi - hi) < 1e-6:
            break
        lo, hi = nlo, nhi
    return float((lo + hi) / 2)


def _motion_at(motion: np.ndarray, start: float, end: float, fps: float) -> float:
    a, b = int(start * fps), max(int(start * fps) + 1, int(end * fps))
    seg = motion[a:b]
    return float(seg.mean()) if len(seg) else 0.0


# ---------- rallies ----------

def rallies_from_whistles(whistles: list[Whistle], motion: np.ndarray, fps: float = MOTION_FPS) -> list[Rally]:
    if len(whistles) < 4 or len(motion) == 0:
        return []
    gaps = []
    for a, b in zip(whistles, whistles[1:]):
        start, end = a.t + a.duration, b.t
        if end - start <= 0.5:
            continue
        gaps.append((a.t, b.t + b.duration, _motion_at(motion, start, end, fps)))
    if len(gaps) < 3:
        return []
    m = np.array([g[2] for g in gaps])
    thr = _two_means_threshold(m)
    spread = float(m.std()) or 1.0
    out: list[Rally] = []
    prev_end = None
    for start, end, mv in gaps:
        if mv <= thr:
            prev_end = None
            continue
        conf = 0.5 + 0.5 * min(1.0, (mv - thr) / spread)
        # Back-to-back busy gaps mean a stray whistle split one rally.
        if out and prev_end is not None and start <= prev_end and end - out[-1].start <= MAX_RALLY_S:
            out[-1].end = round(end + 0.5, 2)
            out[-1].confidence = round(min(out[-1].confidence, conf) * 0.9, 2)
        else:
            out.append(Rally(round(start, 2), round(end + 0.5, 2), round(conf, 2), "whistle+motion"))
        prev_end = end
    return [r for r in out if MIN_RALLY_S <= r.duration <= MAX_RALLY_S + 1]


def rallies_from_motion(motion: np.ndarray, fps: float = MOTION_FPS) -> list[Rally]:
    if len(motion) < fps * 10:
        return []
    s = smooth(motion, int(fps * 1.5))
    thr = _two_means_threshold(s)
    lo_thr = thr * 0.8  # hysteresis: stay "in rally" until clearly calm
    spread = float(s.std()) or 1.0
    out: list[Rally] = []
    in_rally, start = False, 0
    for i, v in enumerate(s):
        if not in_rally and v > thr:
            in_rally, start = True, i
        elif in_rally and v < lo_thr:
            in_rally = False
            out.append((start, i))
        if in_rally and i == len(s) - 1:
            out.append((start, i))
    rallies: list[Rally] = []
    for a, b in out:
        st, en = a / fps, b / fps
        if rallies and st - rallies[-1].end < 1.5:  # bridge tiny dips
            rallies[-1].end = round(en, 2)
            continue
        rallies.append(Rally(round(st, 2), round(en, 2), 0.0, "motion"))
    final = []
    for r in rallies:
        if MIN_RALLY_S <= r.duration <= MAX_RALLY_S:
            mv = _motion_at(s, r.start, r.end, fps)
            r.confidence = round(0.3 + 0.4 * min(1.0, (mv - thr) / spread), 2)
            final.append(r)
    return final


def detect_rallies(audio: np.ndarray | None, motion: np.ndarray, fps: float = MOTION_FPS) -> dict:
    whistles = detect_whistles(audio) if audio is not None and len(audio) else []
    rallies = rallies_from_whistles(whistles, motion, fps)
    method = "whistle+motion"
    if len(rallies) < 3:
        rallies = rallies_from_motion(motion, fps)
        method = "motion"
    return {
        "method": method,
        "rallies": [asdict(r) | {"duration": round(r.duration, 2)} for r in rallies],
        "whistles": [asdict(w) for w in whistles],
        "motion_fps": fps,
        # Downsampled to 1 value/second so the app can draw an activity strip.
        "activity": [round(float(v), 3) for v in _per_second(motion, fps)],
    }


def _per_second(motion: np.ndarray, fps: float) -> np.ndarray:
    n = int(fps)
    if n <= 1 or len(motion) == 0:
        return motion
    usable = len(motion) // n * n
    return motion[:usable].reshape(-1, n).mean(axis=1)
