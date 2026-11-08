// Persistence: everything lives in one localStorage record.
// All reads/writes go through this module so it can later be swapped for
// (or synced with) a hosted backend without touching the UI code.
const Store = (() => {
  const KEY = 'vbstats:v1';
  const SCHEMA_VERSION = 1;
  const DEFAULT_PREFS = { autoPause: true, preroll: 4, postroll: 3, skipDead: false, serverUrl: '', serverToken: '' };
  let db;

  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.teams) || !Array.isArray(db.matches)) {
      db = { teams: [], matches: [] };
    }
    db.prefs = Object.assign({}, DEFAULT_PREFS, db.prefs);
    migrate(db);
    return db;
  }

  // Upgrade older saved data in place. Add a step here whenever the shape
  // of teams/matches/events changes.
  function migrate(data) {
    data.schemaVersion = data.schemaVersion || 1;
    // if (data.schemaVersion < 2) { ...; data.schemaVersion = 2; }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('store-error', { detail: 'Could not save. Browser storage may be full or blocked; export a backup.' }));
    }
  }

  function replace(data) {
    if (!data || !Array.isArray(data.teams) || !Array.isArray(data.matches)) {
      throw new Error('Not a Volleyball Stats backup file');
    }
    migrate(data);
    if (data.schemaVersion > SCHEMA_VERSION) throw new Error('This backup is from a newer version of the app');
    db.teams = data.teams;
    db.matches = data.matches;
    if (data.prefs) db.prefs = Object.assign({}, DEFAULT_PREFS, data.prefs);
    save();
  }

  // Merge a single exported match (and its team, if we don't have it).
  // Returns false (and changes nothing) if the match exists and replace is false.
  function importMatch(data, replace) {
    if (!data || !data.match || !Array.isArray(data.match.events)) {
      throw new Error('Not a match export file');
    }
    const i = db.matches.findIndex((m) => m.id === data.match.id);
    if (i >= 0 && !replace) return false;
    if (data.team && !db.teams.some((t) => t.id === data.team.id)) db.teams.push(data.team);
    if (i >= 0) {
      db.matches[i] = data.match;
    } else {
      db.matches.push(data.match);
    }
    save();
    return true;
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  return { SCHEMA_VERSION, load, save, replace, importMatch, uid, get db() { return db; } };
})();
