// Skill definitions, scoring and box-score math for volleyball stats.
// Each skill has a keyboard key and a list of results. `point` says which
// side wins the rally by default when that result is logged.

const SKILLS = {
  serve: {
    label: 'Serve', key: 's',
    results: [
      { code: 'ace', label: 'Ace', point: 'us' },
      { code: 'in', label: 'In play' },
      { code: 'err', label: 'Error', point: 'them' }
    ]
  },
  pass: {
    label: 'Pass', key: 'r',
    results: [
      { code: '3', label: '3 Perfect' },
      { code: '2', label: '2 Good' },
      { code: '1', label: '1 Poor' },
      { code: '0', label: '0 Aced/Err', point: 'them' }
    ]
  },
  set: {
    label: 'Set', key: 'e',
    results: [
      { code: 'ast', label: 'Assist' },
      { code: 'in', label: 'In play' },
      { code: 'err', label: 'Error', point: 'them' }
    ]
  },
  attack: {
    label: 'Attack', key: 'a',
    results: [
      { code: 'kill', label: 'Kill', point: 'us' },
      { code: 'in', label: 'In play' },
      { code: 'err', label: 'Error', point: 'them' },
      { code: 'blk', label: 'Blocked', point: 'them' }
    ]
  },
  block: {
    label: 'Block', key: 'b',
    results: [
      { code: 'solo', label: 'Solo', point: 'us' },
      { code: 'assist', label: 'Assist', point: 'us' },
      { code: 'touch', label: 'Touch' },
      { code: 'err', label: 'Error', point: 'them' }
    ]
  },
  dig: {
    label: 'Dig', key: 'd',
    results: [
      { code: 'dig', label: 'Dig' },
      { code: 'err', label: 'Error', point: 'them' }
    ]
  },
  // Rally outcomes not tied to one of our players.
  team: {
    label: 'Team', key: null, hidden: true,
    results: [
      { code: 'opperr', label: 'Opponent error', point: 'us' },
      { code: 'opppt', label: 'Opponent point', point: 'them' }
    ]
  }
};

function resultOf(skill, code) {
  const s = SKILLS[skill];
  return s && s.results.find((r) => r.code === code);
}

function eventLabel(ev) {
  const s = SKILLS[ev.skill];
  const r = resultOf(ev.skill, ev.result);
  if (ev.skill === 'team') return r ? r.label : ev.result;
  return (s ? s.label : ev.skill) + ' – ' + (r ? r.label : ev.result);
}

// Chronological order: by set, then video time. Untimed (live-tagged)
// events keep their insertion order thanks to the stable sort.
function sortEvents(events) {
  return events.sort((a, b) => {
    if (a.set !== b.set) return a.set - b.set;
    if (a.t == null || b.t == null) return 0;
    return a.t - b.t;
  });
}

function setTarget(set) { return set >= 5 ? 15 : 25; }

function isSetOver(us, them, set) {
  const target = setTarget(set);
  return (us >= target || them >= target) && Math.abs(us - them) >= 2;
}

// Returns { sets: {1: {us, them}, ...}, after: Map(eventId -> "us-them") }
function computeScore(events) {
  const sets = {};
  const after = new Map();
  for (const ev of events) {
    const s = sets[ev.set] || (sets[ev.set] = { us: 0, them: 0 });
    if (ev.point === 'us') s.us++;
    else if (ev.point === 'them') s.them++;
    else continue;
    after.set(ev.id, s.us + '-' + s.them);
  }
  return { sets, after };
}

function setsWon(sets) {
  let us = 0, them = 0;
  for (const [n, s] of Object.entries(sets)) {
    if (!isSetOver(s.us, s.them, +n)) continue;
    if (s.us > s.them) us++; else them++;
  }
  return { us, them };
}

function emptyLine() {
  return { k: 0, ae: 0, ta: 0, sa: 0, se: 0, st: 0, rec: 0, recSum: 0, r3: 0, r0: 0,
           ast: 0, sete: 0, d: 0, de: 0, bs: 0, ba: 0, be: 0 };
}

function addToLine(line, ev) {
  switch (ev.skill) {
    case 'attack':
      line.ta++;
      if (ev.result === 'kill') line.k++;
      if (ev.result === 'err' || ev.result === 'blk') line.ae++;
      break;
    case 'serve':
      line.st++;
      if (ev.result === 'ace') line.sa++;
      if (ev.result === 'err') line.se++;
      break;
    case 'pass':
      line.rec++;
      line.recSum += +ev.result;
      if (ev.result === '3') line.r3++;
      if (ev.result === '0') line.r0++;
      break;
    case 'set':
      if (ev.result === 'ast') line.ast++;
      if (ev.result === 'err') line.sete++;
      break;
    case 'dig':
      if (ev.result === 'dig') line.d++;
      if (ev.result === 'err') line.de++;
      break;
    case 'block':
      if (ev.result === 'solo') line.bs++;
      if (ev.result === 'assist') line.ba++;
      if (ev.result === 'err') line.be++;
      break;
  }
}

function finishLine(line) {
  line.pts = line.k + line.sa + line.bs + 0.5 * line.ba;
  line.hit = line.ta ? (line.k - line.ae) / line.ta : null;
  line.recAvg = line.rec ? line.recSum / line.rec : null;
  line.blk = line.bs + 0.5 * line.ba;
  return line;
}

// Box score per player plus a team total row. setFilter: null for all sets.
function computeBoxScore(events, players, setFilter) {
  const rows = new Map();
  const total = emptyLine();
  for (const ev of events) {
    if (setFilter && ev.set !== setFilter) continue;
    if (!ev.playerId) continue;
    if (!rows.has(ev.playerId)) rows.set(ev.playerId, emptyLine());
    addToLine(rows.get(ev.playerId), ev);
    addToLine(total, ev);
  }
  const list = [];
  for (const p of players) {
    const line = rows.get(p.id);
    if (!line && p.removed) continue;
    list.push({ player: p, line: finishLine(line || emptyLine()) });
  }
  list.sort((a, b) => (+a.player.number || 0) - (+b.player.number || 0));
  return { rows: list, total: finishLine(total) };
}

// Which events a box-score cell represents (used to filter the log / clips).
const STAT_FILTERS = {
  k: { skill: 'attack', results: ['kill'] },
  ae: { skill: 'attack', results: ['err', 'blk'] },
  ta: { skill: 'attack' },
  sa: { skill: 'serve', results: ['ace'] },
  se: { skill: 'serve', results: ['err'] },
  st: { skill: 'serve' },
  rec: { skill: 'pass' },
  r3: { skill: 'pass', results: ['3'] },
  r0: { skill: 'pass', results: ['0'] },
  ast: { skill: 'set', results: ['ast'] },
  d: { skill: 'dig', results: ['dig'] },
  de: { skill: 'dig', results: ['err'] },
  bs: { skill: 'block', results: ['solo'] },
  ba: { skill: 'block', results: ['assist'] },
  be: { skill: 'block', results: ['err'] }
};

function matchesFilter(ev, f) {
  if (!f) return true;
  if (f.set && ev.set !== f.set) return false;
  if (f.playerId && ev.playerId !== f.playerId) return false;
  if (f.skill && ev.skill !== f.skill) return false;
  if (f.results && !f.results.includes(ev.result)) return false;
  return true;
}

function fmtTime(t) {
  if (t == null || isNaN(t)) return '—';
  t = Math.max(0, Math.floor(t));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}

function fmtPct(x) { return x == null ? '—' : x.toFixed(3).replace(/^0/, '').replace(/^-0/, '-'); }
function fmtNum(x, d) { return x == null ? '—' : (Number.isInteger(x) ? String(x) : x.toFixed(d == null ? 1 : d)); }
