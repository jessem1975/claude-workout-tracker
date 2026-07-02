// Manages the active workout session: which day, which exercises, per-set
// logging, and committing a finished session into history.

const Session = {
  getNextDayIndex() {
    const meta = Storage.getMeta();
    return (meta.lastCompletedDayIndex + 1) % PLAN.length;
  },

  getActive() {
    return Storage.getActiveSession();
  },

  start(dayIndex) {
    const day = PLAN[dayIndex];
    const entries = {};
    day.exercises.forEach((exerciseId) => {
      const exercise = EXERCISES[exerciseId];
      const history = Storage.getExerciseHistory(exerciseId);
      const suggestion = Progression.suggestForExercise(exercise, history);
      const sets = [];
      for (let i = 0; i < exercise.sets; i++) {
        if (exercise.type === 'time') {
          sets.push({ targetDuration: suggestion.duration, duration: null, done: false });
        } else {
          const lastEntry = history[history.length - 1];
          const lastWeightForSet = lastEntry && lastEntry.sets[i] ? lastEntry.sets[i].weight : suggestion.weight;
          sets.push({
            targetReps: suggestion.targetReps,
            weight: suggestion.weight !== null ? suggestion.weight : lastWeightForSet || null,
            reps: null,
            done: false
          });
        }
      }
      entries[exerciseId] = { type: exercise.type, sets, suggestion };
    });
    const session = {
      dayIndex,
      dayId: day.id,
      startedAt: new Date().toISOString(),
      entries
    };
    Storage.saveActiveSession(session);
    return session;
  },

  logSet(session, exerciseId, setIndex, values) {
    Object.assign(session.entries[exerciseId].sets[setIndex], values, { done: true });
    Storage.saveActiveSession(session);
    return session;
  },

  unlogSet(session, exerciseId, setIndex) {
    session.entries[exerciseId].sets[setIndex].done = false;
    Storage.saveActiveSession(session);
    return session;
  },

  isExerciseComplete(session, exerciseId) {
    return session.entries[exerciseId].sets.every((s) => s.done);
  },

  isLastSet(session, exerciseId, setIndex) {
    const exerciseIds = Object.keys(session.entries);
    const isLastExercise = exerciseIds.indexOf(exerciseId) === exerciseIds.length - 1;
    const isLastSetOfExercise = setIndex === session.entries[exerciseId].sets.length - 1;
    return isLastExercise && isLastSetOfExercise;
  },

  finish(session) {
    const date = new Date().toISOString().slice(0, 10);
    let loggedExerciseCount = 0;
    Object.keys(session.entries).forEach((exerciseId) => {
      const entry = session.entries[exerciseId];
      const doneSets = entry.sets.filter((s) => s.done);
      if (doneSets.length === 0) return;
      loggedExerciseCount++;
      if (entry.type === 'time') {
        Storage.appendExerciseEntry(exerciseId, {
          date,
          sets: doneSets.map((s) => ({ duration: s.duration }))
        });
      } else {
        Storage.appendExerciseEntry(exerciseId, {
          date,
          sets: doneSets.map((s) => ({ weight: s.weight, reps: s.reps }))
        });
      }
    });
    const day = PLAN[session.dayIndex];
    Storage.appendSessionLog({
      date,
      dayId: day.id,
      label: day.label,
      exerciseCount: loggedExerciseCount
    });
    Storage.saveMeta({ lastCompletedDayIndex: session.dayIndex });
    Storage.clearActiveSession();
  },

  completeRestDay(dayIndex) {
    Storage.saveMeta({ lastCompletedDayIndex: dayIndex });
  },

  discard() {
    Storage.clearActiveSession();
  }
};

if (typeof module !== 'undefined') module.exports = { Session };
