# Volleyball Stats

Tag volleyball match video by player, skill and result. The app builds the
running score, a box score, and clip reels you can jump through ("show me every
kill by #7 in set 2"). It runs entirely in the browser, has no build step, and
works offline once loaded.

## Running it

It's served from the same static site as the workout tracker, at `/volleyball/`.
Locally:

```
python3 -m http.server 8080   # from the repo root
# open http://localhost:8080/volleyball/
```

It works best on a laptop with a keyboard. Tablets and phones work with the tap pad.

## Workflow

1. **Teams** → create your team and add the roster (jersey #, name, position).
2. **New match** → pick the team, enter the opponent and date.
3. **Load video**: choose a local file (phone or camera recording, any format
   the browser can play) or paste a YouTube link. Local files are never
   uploaded. Re-select the same file next time you open the match.
   With no video you can still keep live stats; events just have no timestamp.
4. **Tag**: tap a player → skill → result, or use the keyboard:
   `7 A 1` = #7 attack kill, `12 R 3` = #12 perfect pass. The video pauses
   while you tag and resumes afterwards (toggle in *Shortcuts & options*).
5. **Review**: the *Box score* tab shows each player's stats. Tap any number
   to filter the log to those plays, then **▶ Play clips** to watch them
   back to back (4s before to 3s after each tag; adjustable).
6. **Export**: events CSV, box-score CSV, or a match JSON file you can share
   or import on another device. *Export all* on the home screen backs up everything.

### Stats tracked

| Skill | Results | Box-score columns |
|---|---|---|
| Serve | Ace / In / Error | SA, SE, ATT |
| Pass (serve receive) | 3 / 2 / 1 / 0 rating | REC, AVG, 3s, 0s |
| Set | Assist / In / Error | AST |
| Attack | Kill / In / Error / Blocked | K, E, TA, HIT% = (K−E)/TA |
| Block | Solo / Assist / Touch / Error | BS, BA, BE, BLK = BS + ½BA |
| Dig | Dig / Error | D, DE |

PTS = K + SA + BS + ½BA. Each tag assigns the rally point automatically:
aces, kills and blocks score for you; errors, blocked attacks and 0-passes
score for the opponent. Two block assists on the same rally count one point.
Tap the badge on a log row to correct it. Sets end at 25 (15 in set 5), win by 2.

## Code layout

| File | Responsibility |
|---|---|
| `js/model.js` | Skill definitions, scoring, box-score math. Pure functions, no DOM. |
| `js/store.js` | All persistence (currently `localStorage`), schema version and migrations, import/export. |
| `js/player.js` | One interface over a local `<video>` and the YouTube IFrame player. |
| `js/app.js` | UI: routing, match list, rosters, tagging screen, keyboard shortcuts, clips. |

## Path to commercialization

The app is structured so it can become a paid product without a rewrite.

**Already in place**
- **Self-contained.** Everything lives in `volleyball/` and shares nothing
  with the workout tracker except the placeholder icons. Moving it into its
  own repository is a copy.
- **No third-party code to license.** No frameworks or npm packages: all the
  code is original. YouTube is used only through its official embedded
  player, which allows commercial use under the
  [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service).
  Keep the player visible and unmodified, and don't download YouTube video.
- **One storage boundary.** The UI never touches `localStorage` directly; it
  goes through `Store`. Adding accounts or cloud sync means changing that
  module (or syncing behind it), not the screens.
- **Versioned data.** Saved data and exports carry `schemaVersion`, and
  `Store.migrate()` is where upgrades go, so early users' data survives
  later releases.
- **Pure stat engine.** `model.js` has no DOM code. It can run unchanged on a
  server (Node) to generate reports, season totals or an API.
- **No license file, on purpose.** Without one the code is "all rights
  reserved" by default. Don't add an open-source license unless you mean to.
  If this GitHub repo is public, people can still read the code; make the
  repo private (or move the app to a private repo) before investing heavily.

**Suggested next steps when you're ready**
1. **Own repo + brand.** Move `volleyball/` to a private repo and pick a
   product name. Check it against trademarks and app-store listings, since
   there are established players in this space (e.g. Hudl, VolleyMetrics,
   Balltime), and register a domain. Replace the placeholder icons.
2. **Accounts + sync.** Add a backend (Supabase or Firebase are the quickest)
   behind `Store`: user accounts, teams shared between coaches, and season
   data across devices. Keep local-first behavior so it still works in a gym
   with bad Wi-Fi.
3. **Payments.** Stripe subscriptions (per team or per club), with a free tier
   (e.g. one team / three matches) to drive adoption.
4. **Privacy & legal.** Rosters are often minors. You'll need a privacy policy,
   terms of service, and care around COPPA (US, under 13) and FERPA when you
   sell to schools, plus GDPR if you sell in the EU. Today no player data
   leaves the device, which is a good default to keep for the free tier.
5. **Features that sell.** Season and per-player trend reports, PDF box
   scores for parents and recruiting, shareable clip links, rotation and
   serve/attack zone tracking, opponent scouting, multi-camera or split video
   files, and a native wrapper (Capacitor) for the app stores.
6. **Hosting video.** Storing uploaded video yourself is the big cost and
   complexity jump. Lean on YouTube/unlisted links or the user's local files
   for as long as possible.

*This is general guidance, not legal advice. Talk to a lawyer before launch,
especially about minors' data and your terms of service.*
