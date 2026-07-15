// Manages the active workout session: which day, which exercises, per-set
// logging, and committing a finished session into history.

const Session = {
  // A soft suggestion only (shown as a hint in the day picker) — the day
  // after whichever one was last completed in the active plan. The user is
  // always free to pick any day; nothing auto-starts.
  getSuggestedDayIndex() {
    const plan = Plans.getActive();
    const meta = Storage.getMeta();
    if (meta.lastPlanId !== plan.id || meta.lastCompletedDayIndex == null || meta.lastCompletedDayIndex < 0) {
      return 0;
    }
    return (meta.lastCompletedDayIndex + 1) % plan.days.length;
  },

  getActive() {
    return Storage.getActiveSession();
  },

  // Resolves the plan day a session belongs to, using the plan it was
  // started under (not necessarily the currently active plan — the user
  // may switch plans while a session from a different one is in progress).
  getDay(session) {
    const plan = Plans.get(session.planId) || Plans.getActive();
    return plan.days[session.dayIndex];
  },

  start(planId, dayIndex) {
    const plan = Plans.get(planId);
    const day = plan.days[dayIndex];
    const entries = {};
    day.exercises.forEach((exerciseId) => {
      const exercise = ExerciseRegistry.get(exerciseId);
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
      planId: plan.id,
      dayIndex,
      dayId: day.id,
      startedAt: new Date().toISOString(),
      currentExerciseIndex: 0,
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

  goToExercise(session, index) {
    const exerciseIds = Object.keys(session.entries);
    session.currentExerciseIndex = Math.max(0, Math.min(index, exerciseIds.length - 1));
    Storage.saveActiveSession(session);
    return session;
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
    const day = Session.getDay(session);
    Storage.appendSessionLog({
      date,
      dayId: day.id,
      label: day.label,
      exerciseCount: loggedExerciseCount
    });
    Storage.saveMeta({ lastCompletedDayIndex: session.dayIndex, lastPlanId: session.planId });
    Storage.clearActiveSession();
  },

  completeRestDay(planId, dayIndex) {
    Storage.saveMeta({ lastCompletedDayIndex: dayIndex, lastPlanId: planId });
  },

  // Skips today's workout entirely: discards any in-progress (unlogged) sets
  // and advances the rotation hint past this day, without recording any
  // exercise history for today. Different from discard(), which abandons
  // progress but leaves the suggested day unchanged for next time.
  skipToday(planId, dayIndex) {
    Storage.clearActiveSession();
    Storage.saveMeta({ lastCompletedDayIndex: dayIndex, lastPlanId: planId });
  },

  discard() {
    Storage.clearActiveSession();
  }
};

if (typeof module !== 'undefined') module.exports = { Session };
