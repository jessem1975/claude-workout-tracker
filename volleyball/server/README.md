# Volleyball Stats: analysis server

Takes an uploaded match video, analyzes it in the background, and returns
suggestions the web app shows to the person tagging. Today it does
**stage 1: finding rallies**. Later stages plug into the same pipeline.

```
web app ──upload──▶ API (FastAPI) ──job──▶ SQLite queue ──▶ worker(s) ──▶ ffmpeg + numpy
   ▲                                                            │
   └────────────────── poll job, get rallies ◀──────────────────┘
```

## What stage 1 does

1. **Whistles.** Pulls the audio and looks for referee whistles: short,
   loud, nearly pure tones between 2 and 4.5 kHz. It ignores sounds too short
   to be a whistle (sneaker squeaks) and whistles much quieter than the
   loudest ones (a neighboring court).
2. **Court motion.** Samples 5 small grayscale frames per second and
   measures how much the picture changes. Rallies are busy; dead time is calm.
3. **Rallies.** The time between whistles alternates between rallies and
   dead time. Each gap counts as a rally if its motion is high. If there are
   too few whistles (no audio, a noisy gym), it falls back to motion alone.
   Each rally gets a confidence score.

The app uses the result to draw rallies on a timeline, list them, jump
between them with `[` and `]`, and skip dead time while playing.

**Tested only on a synthetic match so far** (`tests/synth.py`: moving
players, crowd noise, cheering, squeaks, a quieter whistle from a
neighboring court). Every threshold needs checking against real Lakeville
South footage, both the coach's end-line camera and the Game Time sideline
broadcast. Expect to retune `app/pipeline/rallies.py` once real film is
available. Known risks: tournament gyms with many whistling courts,
broadcast cameras that pan and zoom, and commentary over the audio.

## Run it locally

```bash
cd volleyball/server
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
```

Needs `ffmpeg` and `ffprobe` on the PATH. Then, in two terminals:

```bash
VB_API_TOKENS=dev-token:me .venv/bin/uvicorn app.main:app --port 8000
```

```bash
VB_API_TOKENS=dev-token:me .venv/bin/python -m app.worker
```

In the app: open a match → **Shortcuts & options** → set the server to
`http://localhost:8000` and the token to `dev-token` → **Rallies** tab →
**Find rallies**.

Tests (about 20 seconds; they generate their own test video):

```bash
.venv/bin/python -m pytest -q
```

## API

All endpoints except health need `Authorization: Bearer <token>`. Each token
maps to an owner, and owners can only see their own videos and jobs.

| Method | Path | Does |
|---|---|---|
| GET | `/api/health` | Status and available stages |
| POST | `/api/videos` | Upload (multipart: `file`, `angle` = endline/sideline/other, `match_ref`) |
| GET | `/api/videos` | List your videos |
| GET | `/api/videos/{id}` | Video details and its jobs |
| DELETE | `/api/videos/{id}` | Delete the file and its results |
| POST | `/api/videos/{id}/analyze` | Queue a job: `{"stages": ["rallies"]}` |
| GET | `/api/jobs/{id}` | Status, progress and, when done, the result |

Settings are environment variables; see `.env.example`.

## Privacy defaults

Rosters and film involve minors, so the server starts strict:
- Videos are deleted automatically after `VB_RETENTION_DAYS` (30 by default),
  and the app has a **Delete video from server** button.
- Each owner can only reach their own uploads.
- Results hold timestamps only: no names, no faces, no frames.
- The app's **Export all** backup never includes the server token.

## Hosting options

No account has been created yet. Prices are approximate and change; check
them before signing up.

| Option | What it is | Rough cost | Good for |
|---|---|---|---|
| **One small VM** (Hetzner Cloud, DigitalOcean) | Run `docker compose up` on a single Linux server with a disk | ~$5–25/month | **The pilot (recommended).** Cheapest; stage 1 runs fine on CPU. |
| **Container platform** (Fly.io, Railway, Render) | Same Docker image, managed deploys, add a persistent volume | ~$10–40/month | Less server upkeep; slightly more per month. |
| **Split later** | API on a container platform, video in Cloudflare R2 or S3, workers on pay-per-second GPUs (Modal, RunPod) | Pay per match analyzed | When ball tracking and jersey reading need GPUs, and when there are paying users. |

The code is ready for that split. Storage sits behind one interface
(`app/storage.py`, add an S3/R2 version), the database behind another
(`app/db.py`, swap SQLite for Postgres), and workers claim jobs atomically,
so you can run as many as you like.

## Roadmap

| Stage | Adds | Needs |
|---|---|---|
| 1 ✅ | Rallies, skip dead time | Tuning on real film |
| 1b | Point winner from the Game Time scoreboard overlay; line up end-line and sideline video by audio | Sideline footage |
| 2 | Ball tracking and touch detection (serve, pass, set, attack, block, dig) | GPU, labeled clips |
| 3 | Player for each touch, from jersey numbers + roster | Sideline footage, GPU |
| 4 | Pass ratings, kill/error/in-play, court zones | Stages 2–3 |
| Accounts | Real sign-in, teams and clubs replace tokens | Auth provider |

Every correction a coach makes in the app is a labeled example. Saving
those (with consent) is how stages 2–4 get accurate.
