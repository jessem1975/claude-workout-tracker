import numpy as np

from app.pipeline import run
from app.pipeline.rallies import detect_whistles, rallies_from_motion


def _match(found, truth, tol):
    """Each true rally must have exactly one detection whose start and end
    are within `tol` seconds."""
    assert len(found) == len(truth), f"expected {len(truth)} rallies, got {[(r['start'], r['end']) for r in found]}"
    for r, (s, e) in zip(found, truth):
        assert abs(r["start"] - s) <= tol, (r, s, e)
        assert abs(r["end"] - e) <= tol, (r, s, e)


def test_whistle_and_motion(synth_match, truth):
    out = run.run(synth_match, ["rallies"], lambda f, m: None)
    r = out["rallies"]
    assert r["method"] == "whistle+motion"
    _match(r["rallies"], truth, tol=1.5)
    # Exactly the referee's two whistles per rally survive the filters.
    assert len(r["whistles"]) == 2 * len(truth)
    assert len(r["activity"]) >= int(out["duration_s"]) - 2


def test_motion_only_fallback(synth_match_silent, truth):
    r = run.run(synth_match_silent, ["rallies"], lambda f, m: None)["rallies"]
    assert r["method"] == "motion"
    assert r["whistles"] == []
    _match(r["rallies"], truth, tol=2.5)


def test_no_whistles_in_noise():
    rng = np.random.default_rng(1)
    noise = rng.normal(0, 0.1, 16000 * 30).astype(np.float32)
    assert detect_whistles(noise) == []


def test_flat_motion_gives_no_rallies():
    assert rallies_from_motion(np.full(500, 1.0, dtype=np.float32)) == []


def test_progress_reaches_one(synth_match):
    seen = []
    run.run(synth_match, ["rallies"], lambda f, m: seen.append(f))
    assert seen[-1] == 1.0
    assert all(b >= a for a, b in zip(seen, seen[1:]))
