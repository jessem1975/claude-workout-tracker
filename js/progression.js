// Double-progression engine.
//
// Weight exercises: work within a rep range at a fixed weight. Once every set
// hits the top of the range, add weight and drop back to the bottom of the
// range. If sets fall short of the bottom of the range twice in a row, deload.
//
// Time exercises: same idea, but the variable is hold/interval duration
// instead of reps.

const Progression = {
  suggestForExercise(exercise, history) {
    if (exercise.type === 'time') return this._suggestTime(exercise, history);
    return this._suggestWeight(exercise, history);
  },

  _lastTwo(history) {
    return history.slice(-2);
  },

  _suggestWeight(exercise, history) {
    const [lo, hi] = exercise.repRange;
    if (!history || history.length === 0) {
      return {
        type: 'weight',
        weight: null,
        targetReps: lo,
        note: `First session — pick a weight you can control for ${lo}-${hi} reps with 1-2 reps left in the tank.`
      };
    }
    const last = history[history.length - 1];
    const lastWeight = last.sets[last.sets.length - 1].weight;
    const minReps = Math.min(...last.sets.map(s => s.reps));
    const allHitTop = last.sets.every(s => s.reps >= hi);
    const allHitBottom = last.sets.every(s => s.reps >= lo);

    if (allHitTop) {
      const nextWeight = round(lastWeight + (exercise.increment || 0));
      return {
        type: 'weight',
        weight: nextWeight,
        targetReps: lo,
        note: `Nailed ${hi}+ reps on every set last time at ${fmtWeight(lastWeight)}. Move up to ${fmtWeight(nextWeight)} and aim for ${lo} reps.`
      };
    }

    if (allHitBottom) {
      return {
        type: 'weight',
        weight: lastWeight,
        targetReps: Math.min(minReps + 1, hi),
        note: `Stay at ${fmtWeight(lastWeight)}. Push for at least ${Math.min(minReps + 1, hi)} reps on your weakest set to keep climbing toward ${hi}.`
      };
    }

    // Missed the bottom of the range — check for a two-session slump before suggesting a deload.
    const prev = history.length > 1 ? history[history.length - 2] : null;
    const prevMinReps = prev ? Math.min(...prev.sets.map(s => s.reps)) : null;
    if (prev && prevMinReps !== null && prevMinReps < lo && minReps < lo) {
      const deload = round(lastWeight * 0.9);
      return {
        type: 'weight',
        weight: deload,
        targetReps: lo,
        note: `Missed ${lo} reps two sessions in a row at ${fmtWeight(lastWeight)}. Drop to ${fmtWeight(deload)} to rebuild momentum.`
      };
    }

    return {
      type: 'weight',
      weight: lastWeight,
      targetReps: lo,
      note: `Stay at ${fmtWeight(lastWeight)} and focus on getting all sets to ${lo} reps before adding weight.`
    };
  },

  _suggestTime(exercise, history) {
    const [lo, hi] = exercise.timeRange;
    const step = exercise.timeIncrement || 5;
    if (!history || history.length === 0) {
      return {
        type: 'time',
        duration: lo,
        note: `First session — start at ${lo}s per set and stop early if you feel sharp pain rather than tension/fatigue.`
      };
    }
    const last = history[history.length - 1];
    const durations = last.sets.map(s => s.duration || 0);
    const minDuration = Math.min(...durations);
    const allHitTop = durations.every(d => d >= hi);
    const allHitBottom = durations.every(d => d >= lo);

    if (allHitTop) {
      const next = Math.min(hi + step, hi + step * 3);
      return {
        type: 'time',
        duration: next,
        note: `Held ${hi}s+ on every set. Increase the target to ${next}s next time.`
      };
    }
    if (allHitBottom) {
      return {
        type: 'time',
        duration: Math.min(minDuration + step, hi),
        note: `Solid — all sets reached ${lo}s. Push toward ${Math.min(minDuration + step, hi)}s.`
      };
    }
    return {
      type: 'time',
      duration: lo,
      note: `Focus on reaching ${lo}s on every set before increasing the target.`
    };
  }
};

function round(n) {
  return Math.round(n * 4) / 4; // nearest quarter unit, handles small plates
}
function fmtWeight(w) {
  return `${w}`;
}

if (typeof module !== 'undefined') module.exports = { Progression };
