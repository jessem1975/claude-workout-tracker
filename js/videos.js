// Reference video for each exercise, shown as a "Watch form video" link in the UI.
// Populated from real web-search results (title/channel/url), not guessed.
const VIDEOS = {
  'db-bench-press': { title: 'Dumbbell Bench Press Form (Altering Chest Activation)', url: 'https://www.youtube.com/watch?v=kgr3lCKx6_M', channel: 'ATHLEAN-X' },
  'incline-db-press': { title: 'How To: Dumbbell Incline Press | 3 GOLDEN RULES', url: 'https://www.youtube.com/watch?v=hChjZQhX1Ls', channel: 'Scott Herman Fitness' },
  'cable-fly': { title: 'HOW TO: Chest "Low-To-High" Cable Fly (BIGGER UPPER CHEST)', url: 'https://www.youtube.com/watch?v=eQ_NBB6OBH4', channel: 'Scott Herman Fitness' },
  'db-lateral-raise': { title: 'Rotator Cuff Killer (SHOULDER LATERAL RAISES!)', url: 'https://www.youtube.com/watch?v=q5sNYB1Q6aM', channel: 'ATHLEAN-X' },
  'cable-face-pull': { title: 'Stop Doing Face Pulls Like This!', url: 'https://www.youtube.com/watch?v=eIq5CB9JfKE', channel: 'ATHLEAN-X' },
  'landmine-press': { title: 'The landmine setup — a shoulder-friendly pressing tool', url: 'https://www.youtube.com/shorts/7nWs5KaDn68', channel: 'ATHLEAN-X' },
  'rope-pushdown': { title: 'Rocking Triceps Push Down with Rope: Technique', url: 'https://www.youtube.com/watch?v=fIXvhr5URd4', channel: 'ATHLEAN-X' },
  'lat-pulldown': { title: 'How to: Neutral Grip Pulldown [Lats-focused]', url: 'https://www.youtube.com/watch?v=kVB6SlEyjQM', channel: 'Physique Development (Austin Current)' },
  'seated-cable-row': { title: 'IRON FACE/OFF: Which Row is Best for Bigger Lats?', url: 'https://www.youtube.com/watch?v=CrpbOUglg7o', channel: 'ATHLEAN-X' },
  'single-arm-db-row': { title: 'How to Perform Single Arm Dumbbell Rows', url: 'https://www.youtube.com/watch?v=nMFCMNKnLgQ', channel: 'Buff Dudes' },
  'band-pull-apart': { title: 'Shoulder Strengthening With Bands (Beginner & Advanced)', url: 'https://www.youtube.com/watch?v=1Xt8x-cwcfA', channel: 'Bob and Brad' },
  'cable-external-rotation': { title: 'Shoulder External Rotation with Resistive Band', url: 'https://www.youtube.com/watch?v=_UvmPNGtlPM', channel: 'Ask Doctor Jo' },
  'db-curl': { title: 'Proper Form Bicep Curls', url: 'https://www.youtube.com/watch?v=KS-1_r9K4XA', channel: 'ATHLEAN-X' },
  'hammer-curl': { title: 'HOW TO: Dumbbell Hammer Curl (BICEPS PEAK BUILDER!)', url: 'https://www.youtube.com/watch?v=8XLxfXROrTo', channel: 'Scott Herman Fitness' },
  'dead-hang': { title: 'Why & How "Hanging" Stops Shoulder Pain & Surgery', url: 'https://www.youtube.com/watch?v=bI9KZVdFSmQ', channel: 'Bob and Brad' },
  'leg-press': { title: 'How to PROPERLY Leg Press (FIX YOUR FORM NOW)', url: 'https://www.youtube.com/watch?v=K5n2vg3oZa4', channel: 'Colossus Fitness' },
  'romanian-deadlift': { title: 'Do THIS For Proper RDL Technique', url: 'https://www.youtube.com/watch?v=KecWzqYscYc', channel: 'Squat University' },
  'hip-thrust': { title: 'Hip Thrust Instructional Video', url: 'https://www.youtube.com/watch?v=hCm-70-9_XE', channel: 'Bret Contreras' },
  'walking-lunge': { title: "Knee Pain with Lunges (HERE'S YOUR SOLUTION!)", url: 'https://www.youtube.com/watch?v=Q59ZvPhpySM', channel: 'ATHLEAN-X' },
  'seated-leg-curl': { title: 'How to do a Seated Leg Curl | Proper Form & Technique', url: 'https://www.youtube.com/watch?v=_2Kd0d-JEUM', channel: 'NASM' },
  'spanish-squat': { title: "How to Set Up and Perform Spanish Squats Correctly", url: 'https://www.youtube.com/watch?v=hgFxm5KIF7M', channel: 'E3 Rehab' },
  'wall-sit': { title: 'Patellar Tendonitis Knee Pain? Do THIS Instead of Stretching!', url: 'https://www.youtube.com/watch?v=WqTdfqcw9Mw', channel: 'Squat University' },
  'standing-calf-raise': { title: 'Do This EVERY Day for Bigger Calves!', url: 'https://www.youtube.com/watch?v=esdQSIxteQg', channel: 'ATHLEAN-X' },
  'plank': { title: "The TRUTH About Planks", url: 'https://www.youtube.com/watch?v=ZyWEXjdAGCQ', channel: 'ATHLEAN-X' },
  'side-plank': { title: 'How To Do The Side Plank | Essential Core Exercise', url: 'https://www.youtube.com/watch?v=AU0NwxmV__I', channel: 'Dr. Carl Baird' },
  'dead-bug': { title: 'Dead Bug Exercise For Core Stability', url: 'https://www.youtube.com/watch?v=o4GKiEoYClI', channel: 'Pursuit Physical Therapy' },
  'bike-intervals': { title: 'HIIT Indoor Cycling Workout | 30 Minute Intervals', url: 'https://www.youtube.com/watch?v=ZiGE3-L4vyg', channel: 'GCN Training' },
  'farmers-carry': { title: "How to Perform the Farmer's Walk - Exercise Tutorial", url: 'https://www.youtube.com/watch?v=Fkzk_RqlYig', channel: 'Buff Dudes' }
};

if (typeof module !== 'undefined') module.exports = { VIDEOS };
