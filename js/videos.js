// Reference video for each exercise, shown as a "Watch form video" link in the UI.
// Populated from real web-search results (title/channel/url), not guessed.
// Prefer short-form (YouTube Shorts, ~10-30s) quick-demo clips; channel is null
// where the source channel couldn't be confidently identified.
const VIDEOS = {
  'db-bench-press': { title: 'Flat Dumbbell Bench Press - Under 60s How-to', url: 'https://www.youtube.com/shorts/SidmT09GXz8', channel: 'Schaum Fitness' },
  'incline-db-press': { title: 'Alternating Incline Dumbbell Press', url: 'https://www.youtube.com/shorts/z1EBfhjePXI', channel: null },
  'cable-fly': { title: 'Cable Fly Low to High', url: 'https://www.youtube.com/shorts/N6gMBSm9BAY', channel: null },
  'db-lateral-raise': { title: 'Dumbbell Lateral Raise', url: 'https://www.youtube.com/shorts/xyK8UiC-BUw', channel: null },
  'cable-face-pull': { title: 'Cable Rope Face Pulls', url: 'https://www.youtube.com/shorts/xKpXv80Yz14', channel: null },
  'landmine-press': { title: 'Landmine Press – Exercise Demonstration', url: 'https://www.youtube.com/shorts/n7ZYVAzx4Ek', channel: 'Gevorgyan Grind' },
  'rope-pushdown': { title: 'Cable Rope Tricep Pushdown', url: 'https://www.youtube.com/shorts/PC6dREPvYlQ', channel: null },
  'lat-pulldown': { title: 'Lat Pulldown Machine Tutorial', url: 'https://www.youtube.com/shorts/3q1Zsi3vkjo', channel: null },
  'seated-cable-row': { title: 'Seated Cable Rows Demonstration', url: 'https://www.youtube.com/shorts/jqYQOQqLNgQ', channel: null },
  'single-arm-db-row': { title: 'Single Arm Dumbbell Row Tutorial', url: 'https://www.youtube.com/shorts/jpZFcJ8tBj0', channel: null },
  'band-pull-apart': { title: 'Band Pull Apart', url: 'https://www.youtube.com/shorts/U8OdfnlwIac', channel: null },
  'cable-external-rotation': { title: 'Cable External Rotations', url: 'https://www.youtube.com/shorts/2ecwzoBRq-g', channel: null },
  'db-curl': { title: 'Dumbbell Bicep Curls', url: 'https://www.youtube.com/shorts/PuaJzTatIJM', channel: null },
  'hammer-curl': { title: 'Hammer Curl', url: 'https://www.youtube.com/shorts/Ud910q4hSQ4', channel: null },
  'dead-hang': { title: 'How To Dead Hang Correctly', url: 'https://www.youtube.com/shorts/dOCQjaasbGs', channel: null },
  'leg-press': { title: 'How To Leg Press With Perfect Technique', url: 'https://www.youtube.com/shorts/nDh_BlnLCGc', channel: null },
  'romanian-deadlift': { title: 'Dumbbell Romanian Deadlift (RDL) Tutorial', url: 'https://www.youtube.com/shorts/wiekN4aIJ0g', channel: null },
  'hip-thrust': { title: 'Barbell Hip Thrust Setup & Form', url: 'https://www.youtube.com/shorts/W86oVlnLqY4', channel: null },
  'walking-lunge': { title: 'Walking Lunge', url: 'https://www.youtube.com/shorts/IRq5o3ntLIE', channel: null },
  'seated-leg-curl': { title: 'Seated Leg Curl - Setup & Technique', url: 'https://www.youtube.com/shorts/lcW1M2VKNYc', channel: null },
  'spanish-squat': { title: 'Spanish Squats', url: 'https://www.youtube.com/shorts/dFuR4s4v4nQ', channel: null },
  'wall-sit': { title: 'Wall Sit', url: 'https://www.youtube.com/shorts/H9Zt0qD2hy4', channel: null },
  'standing-calf-raise': { title: 'Standing Calf Raise', url: 'https://www.youtube.com/shorts/rsOLKY02m70', channel: null },
  'plank': { title: 'How to Do a Plank', url: 'https://www.youtube.com/shorts/hoeNgjheDHk', channel: 'Phil Daru' },
  'side-plank': { title: 'Side Plank', url: 'https://www.youtube.com/shorts/WWPpxTrE0Uk', channel: null },
  'dead-bug': { title: 'Dead Bug Exercise Demonstration for Beginners', url: 'https://www.youtube.com/shorts/Bgn0OXKEX2o', channel: null },
  'bike-intervals': { title: 'HIIT Indoor Cycling Workout | 30 Minute Intervals', url: 'https://www.youtube.com/watch?v=ZiGE3-L4vyg', channel: 'GCN Training' },
  'farmers-carry': { title: 'Kettlebell Farmer Carry Tutorial', url: 'https://www.youtube.com/shorts/k83HQI2P-rk', channel: null }
};

if (typeof module !== 'undefined') module.exports = { VIDEOS };
