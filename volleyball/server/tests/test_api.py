import time

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.worker import process_one, purge_expired


@pytest.fixture
def ctx(tmp_path):
    settings = Settings(
        data_dir=tmp_path / "data",
        api_tokens={"tok-coach": "team-a", "tok-other": "team-b"},
        dev_no_auth=False,
        cors_origins=["http://localhost:8080"],
        max_upload_mb=50,
        retention_days=30,
    )
    app = create_app(settings)
    return settings, app, TestClient(app)


AUTH = {"Authorization": "Bearer tok-coach"}


def upload(client, path, headers=AUTH, name="match.mp4", angle="endline"):
    with open(path, "rb") as f:
        return client.post("/api/videos", headers=headers, files={"file": (name, f, "video/mp4")},
                           data={"angle": angle, "match_ref": "m1"})


def test_requires_token(ctx):
    _, _, client = ctx
    assert client.get("/api/videos").status_code == 401
    assert client.get("/api/videos", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/api/health").status_code == 200


def test_full_flow(ctx, synth_match, truth):
    settings, app, client = ctx
    r = upload(client, synth_match)
    assert r.status_code == 201, r.text
    video = r.json()
    assert video["angle"] == "endline" and video["has_audio"] and video["duration_s"] > 100

    job = client.post(f"/api/videos/{video['id']}/analyze", headers=AUTH, json={"stages": ["rallies"]}).json()
    assert job["status"] == "queued"

    assert process_one(app.state.db, app.state.storage, settings) is True
    assert process_one(app.state.db, app.state.storage, settings) is False  # queue empty

    done = client.get(f"/api/jobs/{job['id']}", headers=AUTH).json()
    assert done["status"] == "done", done
    assert done["progress"] == 1.0
    assert len(done["result"]["rallies"]["rallies"]) == len(truth)

    listing = client.get(f"/api/videos/{video['id']}", headers=AUTH).json()
    assert listing["jobs"][0]["id"] == job["id"]


def test_owners_are_isolated(ctx, synth_match):
    _, _, client = ctx
    vid = upload(client, synth_match).json()["id"]
    other = {"Authorization": "Bearer tok-other"}
    assert client.get(f"/api/videos/{vid}", headers=other).status_code == 404
    assert client.post(f"/api/videos/{vid}/analyze", headers=other).status_code == 404
    assert client.get("/api/videos", headers=other).json() == []


def test_rejects_non_video(ctx, tmp_path):
    _, _, client = ctx
    bad = tmp_path / "notes.mp4"
    bad.write_text("this is not a video")
    r = upload(client, bad, name="notes.mp4")
    assert r.status_code == 422
    r = upload(client, bad, name="notes.txt")
    assert r.status_code == 415


def test_unknown_stage(ctx, synth_match):
    _, _, client = ctx
    vid = upload(client, synth_match).json()["id"]
    r = client.post(f"/api/videos/{vid}/analyze", headers=AUTH, json={"stages": ["mind-reading"]})
    assert r.status_code == 422


def test_delete_removes_file(ctx, synth_match):
    _, app, client = ctx
    vid = upload(client, synth_match).json()["id"]
    path = app.state.storage.local_path(app.state.db.get_video(vid, "team-a")["storage_key"])
    assert path.exists()
    assert client.delete(f"/api/videos/{vid}", headers=AUTH).status_code == 204
    assert not path.exists()
    assert client.get(f"/api/videos/{vid}", headers=AUTH).status_code == 404


def test_retention_purge(ctx, synth_match):
    settings, app, client = ctx
    vid = upload(client, synth_match).json()["id"]
    with app.state.db.connect() as c:
        c.execute("UPDATE videos SET created_at = ? WHERE id = ?", (time.time() - 31 * 86400, vid))
    assert purge_expired(app.state.db, app.state.storage, settings) == 1
    assert client.get(f"/api/videos/{vid}", headers=AUTH).status_code == 404
