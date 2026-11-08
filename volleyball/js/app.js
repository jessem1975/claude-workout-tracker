(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');
  const db = Store.load();
  let cleanup = null;

  const teamById = (id) => db.teams.find((t) => t.id === id);
  const matchById = (id) => db.matches.find((m) => m.id === id);

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function csv(rows) {
    return rows.map((r) => r.map((v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
  }

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'flash'; document.body.appendChild(el); }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }
  window.addEventListener('store-error', (e) => toast(e.detail));

  const slug = (s) => String(s || 'match').replace(/[^\w-]+/g, '_').slice(0, 60);

  function readJsonFile(file) {
    return file.text().then((t) => JSON.parse(t));
  }

  // ---------- Routing ----------
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'teams') return renderTeams();
    if (parts[0] === 'team' && parts[1]) return renderTeam(parts[1]);
    if (parts[0] === 'match' && parts[1]) return renderMatch(parts[1]);
    renderHome();
  }
  window.addEventListener('hashchange', route);

  // ---------- Home / match list ----------
  function matchSummary(m) {
    const { sets } = computeScore(m.events);
    const won = setsWon(sets);
    const setText = Object.keys(sets).sort().map((n) => sets[n].us + '–' + sets[n].them).join(', ');
    return { won, setText };
  }

  function renderHome() {
    const matches = db.matches.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const today = new Date().toISOString().slice(0, 10);
    app.innerHTML = `
      <header class="topbar">
        <h1>Volleyball Stats</h1>
        <a class="btn small" href="#/teams">Teams</a>
      </header>
      <section class="card">
        <h2>New match</h2>
        ${db.teams.length === 0 ? `
          <p class="muted">Start by creating your team and roster.</p>
          <a class="btn primary" href="#/teams">Create a team</a>
        ` : `
        <form id="new-match" class="form-grid">
          <label>Team<select name="team">${db.teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
          <label>Opponent<input name="opponent" required placeholder="e.g. Central HS"></label>
          <label>Date<input name="date" type="date" value="${today}"></label>
          <label>Event / note<input name="title" placeholder="e.g. Fall Classic, pool play"></label>
          <button class="btn primary" type="submit">Create match</button>
        </form>`}
      </section>
      <section class="card">
        <h2>Matches</h2>
        ${matches.length === 0 ? `<p class="muted">No matches yet. Want to look around first?</p>
          <button class="btn" id="load-sample">Load a sample match</button>` : `
        <ul class="list">
          ${matches.map((m) => {
            const t = teamById(m.teamId);
            const s = matchSummary(m);
            return `<li>
              <a class="list-main" href="#/match/${m.id}">
                <strong>${esc(t ? t.name : 'Team')} vs ${esc(m.opponent)}</strong>
                <span class="muted">${esc(m.date || '')}${m.title ? ' · ' + esc(m.title) : ''}</span>
                <span class="muted">${m.events.length} events${s.setText ? ' · Sets ' + s.won.us + '–' + s.won.them + ' (' + s.setText + ')' : ''}</span>
              </a>
              <button class="btn subtle" data-del="${m.id}" aria-label="Delete match">✕</button>
            </li>`;
          }).join('')}
        </ul>`}
      </section>
      <section class="card">
        <h2>Backup</h2>
        <p class="muted">Data is stored only in this browser. Export a backup to move it to another device or share a match.</p>
        <div class="row wrap">
          <button class="btn small" id="export-all">Export all (JSON)</button>
          <label class="btn small">Import file<input type="file" id="import-file" accept=".json,application/json" hidden></label>
        </div>
      </section>
      <p class="footer-link"><a href="../">← Workout Tracker</a></p>
    `;

    const form = $('#new-match');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const m = {
        id: Store.uid(), teamId: f.get('team'), opponent: f.get('opponent').trim(),
        date: f.get('date'), title: f.get('title').trim(), events: [], curSet: 1, video: null
      };
      db.matches.push(m);
      Store.save();
      location.hash = '#/match/' + m.id;
    });

    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const m = matchById(b.dataset.del);
      if (!await Dialog.confirm(`Delete the match vs ${m.opponent} and its ${m.events.length} events?`, { okLabel: 'Delete', danger: true })) return;
      db.matches.splice(db.matches.indexOf(m), 1);
      Store.save();
      renderHome();
    }));

    const sampleBtn = $('#load-sample');
    if (sampleBtn) sampleBtn.addEventListener('click', () => {
      const { team, match } = Sample.build();
      db.teams.push(team);
      db.matches.push(match);
      Store.save();
      location.hash = '#/match/' + match.id;
    });

    $('#export-all').addEventListener('click', () => {
      // Never put the server access token in a file people pass around.
      const safe = Object.assign({}, db, { prefs: Object.assign({}, db.prefs, { serverToken: '' }) });
      download('volleyball-stats-backup-' + today + '.json', JSON.stringify(safe, null, 1), 'application/json');
    });

    $('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readJsonFile(file);
        if (data.match) {
          let ok = Store.importMatch(data, false);
          if (!ok && await Dialog.confirm('This match is already here. Replace it with the imported copy?', { okLabel: 'Replace' })) ok = Store.importMatch(data, true);
          if (ok) toast('Match imported');
        } else {
          if (!await Dialog.confirm('Replace ALL teams and matches in this browser with this backup?', { okLabel: 'Replace all', danger: true })) return;
          Store.replace(data);
        }
        renderHome();
      } catch (err) {
        Dialog.alert('Import failed: ' + err.message);
      }
    });
  }

  // ---------- Teams ----------
  function renderTeams() {
    app.innerHTML = `
      <header class="topbar">
        <a class="back" href="#/">‹ Matches</a>
        <h1>Teams</h1>
      </header>
      <section class="card">
        <form id="new-team" class="row">
          <input name="name" required placeholder="Team name">
          <button class="btn primary" type="submit">Add team</button>
        </form>
        <ul class="list">
          ${db.teams.map((t) => `<li><a class="list-main" href="#/team/${t.id}">
            <strong>${esc(t.name)}</strong>
            <span class="muted">${t.players.filter((p) => !p.removed).length} players</span></a></li>`).join('')}
        </ul>
      </section>`;
    $('#new-team').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name').trim();
      if (!name) return;
      const t = { id: Store.uid(), name, players: [] };
      db.teams.push(t);
      Store.save();
      location.hash = '#/team/' + t.id;
    });
  }

  function renderTeam(id) {
    const team = teamById(id);
    if (!team) { location.hash = '#/teams'; return; }
    const players = team.players.filter((p) => !p.removed)
      .sort((a, b) => (+a.number || 0) - (+b.number || 0));
    const used = new Set(db.matches.filter((m) => m.teamId === id).flatMap((m) => m.events.map((e) => e.playerId)));
    app.innerHTML = `
      <header class="topbar">
        <a class="back" href="#/teams">‹ Teams</a>
        <h1>${esc(team.name)}</h1>
      </header>
      <section class="card">
        <h2>Roster</h2>
        <form id="add-player" class="row wrap">
          <input name="number" required inputmode="numeric" pattern="[0-9]{1,2}" placeholder="#" class="num-input">
          <input name="name" required placeholder="Player name">
          <select name="pos">
            ${['', 'OH', 'OPP', 'MB', 'S', 'L', 'DS'].map((p) => `<option value="${p}">${p || 'Position'}</option>`).join('')}
          </select>
          <button class="btn primary" type="submit">Add</button>
        </form>
        <ul class="list">
          ${players.map((p) => `<li>
            <span class="jersey">${esc(p.number)}</span>
            <span class="list-main"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.pos || '')}</span></span>
            <button class="btn subtle" data-rm="${p.id}" aria-label="Remove player">✕</button>
          </li>`).join('') || '<li class="muted">No players yet.</li>'}
        </ul>
      </section>
      <section class="card">
        <div class="row wrap">
          <button class="btn small" id="rename">Rename team</button>
          <button class="btn small danger" id="delete-team">Delete team</button>
        </div>
      </section>`;

    $('#add-player').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const number = f.get('number').trim();
      if (players.some((p) => p.number === number)) { Dialog.alert('Jersey #' + number + ' is already on the roster.'); return; }
      team.players.push({ id: Store.uid(), number, name: f.get('name').trim(), pos: f.get('pos') });
      Store.save();
      renderTeam(id);
      $('#add-player input[name=number]').focus();
    });
    app.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      const p = team.players.find((x) => x.id === b.dataset.rm);
      if (used.has(p.id)) {
        // Keep the record so existing match stats still show the player.
        p.removed = true;
      } else {
        team.players.splice(team.players.indexOf(p), 1);
      }
      Store.save();
      renderTeam(id);
    }));
    $('#rename').addEventListener('click', async () => {
      const name = await Dialog.prompt('Team name', team.name);
      if (name && name.trim()) { team.name = name.trim(); Store.save(); renderTeam(id); }
    });
    $('#delete-team').addEventListener('click', async () => {
      const n = db.matches.filter((m) => m.teamId === id).length;
      if (!await Dialog.confirm(`Delete ${team.name}${n ? ` and its ${n} match(es)` : ''}?`, { okLabel: 'Delete', danger: true })) return;
      db.matches = db.matches.filter((m) => m.teamId !== id);
      db.teams.splice(db.teams.indexOf(team), 1);
      Store.save();
      location.hash = '#/teams';
    });
  }

  // ---------- Match: video + tagging ----------
  function renderMatch(id) {
    const m = matchById(id);
    if (!m) { location.hash = '#/'; return; }
    const team = teamById(m.teamId) || { name: 'Team', players: [] };
    const prefs = db.prefs;
    m.curSet = m.curSet || 1;

    let player = null;          // VideoPlayer instance
    let pending = null;         // { playerId, skill, t, resume }
    let keyBuf = '';            // typed jersey digits
    let tab = 'log';
    let filter = null;          // { playerId, skill, results, set }
    let statsSet = 0;           // 0 = all sets
    let clips = null;           // { list, i, end }
    let clipTimer = null;
    let flashTimer = null;
    let lastFocusId = null;
    const undoStack = [];
    let videoFile = null;       // the File behind a local video, for upload
    let analyzing = null;       // { msg, frac, error } while a server job runs
    let disposed = false;
    let rallyTimer = null;

    const playerById = (pid) => team.players.find((p) => p.id === pid);
    const playerName = (pid) => {
      const p = playerById(pid);
      return p ? '#' + p.number + ' ' + p.name : '';
    };
    const activePlayers = () => team.players.filter((p) => !p.removed)
      .sort((a, b) => (+a.number || 0) - (+b.number || 0));

    app.innerHTML = `
      <header class="topbar">
        <a class="back" href="#/">‹ Matches</a>
        <h1>${esc(team.name)} vs ${esc(m.opponent)} <span class="muted small">${esc(m.date || '')}</span></h1>
        <div class="row">
          <select id="export" class="btn small" aria-label="Export">
            <option value="">Export…</option>
            <option value="events">Events (CSV)</option>
            <option value="box">Box score (CSV)</option>
            <option value="json">Match file (JSON)</option>
          </select>
        </div>
      </header>
      <div class="match-grid">
        <section class="left">
          <div id="video-box" class="video-box"></div>
          <div class="transport" id="transport">
            <button class="btn small" data-nudge="-5" title="Back 5s (Shift+←)">−5</button>
            <button class="btn small" data-nudge="-2" title="Back 2s (←)">−2</button>
            <button class="btn small primary" id="play" title="Play/Pause (Space)">Play / Pause</button>
            <button class="btn small" data-nudge="2" title="Forward 2s (→)">+2</button>
            <button class="btn small" data-nudge="5" title="Forward 5s (Shift+→)">+5</button>
            <select id="rate" class="btn small" title="Playback speed">
              ${[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => `<option value="${r}" ${r === 1 ? 'selected' : ''}>${r}×</option>`).join('')}
            </select>
            <button class="btn small subtle" id="change-video">Change video</button>
          </div>
          <div id="timeline" class="timeline hidden" title="Rallies found by the analysis server. Click to jump."></div>
          <div id="clipbar" class="clipbar hidden"></div>
          <div id="scorebar" class="scorebar"></div>
          <div id="pad" class="pad"></div>
        </section>
        <section class="right">
          <div class="tabs" role="tablist">
            <button data-tab="log">Log</button>
            <button data-tab="stats">Box score</button>
            <button data-tab="rallies">Rallies</button>
            <button data-tab="options">Shortcuts & options</button>
          </div>
          <div id="panel" class="panel"></div>
        </section>
      </div>
      <div id="flash" class="flash hidden"></div>`;

    // ----- Video -----
    const videoBox = $('#video-box');

    function showVideoPicker(message) {
      if (player) { player.destroy(); player = null; }
      const prev = m.video;
      videoBox.innerHTML = `
        <div class="video-empty">
          ${message ? `<p class="warn">${esc(message)}</p>` : ''}
          <p><strong>Load the match video</strong></p>
          <label class="btn primary">Choose video file<input type="file" id="video-file" accept="video/*" hidden></label>
          <form id="yt-form" class="row">
            <input id="yt-url" placeholder="…or paste a YouTube link" value="${prev && prev.kind === 'youtube' ? esc(prev.url) : ''}">
            <button class="btn small" type="submit">Load</button>
          </form>
          ${prev && prev.kind === 'file' ? `<p class="muted">Last used: <strong>${esc(prev.name)}</strong> — choose it again to keep timestamps in sync.</p>` : ''}
          <p class="muted small">No video? You can still tag live; events just won't have clip timestamps.</p>
        </div>`;
      $('#video-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (prev && prev.kind === 'file' && prev.name !== file.name && m.events.some((ev) => ev.t != null)) {
          if (!await Dialog.confirm(`This match was tagged against "${prev.name}". Use "${file.name}" anyway? Existing timestamps may not line up.`, { okLabel: 'Use it' })) { e.target.value = ''; return; }
        }
        player = VideoPlayer.fromFile(videoBox, file);
        videoFile = file;
        m.video = { kind: 'file', name: file.name };
        Store.save();
        applyRate();
      });
      $('#yt-form').addEventListener('submit', (e) => {
        e.preventDefault();
        loadYouTube($('#yt-url').value);
      });
    }

    async function loadYouTube(url) {
      const vid = VideoPlayer.parseYouTubeId(url);
      if (!vid) { showVideoPicker('That doesn\'t look like a YouTube link.'); return; }
      videoBox.innerHTML = '<div class="video-empty"><p class="muted">Loading YouTube…</p></div>';
      try {
        player = await VideoPlayer.fromYouTube(videoBox, vid);
        videoFile = null;
        m.video = { kind: 'youtube', url: url.trim(), id: vid };
        Store.save();
        applyRate();
      } catch (err) {
        showVideoPicker(err.message);
      }
    }

    function applyRate() { if (player) player.setRate(+$('#rate').value); }

    function togglePlay() {
      if (!player) return;
      if (player.paused()) player.play(); else player.pause();
    }

    function nudge(d) {
      if (!player) return;
      player.seek(player.time() + d);
    }

    $('#play').addEventListener('click', togglePlay);
    app.querySelectorAll('[data-nudge]').forEach((b) =>
      b.addEventListener('click', () => nudge(+b.dataset.nudge)));
    $('#rate').addEventListener('change', applyRate);
    $('#change-video').addEventListener('click', () => { stopClips(); showVideoPicker(); });

    if (m.video && m.video.kind === 'youtube') loadYouTube(m.video.url);
    else showVideoPicker();

    // ----- Tagging -----
    function flash(msg) {
      const el = $('#flash');
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => el.classList.add('hidden'), 1400);
    }

    function startPending() {
      if (pending) return pending;
      const playing = player && !player.paused();
      pending = { playerId: null, skill: null, t: player ? player.time() : null, resume: false };
      if (playing && prefs.autoPause) { player.pause(); pending.resume = true; }
      return pending;
    }

    function cancelPending() {
      if (pending && pending.resume && player) player.play();
      pending = null;
      keyBuf = '';
      renderPad();
    }

    function choosePlayer(pid) {
      startPending().playerId = pid;
      keyBuf = '';
      renderPad();
    }

    function chooseSkill(skill) {
      startPending().skill = skill;
      renderPad();
    }

    function addEvent(ev) {
      ev.id = Store.uid();
      m.events.push(ev);
      sortEvents(m.events);
      undoStack.push(ev.id);
      lastFocusId = ev.id;
      Store.save();
    }

    function chooseResult(code) {
      if (!pending || !pending.skill) return;
      if (!pending.playerId) { flash('Pick a player first'); return; }
      const r = resultOf(pending.skill, code);
      let point = r.point || null;
      // Two block assists on the same rally should only score one point.
      if (point && pending.skill === 'block' && code === 'assist') {
        const dup = m.events.find((e) => e.skill === 'block' && e.result === 'assist' && e.point === 'us' &&
          e.set === m.curSet && e.playerId !== pending.playerId &&
          (e.t == null || pending.t == null ? e.id === undoStack[undoStack.length - 1] : Math.abs(e.t - pending.t) < 4));
        if (dup) point = null;
      }
      addEvent({ t: pending.t, set: m.curSet, playerId: pending.playerId, skill: pending.skill, result: code, point });
      flash(playerName(pending.playerId) + ' · ' + eventLabel({ skill: pending.skill, result: code }));
      const resume = pending.resume;
      pending = null;
      keyBuf = '';
      if (resume && player) player.play();
      refresh();
    }

    function teamPoint(code) {
      const r = resultOf('team', code);
      const t = pending ? pending.t : (player ? player.time() : null);
      const resume = pending && pending.resume;
      pending = null;
      keyBuf = '';
      addEvent({ t, set: m.curSet, playerId: null, skill: 'team', result: code, point: r.point });
      flash(r.label);
      if (resume && player) player.play();
      refresh();
    }

    function undo() {
      const id = undoStack.pop();
      const ev = id ? m.events.find((e) => e.id === id) : m.events[m.events.length - 1];
      if (!ev) { flash('Nothing to undo'); return; }
      m.events.splice(m.events.indexOf(ev), 1);
      Store.save();
      flash('Undid: ' + (playerName(ev.playerId) ? playerName(ev.playerId) + ' · ' : '') + eventLabel(ev));
      refresh();
    }

    function setCurrentSet(n) {
      m.curSet = n;
      Store.save();
      renderScore();
    }

    function renderScore() {
      const { sets } = computeScore(m.events);
      const cur = sets[m.curSet] || { us: 0, them: 0 };
      const won = setsWon(sets);
      const over = isSetOver(cur.us, cur.them, m.curSet);
      $('#scorebar').innerHTML = `
        <div class="sets">
          ${[1, 2, 3, 4, 5].map((n) => {
            const s = sets[n];
            return `<button class="set-btn ${n === m.curSet ? 'active' : ''}" data-set="${n}">
              <span>Set ${n}</span><small>${s ? s.us + '–' + s.them : '—'}</small></button>`;
          }).join('')}
        </div>
        <div class="score">
          <div><span class="muted">${esc(team.name)}</span><b>${cur.us}</b></div>
          <div class="score-mid">Sets ${won.us}–${won.them}${over && m.curSet < 5 ? `<button class="btn small" id="next-set">Next set ›</button>` : ''}</div>
          <div><span class="muted">${esc(m.opponent)}</span><b>${cur.them}</b></div>
        </div>`;
      $('#scorebar').querySelectorAll('[data-set]').forEach((b) =>
        b.addEventListener('click', () => setCurrentSet(+b.dataset.set)));
      const next = $('#next-set');
      if (next) next.addEventListener('click', () => setCurrentSet(m.curSet + 1));
    }

    function renderPad() {
      const p = pending || {};
      const skill = p.skill && SKILLS[p.skill];
      let status;
      if (keyBuf) status = `Jersey <b>#${esc(keyBuf)}</b> — now press a skill key`;
      else if (!pending) status = 'Tap a player, then a skill, then the result.';
      else {
        status = [
          p.playerId ? `<b>${esc(playerName(p.playerId))}</b>` : '<span class="muted">player?</span>',
          skill ? `<b>${skill.label}</b>` : '<span class="muted">skill?</span>',
          p.t != null ? `@ ${fmtTime(p.t)}` : ''
        ].join(' · ');
      }
      const players = activePlayers();
      $('#pad').innerHTML = `
        <div class="pad-status">
          <span>${status}</span>
          ${pending || keyBuf ? '<button class="btn small subtle" id="cancel">Cancel (Esc)</button>' : ''}
        </div>
        <div class="players">
          ${players.length ? players.map((pl) => `<button class="pl-btn ${p.playerId === pl.id ? 'active' : ''}" data-player="${pl.id}">
            <b>${esc(pl.number)}</b><small>${esc(pl.name.split(' ')[0])}</small></button>`).join('')
          : `<p class="muted">No players on the roster. <a href="#/team/${team.id}">Add players</a></p>`}
        </div>
        <div class="skills">
          ${Object.entries(SKILLS).filter(([, s]) => !s.hidden).map(([k, s]) =>
            `<button class="sk-btn ${p.skill === k ? 'active' : ''}" data-skill="${k}">${s.label}<kbd>${s.key.toUpperCase()}</kbd></button>`).join('')}
        </div>
        <div class="results ${skill ? '' : 'hidden'}">
          ${skill ? skill.results.map((r, i) =>
            `<button class="res-btn ${r.point === 'us' ? 'good' : r.point === 'them' ? 'bad' : ''}" data-result="${r.code}">${r.label}<kbd>${resultKey(p.skill, i)}</kbd></button>`).join('') : ''}
        </div>
        <div class="team-row">
          <button class="btn small good" data-team="opperr" title="+ or =">+1 ${esc(team.name)} (opp. error)</button>
          <button class="btn small bad" data-team="opppt" title="-">+1 ${esc(m.opponent)}</button>
          <button class="btn small" id="undo" title="U or Ctrl+Z">Undo</button>
        </div>`;
      const pad = $('#pad');
      pad.querySelectorAll('[data-player]').forEach((b) => b.addEventListener('click', () => choosePlayer(b.dataset.player)));
      pad.querySelectorAll('[data-skill]').forEach((b) => b.addEventListener('click', () => chooseSkill(b.dataset.skill)));
      pad.querySelectorAll('[data-result]').forEach((b) => b.addEventListener('click', () => chooseResult(b.dataset.result)));
      pad.querySelectorAll('[data-team]').forEach((b) => b.addEventListener('click', () => teamPoint(b.dataset.team)));
      $('#undo').addEventListener('click', undo);
      const c = $('#cancel');
      if (c) c.addEventListener('click', cancelPending);
    }

    // Pass ratings use their own number (3/2/1/0); everything else is 1..n.
    function resultKey(skill, i) {
      return skill === 'pass' ? SKILLS.pass.results[i].code : String(i + 1);
    }

    // ----- Right panel -----
    function renderTabs() {
      app.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
      if (tab === 'log') renderLog();
      else if (tab === 'stats') renderStats();
      else if (tab === 'rallies') renderRallies();
      else renderOptions();
    }
    app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderTabs(); }));

    function filterLabel(f) {
      const parts = [];
      if (f.playerId) parts.push(f.playerId === '*' ? 'Team' : playerName(f.playerId));
      if (f.skill) parts.push(SKILLS[f.skill].label);
      if (f.results) parts.push(f.results.map((c) => resultOf(f.skill, c).label).join('/'));
      if (f.set) parts.push('Set ' + f.set);
      return parts.join(' · ');
    }

    function filteredEvents() {
      const f = filter && Object.assign({}, filter, { playerId: filter.playerId === '*' ? null : filter.playerId });
      return m.events.filter((e) => matchesFilter(e, f));
    }

    function renderLog() {
      const { after } = computeScore(m.events);
      const list = filteredEvents();
      const timed = list.filter((e) => e.t != null);
      const players = activePlayers();
      $('#panel').innerHTML = `
        <div class="log-tools">
          <select id="f-player"><option value="">All players</option>
            ${players.map((p) => `<option value="${p.id}" ${filter && filter.playerId === p.id ? 'selected' : ''}>#${esc(p.number)} ${esc(p.name)}</option>`).join('')}
          </select>
          <select id="f-skill"><option value="">All skills</option>
            ${Object.entries(SKILLS).map(([k, s]) => `<option value="${k}" ${filter && filter.skill === k ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
          <select id="f-set"><option value="">All sets</option>
            ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${filter && filter.set === n ? 'selected' : ''}>Set ${n}</option>`).join('')}
          </select>
        </div>
        ${filter ? `<div class="filter-chip">Showing: <b>${esc(filterLabel(filter))}</b> (${list.length}) <button class="btn subtle" id="clear-filter">✕ clear</button></div>` : ''}
        <div class="row wrap">
          <button class="btn small primary" id="play-clips" ${timed.length && player ? '' : 'disabled'}>▶ Play ${timed.length} clip${timed.length === 1 ? '' : 's'}</button>
          <span class="muted small">${player ? `Each clip plays ${prefs.preroll}s before to ${prefs.postroll}s after the tag.` : 'Load the video to play clips.'}</span>
        </div>
        <ol class="log" reversed>
          ${list.slice().reverse().map((e) => `
            <li class="${e.id === lastFocusId ? 'focus' : ''} ${clips && clips.list[clips.i] === e ? 'playing' : ''}" data-ev="${e.id}">
              <button class="time" data-seek="${e.id}" ${e.t == null ? 'disabled' : ''}>${fmtTime(e.t)}</button>
              <span class="set-tag">S${e.set}</span>
              <span class="ev-main">${e.playerId ? `<b>${esc(playerName(e.playerId) || '?')}</b> ` : ''}${esc(eventLabel(e))}</span>
              <button class="pt pt-${e.point || 'none'}" data-pt="${e.id}" title="Who won the rally? Tap to change">${e.point === 'us' ? '+Us' : e.point === 'them' ? '+Opp' : '·'}</button>
              <span class="score-after">${after.get(e.id) || ''}</span>
              <button class="btn subtle del" data-delev="${e.id}" aria-label="Delete event">✕</button>
            </li>`).join('') || '<li class="muted">No events yet.</li>'}
        </ol>`;

      const updateFilter = () => {
        const pid = $('#f-player').value, sk = $('#f-skill').value, st = +$('#f-set').value;
        const keepResults = filter && filter.results && filter.skill === sk && (filter.playerId || '') === pid;
        filter = pid || sk || st ? { playerId: pid || null, skill: sk || null, set: st || null,
          results: keepResults ? filter.results : null } : null;
        renderLog();
      };
      ['#f-player', '#f-skill', '#f-set'].forEach((s) => $(s).addEventListener('change', updateFilter));
      const cf = $('#clear-filter');
      if (cf) cf.addEventListener('click', () => { filter = null; renderLog(); });
      $('#play-clips').addEventListener('click', () => startClips(timed.slice().sort((a, b) => a.t - b.t)));
      const panel = $('#panel');
      panel.querySelectorAll('[data-seek]').forEach((b) => b.addEventListener('click', () => {
        const e = m.events.find((x) => x.id === b.dataset.seek);
        if (player && e && e.t != null) { stopClips(); player.seek(e.t - prefs.preroll); player.play(); }
        lastFocusId = e.id;
        renderLog();
      }));
      panel.querySelectorAll('[data-pt]').forEach((b) => b.addEventListener('click', () => {
        const e = m.events.find((x) => x.id === b.dataset.pt);
        e.point = e.point === 'us' ? 'them' : e.point === 'them' ? null : 'us';
        Store.save();
        refresh();
      }));
      panel.querySelectorAll('[data-delev]').forEach((b) => b.addEventListener('click', () => {
        const e = m.events.find((x) => x.id === b.dataset.delev);
        m.events.splice(m.events.indexOf(e), 1);
        Store.save();
        refresh();
      }));
    }

    function statCell(line, key, pid, text) {
      const has = STAT_FILTERS[key] && line[key] > 0;
      return `<td>${has ? `<button class="cell" data-stat="${key}" data-pid="${pid}">${text}</button>` : text}</td>`;
    }

    function boxRow(name, line, pid) {
      const c = (k, t) => statCell(line, k, pid, t == null ? line[k] : t);
      return `<tr><th>${name}</th>
        <td><b>${fmtNum(line.pts)}</b></td>
        ${c('k')}${c('ae')}${c('ta')}<td>${fmtPct(line.hit)}</td>
        ${c('sa')}${c('se')}${c('st')}
        ${c('rec')}<td>${fmtNum(line.recAvg, 2)}</td>${c('r3')}${c('r0')}
        ${c('ast')}${c('d')}${c('de')}
        ${c('bs')}${c('ba')}${c('be')}<td>${fmtNum(line.blk)}</td>
      </tr>`;
    }

    function renderStats() {
      const box = computeBoxScore(m.events, team.players, statsSet || null);
      $('#panel').innerHTML = `
        <div class="row wrap">
          <select id="stats-set">
            <option value="0">All sets</option>
            ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${statsSet === n ? 'selected' : ''}>Set ${n}</option>`).join('')}
          </select>
          <span class="muted small">Tap any number to see and play those clips.</span>
        </div>
        <div class="table-wrap">
          <table class="box">
            <thead>
              <tr><th></th><th></th><th colspan="4">Attack</th><th colspan="3">Serve</th><th colspan="4">Serve receive</th>
                <th>Set</th><th colspan="2">Dig</th><th colspan="4">Block</th></tr>
              <tr><th>Player</th><th title="Points: K + SA + BS + ½BA">PTS</th>
                <th title="Kills">K</th><th title="Attack errors (incl. blocked)">E</th><th title="Total attempts">TA</th><th title="Hitting % = (K−E)/TA">HIT%</th>
                <th title="Aces">SA</th><th title="Serve errors">SE</th><th title="Serve attempts">ATT</th>
                <th title="Receptions">REC</th><th title="Pass rating 0–3">AVG</th><th title="Perfect passes">3s</th><th title="Aced / reception errors">0s</th>
                <th title="Assists">AST</th><th title="Digs">D</th><th title="Dig errors">DE</th>
                <th title="Solo blocks">BS</th><th title="Block assists">BA</th><th title="Block errors">BE</th><th title="Total blocks = BS + ½BA">BLK</th></tr>
            </thead>
            <tbody>
              ${box.rows.map((r) => boxRow(`#${esc(r.player.number)} ${esc(r.player.name)}`, r.line, r.player.id)).join('')}
            </tbody>
            <tfoot>${boxRow('Team', box.total, '*')}</tfoot>
          </table>
        </div>`;
      $('#stats-set').addEventListener('change', (e) => { statsSet = +e.target.value; renderStats(); });
      $('#panel').querySelectorAll('[data-stat]').forEach((b) => b.addEventListener('click', () => {
        const sf = STAT_FILTERS[b.dataset.stat];
        filter = { playerId: b.dataset.pid, skill: sf.skill, results: sf.results || null, set: statsSet || null };
        tab = 'log';
        renderTabs();
      }));
    }

    function renderOptions() {
      $('#panel').innerHTML = `
        <h3>Keyboard tagging</h3>
        <p class="muted small">Type the jersey number, the skill letter, then the result number. Example: <kbd>7</kbd><kbd>A</kbd><kbd>1</kbd> = #7 attack kill. <kbd>1</kbd><kbd>2</kbd><kbd>R</kbd><kbd>3</kbd> = #12 perfect pass.</p>
        <table class="keys">
          <tr><td><kbd>Space</kbd></td><td>Play / pause</td></tr>
          <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Back / forward 2s (hold Shift for 5s)</td></tr>
          <tr><td><kbd>,</kbd> <kbd>.</kbd></td><td>Step back / forward one frame (paused)</td></tr>
          <tr><td><kbd>S</kbd> <kbd>R</kbd> <kbd>E</kbd> <kbd>A</kbd> <kbd>B</kbd> <kbd>D</kbd></td><td>Serve, Receive (pass), sEt, Attack, Block, Dig</td></tr>
          <tr><td><kbd>1</kbd>–<kbd>4</kbd></td><td>Result (passes use the rating: <kbd>3</kbd> <kbd>2</kbd> <kbd>1</kbd> <kbd>0</kbd>)</td></tr>
          <tr><td><kbd>+</kbd> / <kbd>-</kbd></td><td>Point to us (opponent error) / point to opponent</td></tr>
          <tr><td><kbd>U</kbd> or <kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo last tag</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Cancel current tag / stop clips</td></tr>
          <tr><td><kbd>N</kbd> / <kbd>P</kbd></td><td>Next / previous clip while playing clips</td></tr>
          <tr><td><kbd>[</kbd> / <kbd>]</kbd></td><td>Previous / next rally (after finding rallies)</td></tr>
        </table>
        <h3>Options</h3>
        <label class="check"><input type="checkbox" id="opt-pause" ${prefs.autoPause ? 'checked' : ''}> Pause video while tagging, resume after</label>
        <div class="row wrap">
          <label>Clip starts <input type="number" id="opt-pre" min="0" max="30" step="1" value="${prefs.preroll}" class="num-input"> s before tag</label>
          <label>and ends <input type="number" id="opt-post" min="0" max="30" step="1" value="${prefs.postroll}" class="num-input"> s after</label>
        </div>
        <h3>Analysis server</h3>
        <p class="muted small">Finds rallies automatically. Your video is uploaded to this server and deleted after the server's retention period (30 days by default) or when you delete it.</p>
        <div class="form-grid">
          <label>Server address<input id="opt-server" placeholder="https://analysis.example.com" value="${esc(prefs.serverUrl)}"></label>
          <label>Access token<input id="opt-token" type="password" autocomplete="off" value="${esc(prefs.serverToken)}"></label>
          <button class="btn small" id="opt-test" type="button">Test connection</button>
        </div>
        <p class="small" id="opt-test-result"></p>
        <h3>How points are scored</h3>
        <p class="muted small">Aces, kills and blocks give your team the point; errors, blocked attacks and 0-passes give it to the opponent.
        Use the +1 buttons for rallies that end without one of your players' contacts. Tap the point badge on any log row to fix it.</p>`;
      $('#opt-pause').addEventListener('change', (e) => { prefs.autoPause = e.target.checked; Store.save(); });
      $('#opt-pre').addEventListener('change', (e) => { prefs.preroll = Math.max(0, +e.target.value || 0); Store.save(); });
      $('#opt-post').addEventListener('change', (e) => { prefs.postroll = Math.max(0, +e.target.value || 0); Store.save(); });
      $('#opt-server').addEventListener('change', (e) => { prefs.serverUrl = e.target.value.trim(); Store.save(); });
      $('#opt-token').addEventListener('change', (e) => { prefs.serverToken = e.target.value.trim(); Store.save(); });
      $('#opt-test').addEventListener('click', async () => {
        prefs.serverUrl = $('#opt-server').value.trim();
        prefs.serverToken = $('#opt-token').value.trim();
        Store.save();
        const out = $('#opt-test-result');
        out.className = 'small muted';
        out.textContent = 'Checking…';
        try {
          await Analysis.health(prefs);
          // health is public; listing videos proves the token works too.
          await fetch(prefs.serverUrl.replace(/\/+$/, '') + '/api/videos', { headers: prefs.serverToken ? { Authorization: 'Bearer ' + prefs.serverToken } : {} })
            .then((r) => { if (r.status === 401) throw new Error('Connected, but the access token was rejected.'); });
          out.className = 'small good-text';
          out.textContent = 'Connected.';
        } catch (err) {
          out.className = 'small warn';
          out.textContent = err.message;
        }
      });
    }

    // ----- Automatic rally finding (analysis server) -----
    const ralliesOf = () => (m.analysis && m.analysis.status === 'done' && m.analysis.rallies) || [];

    function renderRallies() {
      const a = m.analysis;
      const rallies = ralliesOf();
      const angle = m.analysisAngle || 'endline';
      let body;
      if (!Analysis.configured(prefs)) {
        body = `<p class="muted">Connect an analysis server to find rallies automatically.</p>
          <button class="btn small" id="go-options">Open server settings</button>`;
      } else {
        const canRun = !!videoFile && !analyzing;
        body = `
          <div class="row wrap">
            <label>Camera
              <select id="an-angle">
                ${[['endline', 'End line'], ['sideline', 'Sideline'], ['other', 'Other']].map(([v, l]) =>
                  `<option value="${v}" ${angle === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            <button class="btn small primary" id="an-run" ${canRun ? '' : 'disabled'}>${rallies.length ? 'Analyze again' : 'Find rallies'}</button>
          </div>
          ${!videoFile && !analyzing ? `<p class="muted small">${m.video && m.video.kind === 'youtube'
            ? 'YouTube videos can\'t be uploaded for analysis. Load the match from a video file instead.'
            : 'Choose the match video file first; it is uploaded to the analysis server.'}</p>` : ''}
          ${analyzing ? `
            <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(analyzing.frac * 100)}">
              <div style="width:${Math.round(analyzing.frac * 100)}%"></div></div>
            <p class="small muted" id="an-msg">${esc(analyzing.msg)}</p>` : ''}
          ${a && a.error ? `<p class="small warn">${esc(a.error)}</p>` : ''}`;
      }
      const list = rallies.length ? `
        <p class="small"><b>${rallies.length} rallies</b> <span class="muted">found by ${a.method === 'motion' ? 'court motion' : 'whistles + court motion'}
          in ${esc(a.videoName || 'the video')}. Check them before relying on them.</span></p>
        ${m.video && m.video.name && a.videoName && m.video.name !== a.videoName ? `<p class="small warn">These were found in "${esc(a.videoName)}", not the video that's loaded.</p>` : ''}
        <label class="check"><input type="checkbox" id="an-skip" ${prefs.skipDead ? 'checked' : ''}> Skip dead time between rallies while playing</label>
        <p class="muted small">Jump between rallies with <kbd>[</kbd> and <kbd>]</kbd>.</p>
        <ol class="rally-list">
          ${rallies.map((r, i) => `<li>
            <button class="time" data-rally="${i}">${fmtTime(r.start)}</button>
            <span>Rally ${i + 1}</span>
            <span class="muted small">${Math.round(r.end - r.start)}s</span>
            <span class="conf ${r.confidence >= 0.75 ? 'hi' : r.confidence >= 0.5 ? 'mid' : 'lo'}" title="How sure the finder is">${Math.round(r.confidence * 100)}%</span>
          </li>`).join('')}
        </ol>
        <div class="row wrap">
          <button class="btn small subtle" id="an-clear">Clear results</button>
          ${a.serverVideoId ? '<button class="btn small subtle danger" id="an-delete">Delete video from server</button>' : ''}
        </div>` : '';
      $('#panel').innerHTML = `<h3>Rallies</h3>${body}${list}`;

      const go = $('#go-options');
      if (go) go.addEventListener('click', () => { tab = 'options'; renderTabs(); });
      const angleSel = $('#an-angle');
      if (angleSel) angleSel.addEventListener('change', (e) => { m.analysisAngle = e.target.value; Store.save(); });
      const run = $('#an-run');
      if (run) run.addEventListener('click', runAnalysis);
      const skip = $('#an-skip');
      if (skip) skip.addEventListener('change', (e) => { prefs.skipDead = e.target.checked; Store.save(); });
      $('#panel').querySelectorAll('[data-rally]').forEach((b) => b.addEventListener('click', () => {
        const r = rallies[+b.dataset.rally];
        if (player) { stopClips(); player.seek(r.start - 1); player.play(); }
      }));
      const clear = $('#an-clear');
      if (clear) clear.addEventListener('click', async () => {
        if (!await Dialog.confirm('Clear the rallies found for this match?', { okLabel: 'Clear' })) return;
        m.analysis = null;
        Store.save();
        renderTimeline();
        renderRallies();
      });
      const del = $('#an-delete');
      if (del) del.addEventListener('click', async () => {
        if (!await Dialog.confirm('Delete this match video from the analysis server? The rallies found stay here.', { okLabel: 'Delete', danger: true })) return;
        try {
          await Analysis.removeVideo(prefs, a.serverVideoId);
        } catch (err) {
          if (!/not found/i.test(err.message)) { Dialog.alert(err.message); return; }
        }
        a.serverVideoId = null;
        Store.save();
        flash('Deleted from server');
        renderRallies();
      });
    }

    function showProgress(frac, msg) {
      analyzing = { frac, msg };
      if (tab === 'rallies') renderRallies();
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function runAnalysis() {
      if (!videoFile || analyzing) return;
      const file = videoFile;
      try {
        showProgress(0, 'Uploading 0%');
        const v = await Analysis.upload(prefs, file, { angle: m.analysisAngle || 'endline', matchRef: m.id },
          (f) => showProgress(f * 0.5, 'Uploading ' + Math.round(f * 100) + '%'));
        const j = await Analysis.analyze(prefs, v.id, ['rallies']);
        m.analysis = { status: 'running', serverVideoId: v.id, jobId: j.id, videoName: file.name };
        Store.save();
        await pollJob();
      } catch (err) {
        analyzing = null;
        m.analysis = Object.assign({}, m.analysis || {}, { status: 'failed', error: err.message });
        Store.save();
        if (!disposed && tab === 'rallies') renderRallies();
      }
    }

    async function pollJob() {
      const a = m.analysis;
      while (!disposed) {
        const j = await Analysis.job(prefs, a.jobId);
        if (j.status === 'done') {
          const r = j.result.rallies;
          Object.assign(a, { status: 'done', error: null, method: r.method, rallies: r.rallies,
            durationS: j.result.duration_s, at: Date.now() });
          Store.save();
          analyzing = null;
          if (disposed) return;
          renderTimeline();
          if (tab === 'rallies') renderRallies();
          flash(`Found ${r.rallies.length} rallies`);
          return;
        }
        if (j.status === 'failed') throw new Error('Analysis failed: ' + (j.error || 'unknown error'));
        showProgress(0.5 + 0.5 * (j.progress || 0), j.status === 'queued' ? 'Waiting for the server…' : (j.message || 'Analyzing…'));
        await sleep(2000);
      }
    }

    function renderTimeline() {
      const el = $('#timeline');
      const rallies = ralliesOf();
      const dur = m.analysis && m.analysis.durationS;
      if (!rallies.length || !dur) { el.classList.add('hidden'); el.innerHTML = ''; return; }
      el.classList.remove('hidden');
      el.innerHTML = rallies.map((r, i) =>
        `<span class="tl-rally" data-rally="${i}" style="left:${(r.start / dur) * 100}%;width:${Math.max(0.3, ((r.end - r.start) / dur) * 100)}%"></span>`
      ).join('') + '<span class="tl-head" id="tl-head"></span>';
      el.onclick = (e) => {
        if (!player) return;
        const hit = e.target.closest('[data-rally]');
        const t = hit ? rallies[+hit.dataset.rally].start - 1 : ((e.clientX - el.getBoundingClientRect().left) / el.clientWidth) * dur;
        stopClips();
        player.seek(t);
      };
    }

    function jumpRally(dir) {
      const rallies = ralliesOf();
      if (!player || !rallies.length) return;
      const t = player.time();
      const target = dir > 0
        ? rallies.find((r) => r.start - 1 > t + 0.5)
        : [...rallies].reverse().find((r) => r.start - 1 < t - 2);
      if (target) { stopClips(); player.seek(target.start - 1); }
    }

    function tickRallies() {
      const rallies = ralliesOf();
      if (!player || !rallies.length) return;
      const t = player.time();
      const head = $('#tl-head');
      if (head && m.analysis.durationS) head.style.left = Math.min(100, (t / m.analysis.durationS) * 100) + '%';
      if (!prefs.skipDead || clips || pending || player.paused()) return;
      const inRally = rallies.some((r) => t >= r.start - 2 && t <= r.end + 1.5);
      if (inRally) return;
      const next = rallies.find((r) => r.start - 2 > t);
      if (next) player.seek(next.start - 1.5);
    }

    // ----- Clip playback -----
    function startClips(list) {
      if (!player || !list.length) return;
      cancelPending();
      clips = { list, i: 0 };
      playClip(0);
      clearInterval(clipTimer);
      clipTimer = setInterval(() => {
        if (!clips || !player) return;
        if (player.time() >= clips.end) {
          if (clips.i + 1 < clips.list.length) playClip(clips.i + 1);
          else stopClips();
        }
      }, 200);
    }

    function playClip(i) {
      if (!clips) return;
      clips.i = Math.max(0, Math.min(i, clips.list.length - 1));
      const e = clips.list[clips.i];
      clips.end = e.t + prefs.postroll;
      player.seek(e.t - prefs.preroll);
      player.play();
      lastFocusId = e.id;
      renderClipbar();
      if (tab === 'log') renderLog();
    }

    function stopClips() {
      if (!clips) return;
      clips = null;
      clearInterval(clipTimer);
      if (player) player.pause();
      renderClipbar();
      if (tab === 'log') renderLog();
    }

    function renderClipbar() {
      const bar = $('#clipbar');
      if (!clips) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
      const e = clips.list[clips.i];
      bar.classList.remove('hidden');
      bar.innerHTML = `
        <button class="btn small" id="clip-prev">‹ Prev</button>
        <span>Clip ${clips.i + 1}/${clips.list.length}: ${e.playerId ? '<b>' + esc(playerName(e.playerId)) + '</b> ' : ''}${esc(eventLabel(e))} <span class="muted">S${e.set} ${fmtTime(e.t)}</span></span>
        <button class="btn small" id="clip-next">Next ›</button>
        <button class="btn small" id="clip-stop">■ Stop</button>`;
      $('#clip-prev').addEventListener('click', () => playClip(clips.i - 1));
      $('#clip-next').addEventListener('click', () => clips.i + 1 < clips.list.length ? playClip(clips.i + 1) : stopClips());
      $('#clip-stop').addEventListener('click', stopClips);
    }

    // ----- Export -----
    $('#export').addEventListener('change', (e) => {
      const kind = e.target.value;
      e.target.value = '';
      const base = slug(team.name + '_vs_' + m.opponent + '_' + (m.date || ''));
      if (kind === 'events') {
        const { after } = computeScore(m.events);
        const rows = [['Date', 'Opponent', 'Set', 'Video seconds', 'Timecode', 'Jersey', 'Player', 'Skill', 'Result', 'Point', 'Score after']];
        for (const ev of m.events) {
          const p = playerById(ev.playerId);
          const r = resultOf(ev.skill, ev.result);
          rows.push([m.date, m.opponent, ev.set, ev.t == null ? '' : ev.t.toFixed(2), fmtTime(ev.t),
            p ? p.number : '', p ? p.name : '', SKILLS[ev.skill].label, r ? r.label : ev.result,
            ev.point || '', after.get(ev.id) || '']);
        }
        download(base + '_events.csv', csv(rows), 'text/csv');
      } else if (kind === 'box') {
        const box = computeBoxScore(m.events, team.players, null);
        const head = ['Jersey', 'Player', 'PTS', 'K', 'E', 'TA', 'HIT%', 'SA', 'SE', 'Serve ATT', 'REC', 'Pass AVG', '3s', '0s', 'AST', 'D', 'DE', 'BS', 'BA', 'BE', 'BLK'];
        const line = (n, name, l) => [n, name, l.pts, l.k, l.ae, l.ta, fmtPct(l.hit), l.sa, l.se, l.st,
          l.rec, fmtNum(l.recAvg, 2), l.r3, l.r0, l.ast, l.d, l.de, l.bs, l.ba, l.be, l.blk];
        const rows = [head, ...box.rows.map((r) => line(r.player.number, r.player.name, r.line)), line('', 'Team', box.total)];
        download(base + '_boxscore.csv', csv(rows), 'text/csv');
      } else if (kind === 'json') {
        download(base + '.json', JSON.stringify({ app: 'volleyball-stats', schemaVersion: Store.SCHEMA_VERSION, team, match: m }, null, 1), 'application/json');
      }
    });

    // ----- Keyboard -----
    function onKey(e) {
      if (e.target.closest('input, select, textarea')) return;
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (k === ' ') { e.preventDefault(); togglePlay(); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        nudge((e.shiftKey ? 5 : 2) * (k === 'ArrowLeft' ? -1 : 1));
        return;
      }
      if ((k === ',' || k === '.') && player) {
        player.pause();
        nudge(k === ',' ? -1 / 30 : 1 / 30);
        return;
      }
      if (k === 'Escape') { if (clips) stopClips(); cancelPending(); return; }
      if (k === 'Backspace') {
        e.preventDefault();
        if (keyBuf) keyBuf = keyBuf.slice(0, -1);
        else if (pending && pending.skill) pending.skill = null;
        else if (pending) { cancelPending(); return; }
        renderPad();
        return;
      }
      if (clips && (k === 'n' || k === 'p')) {
        if (k === 'n') { if (clips.i + 1 < clips.list.length) playClip(clips.i + 1); else stopClips(); }
        else playClip(clips.i - 1);
        return;
      }
      if (/^[0-9]$/.test(k)) {
        if (pending && pending.skill) {
          const results = SKILLS[pending.skill].results;
          const r = pending.skill === 'pass' ? results.find((x) => x.code === k) : results[+k - 1];
          if (r) chooseResult(r.code);
          return;
        }
        if (keyBuf.length >= 2) keyBuf = '';
        startPending();
        keyBuf += k;
        renderPad();
        return;
      }
      if (k === 'Enter' && keyBuf) { resolveJersey(); renderPad(); return; }
      if (k === '+' || k === '=') { teamPoint('opperr'); return; }
      if (k === '-') { teamPoint('opppt'); return; }
      if (k === 'u') { undo(); return; }
      if (k === ']' || k === '[') { jumpRally(k === ']' ? 1 : -1); return; }
      const skill = Object.keys(SKILLS).find((s) => SKILLS[s].key === k.toLowerCase());
      if (skill) {
        if (keyBuf && !resolveJersey()) { renderPad(); return; }
        chooseSkill(skill);
      }
    }

    function resolveJersey() {
      const p = activePlayers().find((x) => String(+x.number) === String(+keyBuf));
      if (!p) { flash('No player #' + keyBuf); keyBuf = ''; return false; }
      startPending().playerId = p.id;
      keyBuf = '';
      return true;
    }

    document.addEventListener('keydown', onKey);

    function refresh() {
      renderScore();
      renderPad();
      renderTabs();
    }
    refresh();
    renderTimeline();
    rallyTimer = setInterval(tickRallies, 250);
    // Pick up a job that was still running when the match was last open.
    if (m.analysis && m.analysis.status === 'running' && Analysis.configured(prefs)) {
      showProgress(0.5, 'Checking on the analysis…');
      pollJob().catch((err) => {
        analyzing = null;
        m.analysis.status = 'failed';
        m.analysis.error = err.message;
        Store.save();
        if (!disposed && tab === 'rallies') renderRallies();
      });
    }

    cleanup = () => {
      disposed = true;
      clearInterval(rallyTimer);
      document.removeEventListener('keydown', onKey);
      clearInterval(clipTimer);
      clearTimeout(flashTimer);
      if (player) player.destroy();
    };
  }

  route();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
  }
})();
