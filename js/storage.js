// Thin localStorage wrapper. All app state lives client-side on the phone —
// no server, works fully offline.

const STORAGE_KEYS = {
  settings: 'wt_settings_v1',
  history: 'wt_history_v1',
  session: 'wt_session_v1',
  meta: 'wt_meta_v1',
  log: 'wt_sessionlog_v1',
  lastBackupAt: 'wt_lastbackup_v1',
  lastPromptedAt: 'wt_lastprompted_v1'
};

const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
const PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // don't nag more than once a day

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
  },

  hasAnyLoggedData() {
    return Object.keys(this.getHistory()).length > 0 || this.getSessionLog().length > 0;
  },

  getLastBackupAt() {
    return this._read(STORAGE_KEYS.lastBackupAt, null);
  },
  markBackedUpNow() {
    this._write(STORAGE_KEYS.lastBackupAt, Date.now());
  },
  getLastPromptedAt() {
    return this._read(STORAGE_KEYS.lastPromptedAt, null);
  },
  markPromptedNow() {
    this._write(STORAGE_KEYS.lastPromptedAt, Date.now());
  },
  isBackupDue() {
    if (!this.hasAnyLoggedData()) return false;
    const last = this.getLastBackupAt();
    if (!last) return true;
    return Date.now() - last >= BACKUP_INTERVAL_MS;
  },
  canPromptForBackup() {
    const last = this.getLastPromptedAt();
    if (!last) return true;
    return Date.now() - last >= PROMPT_COOLDOWN_MS;
  },

  exportAll() {
    return {
      schema: 'workout-tracker-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      history: this.getHistory(),
      meta: this.getMeta(),
      sessionLog: this.getSessionLog(),
      activeSession: this.getActiveSession()
    };
  },
  importAll(data) {
    if (!data || data.schema !== 'workout-tracker-backup') {
      throw new Error('This file doesn\'t look like a Workout Tracker backup.');
    }
    if (data.settings) this._write(STORAGE_KEYS.settings, data.settings);
    if (data.history) this._write(STORAGE_KEYS.history, data.history);
    if (data.meta) this._write(STORAGE_KEYS.meta, data.meta);
    if (data.sessionLog) this._write(STORAGE_KEYS.log, data.sessionLog);
    if (data.activeSession) this._write(STORAGE_KEYS.session, data.activeSession);
    else localStorage.removeItem(STORAGE_KEYS.session);
  }
};

if (typeof module !== 'undefined') module.exports = { Storage, STORAGE_KEYS, DEFAULT_SETTINGS };
