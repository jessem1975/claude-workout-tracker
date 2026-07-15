// Merges the built-in exercise catalog (js/exercises.js) with user-added
// custom exercises (created when importing a plan from Excel), so the rest
// of the app can look up any exercise — built-in or custom — the same way.

const CUSTOM_EXERCISES_KEY = 'wt_custom_exercises_v1';

const ExerciseRegistry = {
  getCustom() {
    try {
      const raw = localStorage.getItem(CUSTOM_EXERCISES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Failed to read custom exercises', e);
      return {};
    }
  },
  saveCustom(customMap) {
    localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(customMap));
  },
  addCustom(exercise) {
    const custom = this.getCustom();
    custom[exercise.id] = exercise;
    this.saveCustom(custom);
  },
  get(id) {
    return EXERCISES[id] || this.getCustom()[id] || null;
  },
  all() {
    return Object.assign({}, EXERCISES, this.getCustom());
  }
};

if (typeof module !== 'undefined') module.exports = { ExerciseRegistry, CUSTOM_EXERCISES_KEY };
