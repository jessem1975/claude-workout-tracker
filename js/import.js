// Parses an uploaded Excel workbook into a draft plan (days + exercises)
// using the vendored SheetJS library. Expected columns (case-insensitive,
// any order): Day, Exercise, Sets, Reps, Rest (sec), and optionally Focus.
// "Reps" accepts a single number ("10"), a range ("8-12"), or a hold time
// ("30s") for time-based moves like planks or isometrics.

const Importer = {
  parseWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error('The workbook has no sheets.');
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return this._parseRows(rows);
  },

  _findHeaderIndex(headerRow, candidates) {
    const lower = headerRow.map((h) => String(h).trim().toLowerCase());
    for (const c of candidates) {
      const idx = lower.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  },

  _slug(str) {
    return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
  },

  _parseReps(raw) {
    const str = String(raw).trim();
    const timeMatch = str.match(/^(\d+)\s*s(ec(onds)?)?$/i);
    if (timeMatch) {
      const val = parseInt(timeMatch[1], 10);
      return { type: 'time', timeRange: [val, val + 10] };
    }
    const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      return { type: 'weight', repRange: [parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)] };
    }
    const single = parseInt(str, 10);
    if (!isNaN(single)) {
      return { type: 'weight', repRange: [Math.max(1, single - 2), single + 2] };
    }
    return { type: 'weight', repRange: [8, 12] };
  },

  _resolveExerciseId(name, spec, newExercises) {
    const slug = this._slug(name);
    if (ExerciseRegistry.get(slug)) return slug;
    if (newExercises.some((e) => e.id === slug)) return slug;

    const exercise = {
      id: slug,
      name,
      category: 'custom',
      type: spec.type,
      sets: spec.sets,
      restSec: spec.restSec,
      caution: null
    };
    if (spec.type === 'time') {
      exercise.timeRange = spec.timeRange;
      exercise.timeIncrement = 5;
    } else {
      exercise.repRange = spec.repRange;
      exercise.increment = 5;
    }
    newExercises.push(exercise);
    return slug;
  },

  _parseRows(rows) {
    if (!rows.length) throw new Error('The sheet appears to be empty.');
    const header = rows[0];
    const col = {
      day: this._findHeaderIndex(header, ['day', 'day label', 'workout']),
      focus: this._findHeaderIndex(header, ['focus', 'muscle group', 'notes']),
      exercise: this._findHeaderIndex(header, ['exercise', 'exercise name', 'movement']),
      sets: this._findHeaderIndex(header, ['sets', 'set']),
      reps: this._findHeaderIndex(header, ['reps', 'reps/time', 'reps or time', 'target']),
      rest: this._findHeaderIndex(header, ['rest', 'rest (sec)', 'rest sec', 'rest seconds'])
    };
    if (col.day === -1 || col.exercise === -1) {
      throw new Error('Could not find "Day" and "Exercise" columns. Expected headers like: Day, Exercise, Sets, Reps, Rest (sec).');
    }

    const daysMap = new Map();
    const newExercises = [];
    const warnings = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => c === '' || c == null)) continue;

      const dayLabel = String(row[col.day] || '').trim();
      const exerciseName = String(row[col.exercise] || '').trim();
      if (!dayLabel || !exerciseName) {
        warnings.push(`Row ${r + 1}: missing day or exercise name, skipped.`);
        continue;
      }

      const sets = parseInt(col.sets !== -1 ? row[col.sets] : '', 10) || 3;
      const restSec = parseInt(col.rest !== -1 ? row[col.rest] : '', 10) || 60;
      const repsRaw = col.reps !== -1 ? row[col.reps] : '';
      const { type, repRange, timeRange } = this._parseReps(repsRaw);

      const exerciseId = this._resolveExerciseId(exerciseName, { type, sets, restSec, repRange, timeRange }, newExercises);

      if (!daysMap.has(dayLabel)) {
        daysMap.set(dayLabel, {
          id: this._slug(dayLabel),
          label: dayLabel,
          focus: col.focus !== -1 ? String(row[col.focus] || '').trim() : '',
          exercises: []
        });
      }
      const day = daysMap.get(dayLabel);
      if (!day.exercises.includes(exerciseId)) day.exercises.push(exerciseId);
    }

    if (daysMap.size === 0) {
      throw new Error('No valid rows found. Make sure each row has a Day and an Exercise.');
    }

    return { days: Array.from(daysMap.values()), newExercises, warnings };
  }
};

if (typeof module !== 'undefined') module.exports = { Importer };
