// Thin localStorage wrapper. All app state lives client-side on the phone —
// no server, works fully offline.

const STORAGE_KEYS = {
  settings: 'wt_settings_v1',
  history: 'wt_history_v1',
  session: 'wt_session_v1',
  meta: 'wt_meta_v1',
  log: 'wt_sessionlog_v1'
};

const DEFAULT_SETTINGS = {
  units: 'lb',
  soundEnabled: true,
  vibrationEnabled: true,
  extraRestSec: 0
};

const Storage = {
  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read failed for', key, e);
      return fallback;
    }
  },
  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write failed for', key, e);
    }
  },

  getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, this._read(STORAGE_KEYS.settings, {}));
  },
  saveSettings(settings) {
    this._write(STORAGE_KEYS.settings, settings);
  },

  // history: { [exerciseId]: [ {date, sets:[{weight,reps}], duration, load} , ... ] }
  getHistory() {
    return this._read(STORAGE_KEYS.history, {});
  },
  getExerciseHistory(exerciseId) {
    const h = this.getHistory();
    return h[exerciseId] || [];
  },
  appendExerciseEntry(exerciseId, entry) {
    const h = this.getHistory();
    if (!h[exerciseId]) h[exerciseId] = [];
    h[exerciseId].push(entry);
    // keep the most recent 20 sessions per exercise
    if (h[exerciseId].length > 20) h[exerciseId] = h[exerciseId].slice(-20);
    this._write(STORAGE_KEYS.history, h);
  },

  getMeta() {
    return this._read(STORAGE_KEYS.meta, { lastCompletedDayIndex: -1 });
  },
  saveMeta(meta) {
    this._write(STORAGE_KEYS.meta, meta);
  },

  getActiveSession() {
    return this._read(STORAGE_KEYS.session, null);
  },
  saveActiveSession(session) {
    this._write(STORAGE_KEYS.session, session);
  },
  clearActiveSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
  },

  getSessionLog() {
    return this._read(STORAGE_KEYS.log, []);
  },
  appendSessionLog(summary) {
    const log = this.getSessionLog();
    log.push(summary);
    if (log.length > 100) log.shift();
    this._write(STORAGE_KEYS.log, log);
  }
};

if (typeof module !== 'undefined') module.exports = { Storage, STORAGE_KEYS, DEFAULT_SETTINGS };
