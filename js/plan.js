// Weekly rotation: 6 training days + 1 rest day, repeating indefinitely.
// The app tracks which index in this array was last completed (not the calendar
// day), so skipping a day just picks up where you left off next time you train.

const PLAN = [
  {
    id: 'push-a', label: 'Push A', focus: 'Chest / Shoulders / Triceps',
    exercises: ['db-bench-press', 'incline-db-press', 'cable-fly', 'db-lateral-raise', 'landmine-press', 'rope-pushdown', 'cable-face-pull']
  },
  {
    id: 'pull-a', label: 'Pull A', focus: 'Back / Biceps / Rotator Cuff',
    exercises: ['lat-pulldown', 'seated-cable-row', 'single-arm-db-row', 'cable-external-rotation', 'band-pull-apart', 'db-curl', 'dead-hang']
  },
  {
    id: 'legs-a', label: 'Legs A', focus: 'Quads / Hamstrings / Glutes (knee-friendly)',
    exercises: ['leg-press', 'romanian-deadlift', 'walking-lunge', 'seated-leg-curl', 'spanish-squat', 'standing-calf-raise', 'plank']
  },
  {
    id: 'push-b', label: 'Push B', focus: 'Shoulders / Chest / Triceps',
    exercises: ['landmine-press', 'incline-db-press', 'db-lateral-raise', 'cable-fly', 'cable-face-pull', 'rope-pushdown', 'side-plank']
  },
  {
    id: 'pull-b', label: 'Pull B', focus: 'Back / Biceps / Rotator Cuff',
    exercises: ['seated-cable-row', 'lat-pulldown', 'single-arm-db-row', 'band-pull-apart', 'cable-external-rotation', 'hammer-curl', 'dead-hang']
  },
  {
    id: 'legs-b', label: 'Legs B + Conditioning', focus: 'Hip-dominant legs + engine work (knee-friendly)',
    exercises: ['hip-thrust', 'leg-press', 'seated-leg-curl', 'wall-sit', 'standing-calf-raise', 'dead-bug', 'bike-intervals']
  },
  {
    id: 'rest', label: 'Rest Day', focus: 'Recovery / mobility — optional light stretching, no logged lifts',
    exercises: []
  }
];

if (typeof module !== 'undefined') module.exports = { PLAN };
