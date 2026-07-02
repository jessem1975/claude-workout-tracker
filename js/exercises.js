// Exercise database. Each exercise is either type "weight" (log weight x reps),
// "time" (hold/interval duration, optionally with a load), tracked per set.
//
// increment: suggested weight jump (lb) when progression.js decides to add load.
// repRange / timeRange: [low, high] target band used by the double-progression engine.
// caution: injury-specific form notes surfaced in the UI.

const EXERCISES = {
  // ---------------- PUSH ----------------
  'db-bench-press': {
    id: 'db-bench-press', name: 'Dumbbell Bench Press', category: 'push', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 90, increment: 5,
    caution: 'Lower only to where your shoulder feels neutral, not to full stretch. Stop the descent if you feel pinching.'
  },
  'incline-db-press': {
    id: 'incline-db-press', name: 'Incline Dumbbell Press', category: 'push', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 90, increment: 5,
    caution: 'Use a 30-45 degree incline. Keep elbows at ~45 degrees from torso, not flared to 90.'
  },
  'cable-fly': {
    id: 'cable-fly', name: 'Cable Chest Fly (low-to-high)', category: 'push', type: 'weight',
    sets: 3, repRange: [10, 15], restSec: 60, increment: 2.5,
    caution: 'Set pulleys low so the path travels upward across the body — keeps your shoulder out of the aggravating stretched-behind position.'
  },
  'db-lateral-raise': {
    id: 'db-lateral-raise', name: 'Dumbbell Lateral Raise', category: 'push', type: 'weight',
    sets: 3, repRange: [12, 15], restSec: 60, increment: 2.5,
    caution: 'Raise only to shoulder height. Lead with elbows, light weight — this is a control exercise, not a max-effort lift.'
  },
  'cable-face-pull': {
    id: 'cable-face-pull', name: 'Cable Face Pull', category: 'rehab', type: 'weight',
    sets: 3, repRange: [12, 18], restSec: 45, increment: 2.5,
    caution: 'Rotator cuff / rear delt prehab. Pull to eye level, externally rotate at the end range. Light weight, high quality reps.'
  },
  'landmine-press': {
    id: 'landmine-press', name: 'Landmine Press (single arm)', category: 'push', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 90, increment: 5,
    caution: 'Shoulder-friendly substitute for overhead barbell pressing — the angled path keeps load off the top of the rotator cuff.'
  },
  'rope-pushdown': {
    id: 'rope-pushdown', name: 'Triceps Rope Pushdown', category: 'push', type: 'weight',
    sets: 3, repRange: [10, 15], restSec: 60, increment: 5,
    caution: 'Keep elbows pinned to your sides through the whole rep.'
  },

  // ---------------- PULL ----------------
  'lat-pulldown': {
    id: 'lat-pulldown', name: 'Lat Pulldown (neutral or wide grip)', category: 'pull', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 90, increment: 5,
    caution: 'Neutral/close grip is easier on your shoulder than a wide pronated grip. Pull to the collarbone, not behind the neck.'
  },
  'seated-cable-row': {
    id: 'seated-cable-row', name: 'Seated Cable Row (neutral grip)', category: 'pull', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 90, increment: 5,
    caution: 'Avoid yanking with a hard lean-back. Control the stretch forward without rounding the shoulder into pain.'
  },
  'single-arm-db-row': {
    id: 'single-arm-db-row', name: 'Single-Arm Dumbbell Row', category: 'pull', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 75, increment: 5,
    caution: 'Support yourself on a bench; pull to your hip, elbow close to the body.'
  },
  'band-pull-apart': {
    id: 'band-pull-apart', name: 'Band Pull-Apart', category: 'rehab', type: 'weight',
    sets: 3, repRange: [15, 20], restSec: 30, increment: 0,
    caution: 'Scapular stability / rotator cuff prehab. Slow, controlled, no momentum. Increase band tension only when 20 reps feel easy.'
  },
  'cable-external-rotation': {
    id: 'cable-external-rotation', name: 'Cable / Band External Rotation', category: 'rehab', type: 'weight',
    sets: 3, repRange: [12, 15], restSec: 45, increment: 0,
    caution: 'Elbow pinned to your side, forearm rotates out. This is the single best direct rotator-cuff strengthening move — keep it light forever, it is not meant to get heavy.'
  },
  'db-curl': {
    id: 'db-curl', name: 'Dumbbell Bicep Curl', category: 'pull', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 60, increment: 5,
    caution: null
  },
  'hammer-curl': {
    id: 'hammer-curl', name: 'Hammer Curl', category: 'pull', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 60, increment: 5,
    caution: null
  },
  'dead-hang': {
    id: 'dead-hang', name: 'Dead Hang', category: 'rehab', type: 'time',
    sets: 3, timeRange: [15, 45], restSec: 60, timeIncrement: 5,
    caution: 'Great for shoulder decompression and grip, but come off the bar immediately if you feel pinching rather than a stretch.'
  },

  // ---------------- LEGS ----------------
  'leg-press': {
    id: 'leg-press', name: 'Leg Press (partial, pain-free range)', category: 'legs', type: 'weight',
    sets: 3, repRange: [10, 15], restSec: 120, increment: 20,
    caution: 'Only go as deep as your knee is pain-free — a partial rep with no pain beats a full rep with pinching under the kneecap.'
  },
  'romanian-deadlift': {
    id: 'romanian-deadlift', name: 'Romanian Deadlift', category: 'legs', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 120, increment: 10,
    caution: 'Hip-hinge, near-straight legs — this loads the hamstrings/glutes and largely spares the knee.'
  },
  'hip-thrust': {
    id: 'hip-thrust', name: 'Barbell Hip Thrust', category: 'legs', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 120, increment: 10,
    caution: 'Glute-dominant, minimal knee flexion under load — good knee-friendly builder.'
  },
  'walking-lunge': {
    id: 'walking-lunge', name: 'Walking Lunge', category: 'legs', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 90, increment: 5,
    caution: 'Shorter stride keeps the front knee from traveling far past the toes. Skip or shorten range on days your knee is cranky.'
  },
  'seated-leg-curl': {
    id: 'seated-leg-curl', name: 'Seated Leg Curl', category: 'legs', type: 'weight',
    sets: 3, repRange: [10, 15], restSec: 90, increment: 5,
    caution: 'Hamstring work that balances the quad/patellar-tendon load — helpful for knee health.'
  },
  'spanish-squat': {
    id: 'spanish-squat', name: 'Spanish Squat (isometric)', category: 'rehab', type: 'time',
    sets: 4, timeRange: [30, 45], restSec: 60, timeIncrement: 5,
    caution: 'The go-to isometric for patellar tendinopathy. Band/strap around a rack at knee height, lean back into it. Aim for a 5-6/10 pull on the tendon — not sharp pain. Great before or after knee-loading work.'
  },
  'wall-sit': {
    id: 'wall-sit', name: 'Wall Sit (isometric)', category: 'rehab', type: 'time',
    sets: 3, timeRange: [30, 60], restSec: 60, timeIncrement: 5,
    caution: 'Thighs roughly parallel to the floor, or shallower if that is where your knee is pain-free.'
  },
  'standing-calf-raise': {
    id: 'standing-calf-raise', name: 'Standing Calf Raise', category: 'legs', type: 'weight',
    sets: 3, repRange: [10, 15], restSec: 60, increment: 5,
    caution: null
  },

  // ---------------- CORE / CONDITIONING ----------------
  'plank': {
    id: 'plank', name: 'Plank', category: 'core', type: 'time',
    sets: 3, timeRange: [30, 60], restSec: 45, timeIncrement: 5,
    caution: null
  },
  'side-plank': {
    id: 'side-plank', name: 'Side Plank', category: 'core', type: 'time',
    sets: 2, timeRange: [20, 45], restSec: 45, timeIncrement: 5,
    caution: null
  },
  'dead-bug': {
    id: 'dead-bug', name: 'Dead Bug', category: 'core', type: 'weight',
    sets: 3, repRange: [8, 12], restSec: 45, increment: 0,
    caution: 'Reps per side. Keep low back flat on the floor the whole time.'
  },
  'bike-intervals': {
    id: 'bike-intervals', name: 'Stationary Bike Intervals', category: 'conditioning', type: 'time',
    sets: 6, timeRange: [30, 60], restSec: 60, timeIncrement: 5,
    caution: 'Low-impact cardio that spares your knee. Hard effort on the work interval, easy spin on the rest.'
  },
  'farmers-carry': {
    id: 'farmers-carry', name: "Farmer's Carry", category: 'conditioning', type: 'time',
    sets: 3, timeRange: [20, 40], restSec: 60, timeIncrement: 5,
    caution: 'Grip, core and conditioning in one move. Keep shoulders packed down and back, not shrugged.'
  }
};

if (typeof module !== 'undefined') module.exports = { EXERCISES };
