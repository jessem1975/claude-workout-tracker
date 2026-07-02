# Workout Tracker

A phone-friendly, installable workout tracker built around a 6-day push/pull/legs
rotation, tailored for a 50-year-old lifter training around a left rotator cuff
injury and a right patellar tendon issue, with a lean/athletic body-composition
goal. Runs entirely in the browser — no account, no server, no internet required
after the first load. All data stays on your phone (localStorage).

## Running it

Any static file server works. From this folder:

```
python3 -m http.server 8080
# or
npx serve .
```

Then open `http://<your-computer's-ip>:8080` on your phone (same Wi-Fi), or
just open `index.html` directly if you're deploying it to any static host
(GitHub Pages, Netlify, Vercel, etc.).

### Install it on your phone (recommended)

- **iPhone (Safari):** open the site → Share icon → "Add to Home Screen".
- **Android (Chrome):** open the site → ⋮ menu → "Add to Home screen" / "Install app".

Once installed it behaves like a normal app icon and works offline (a service
worker caches the app shell).

## How the program works

- **Rotation, not a calendar.** The app tracks which day of the 6-day cycle you
  last completed, not the date — so if you train 5 days one week and 6 the
  next, it just picks up on the next day in the sequence.
- **Cycle:** Push A → Pull A → Legs A → Push B → Pull B → Legs B + Conditioning
  → Rest → repeat. See `js/plan.js`.
- **Injury-aware exercise selection** (`js/exercises.js`): shoulder-friendly
  substitutions for overhead/behind-the-neck pressing (landmine press, neutral-grip
  pulldowns/rows, low-to-high cable flys), direct rotator cuff work (face pulls,
  band pull-aparts, cable external rotation, dead hangs), knee-friendly leg work
  (partial-ROM leg press, RDLs, hip thrusts, seated leg curls, and Spanish
  squat / wall sit isometrics — the standard rehab tool for patellar
  tendinopathy). Every exercise with a relevant risk shows an on-screen caution
  note.
- **Progressive overload** (`js/progression.js`): a double-progression scheme.
  Work a rep range (e.g. 8-12) at a fixed weight; once every set hits the top
  of the range, the app suggests a weight increase and drops you back to the
  bottom of the range. Two sessions failing to reach the bottom of the range
  triggers a suggested 10% deload. Time-based moves (planks, wall sits, dead
  hangs, carries) use the same logic with hold duration instead of reps.
- **Timers:** logging a set auto-starts a rest timer (banner at the bottom,
  with +15s / skip controls, sound + vibration on completion, and a screen
  wake-lock so your phone doesn't sleep mid-workout). Time-based exercises get
  an inline countdown timer for the hold/interval itself.
- **Reference videos:** each exercise's detail page (tap "Details" on any
  exercise card, or "Watch form video") links to a real demonstration video
  from a reputable strength-coaching or physical-therapy source.

## Disclaimer

This is a general fitness tool, not medical advice. The rotator cuff and
patellar tendon notes reflect common, conservative training guidance — if
you have pain that doesn't resolve, or it's a new/worsening injury, check
with a physical therapist or doctor before continuing to load it.

## Project structure

```
index.html            App shell + bottom nav + rest-timer banner
css/styles.css         Mobile-first styling (dark/light auto)
manifest.json          PWA manifest
service-worker.js       Offline caching of the app shell
icons/                  App icons
js/exercises.js         Exercise database (sets/reps/rest/cautions)
js/videos.js            Reference video links per exercise
js/plan.js              The 6-day + rest rotation
js/progression.js       Double-progression suggestion engine
js/timer.js             Countdown timer / stopwatch / sound+vibration helpers
js/storage.js           localStorage persistence layer
js/session.js           Active workout session state machine
js/app.js               Hash router + view rendering
```
