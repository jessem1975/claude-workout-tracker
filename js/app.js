// Router + view rendering. Hash-based routes: #/, #/session, #/history,
// #/exercise/<id>, #/settings. Everything renders into #app; the rest-timer
// banner is a persistent element outside the router-controlled area.

const App = {
  restTimer: null,
  exerciseTimers: {}, // exerciseId+setIndex -> CountdownTimer, for inline time-based sets

  init() {
    window.addEventListener('hashchange', () => this.render());
    this.render();
    this.registerServiceWorker();
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  },

  currentRoute() {
    const hash = location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    return { name: parts[0] || 'home', param: parts[1] };
  },

  navigate(hash) {
    location.hash = hash;
  },

  render() {
    const route = this.currentRoute();
    const app = document.getElementById('app');
    this.updateNavActive(route.name);

    if (route.name === 'home') return this.renderHome(app);
    if (route.name === 'session') return this.renderSession(app);
    if (route.name === 'history') return this.renderHistory(app);
    if (route.name === 'exercise') return this.renderExerciseDetail(app, route.param);
    if (route.name === 'settings') return this.renderSettings(app);
    return this.renderHome(app);
  },

  updateNavActive(routeName) {
    document.querySelectorAll('.bottom-nav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === routeName);
    });
  },

  // ---------------- HOME ----------------
  renderHome(app) {
    const active = Session.getActive();
    const nextIndex = active ? active.dayIndex : Session.getNextDayIndex();
    const day = PLAN[nextIndex];
    const log = Storage.getSessionLog();
    const last7 = log.filter((s) => this._withinDays(s.date, 7));

    app.innerHTML = `
      <section class="card">
        <h1>Workout Tracker</h1>
        <p class="muted">${active ? 'Resume your in-progress workout' : "Today's session"}</p>
        <div class="day-banner">
          <div class="day-name">${day.label}</div>
          <div class="day-focus">${day.focus}</div>
        </div>
        ${day.exercises.length
          ? `<button class="btn primary big" id="start-btn">${active ? 'Resume Workout' : 'Start Workout'}</button>`
          : `<button class="btn primary big" id="rest-btn">Mark Rest Day Done</button>`
        }
      </section>

      <section class="card">
        <h2>This week</h2>
        <p class="muted">${last7.length} session${last7.length === 1 ? '' : 's'} logged in the last 7 days</p>
      </section>

      <section class="card">
        <h2>Upcoming rotation</h2>
        <ol class="rotation-list">
          ${PLAN.map((d, i) => `<li class="${i === nextIndex ? 'current' : ''}">${d.label}</li>`).join('')}
        </ol>
      </section>
    `;

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (!active) Session.start(nextIndex);
        this.navigate('/session');
      });
    }
    const restBtn = document.getElementById('rest-btn');
    if (restBtn) {
      restBtn.addEventListener('click', () => {
        Session.completeRestDay(nextIndex);
        this.render();
      });
    }
  },

  _withinDays(dateStr, days) {
    const d = new Date(dateStr);
    const now = new Date();
    return (now - d) / 86400000 <= days;
  },

  // ---------------- SESSION ----------------
  renderSession(app) {
    const session = Session.getActive();
    if (!session) {
      this.navigate('/');
      return;
    }
    const day = PLAN[session.dayIndex];
    const exerciseIds = Object.keys(session.entries);

    app.innerHTML = `
      <section class="card session-header">
        <h1>${day.label}</h1>
        <p class="muted">${day.focus}</p>
        <button class="btn subtle" id="discard-btn">Discard session</button>
      </section>
      <div id="exercise-list"></div>
      <section class="card">
        <button class="btn primary big" id="finish-btn">Finish Workout</button>
      </section>
    `;

    const list = document.getElementById('exercise-list');
    exerciseIds.forEach((exerciseId) => {
      list.appendChild(this._renderExerciseCard(session, exerciseId));
    });

    document.getElementById('finish-btn').addEventListener('click', () => {
      Session.finish(session);
      this._clearRestTimer();
      this.navigate('/');
    });
    document.getElementById('discard-btn').addEventListener('click', () => {
      if (confirm('Discard this in-progress workout? Nothing will be saved.')) {
        Session.discard();
        this._clearRestTimer();
        this.navigate('/');
      }
    });
  },

  _renderExerciseCard(session, exerciseId) {
    const exercise = EXERCISES[exerciseId];
    const entry = session.entries[exerciseId];
    const video = VIDEOS[exerciseId];
    const complete = Session.isExerciseComplete(session, exerciseId);

    const card = document.createElement('section');
    card.className = 'card exercise-card' + (complete ? ' complete' : '');
    card.innerHTML = `
      <div class="exercise-head">
        <h3>${exercise.name}</h3>
        <a href="#/exercise/${exerciseId}" class="link-btn">Details${video ? ' & video' : ''}</a>
      </div>
      ${exercise.caution ? `<p class="caution">⚠ ${exercise.caution}</p>` : ''}
      <p class="suggestion">${entry.suggestion.note}</p>
      <div class="set-rows" data-exercise="${exerciseId}"></div>
    `;

    const rows = card.querySelector('.set-rows');
    entry.sets.forEach((set, idx) => {
      rows.appendChild(this._renderSetRow(session, exerciseId, exercise, idx));
    });

    return card;
  },

  _renderSetRow(session, exerciseId, exercise, setIndex) {
    const set = session.entries[exerciseId].sets[setIndex];
    const row = document.createElement('div');
    row.className = 'set-row' + (set.done ? ' done' : '');

    if (exercise.type === 'time') {
      const target = set.targetDuration;
      row.innerHTML = `
        <span class="set-num">${setIndex + 1}</span>
        <span class="target">Target ${target}s</span>
        <span class="timer-display" data-timer-display>${set.duration != null ? set.duration + 's' : target + 's'}</span>
        <button class="btn small" data-action="timer-toggle">${set.done ? 'Redo' : 'Start'}</button>
        <input type="number" inputmode="numeric" class="input duration-input" placeholder="${target}" value="${set.duration != null ? set.duration : ''}" data-field="duration">
        <button class="btn small primary" data-action="log">${set.done ? '✓' : 'Log'}</button>
      `;
    } else {
      row.innerHTML = `
        <span class="set-num">${setIndex + 1}</span>
        <input type="number" inputmode="decimal" class="input weight-input" placeholder="wt" value="${set.weight != null ? set.weight : ''}" data-field="weight">
        <span class="unit">${Storage.getSettings().units}</span>
        <input type="number" inputmode="numeric" class="input reps-input" placeholder="${set.targetReps}" value="${set.reps != null ? set.reps : ''}" data-field="reps">
        <span class="unit">reps</span>
        <button class="btn small primary" data-action="log">${set.done ? '✓' : 'Log'}</button>
      `;
    }

    const logBtn = row.querySelector('[data-action="log"]');
    logBtn.addEventListener('click', () => {
      const values = {};
      row.querySelectorAll('[data-field]').forEach((input) => {
        const v = parseFloat(input.value);
        values[input.dataset.field] = isNaN(v) ? (exercise.type === 'time' ? set.targetDuration : 0) : v;
      });
      Session.logSet(session, exerciseId, setIndex, values);
      const isLast = Session.isLastSet(session, exerciseId, setIndex);
      this.renderSession(document.getElementById('app'));
      if (!isLast) this._startRestTimer(exercise.restSec);
    });

    const timerBtn = row.querySelector('[data-action="timer-toggle"]');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        this._startExerciseTimer(row, exercise, set.targetDuration);
      });
    }

    return row;
  },

  _startExerciseTimer(row, exercise, targetDuration) {
    const display = row.querySelector('[data-timer-display]');
    const durationInput = row.querySelector('.duration-input');
    const timer = new CountdownTimer({
      duration: targetDuration,
      onTick: (remaining) => {
        display.textContent = `${remaining}s`;
      },
      onComplete: () => {
        AlertFX.beep();
        AlertFX.vibrate([300, 100, 300]);
        durationInput.value = targetDuration;
        display.textContent = 'Done!';
      }
    });
    timer.start();
  },

  // ---------------- REST TIMER (persistent banner) ----------------
  _startRestTimer(restSec) {
    const settings = Storage.getSettings();
    const total = restSec + (settings.extraRestSec || 0);
    const banner = document.getElementById('rest-banner');
    banner.classList.remove('hidden');
    banner.classList.remove('rest-done');

    if (this.restTimer) this.restTimer.pause();
    this.restTimer = new CountdownTimer({
      duration: total,
      onTick: (remaining) => {
        document.getElementById('rest-time').textContent = this._fmtTime(remaining);
      },
      onComplete: () => {
        if (Storage.getSettings().soundEnabled) AlertFX.beep();
        if (Storage.getSettings().vibrationEnabled) AlertFX.vibrate([400, 150, 400]);
        banner.classList.add('rest-done');
        document.getElementById('rest-label').textContent = 'Rest done — go!';
      }
    });
    document.getElementById('rest-label').textContent = 'Resting...';
    this.restTimer.start();
  },

  _clearRestTimer() {
    if (this.restTimer) this.restTimer.pause();
    this.restTimer = null;
    const banner = document.getElementById('rest-banner');
    if (banner) banner.classList.add('hidden');
  },

  _fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  initRestBanner() {
    document.getElementById('rest-skip').addEventListener('click', () => {
      if (this.restTimer) this.restTimer.pause();
      this._clearRestTimer();
    });
    document.getElementById('rest-add').addEventListener('click', () => {
      if (this.restTimer) this.restTimer.addSeconds(15);
    });
  },

  // ---------------- HISTORY ----------------
  renderHistory(app) {
    const log = Storage.getSessionLog().slice().reverse();
    app.innerHTML = `
      <section class="card">
        <h1>History</h1>
        ${log.length === 0 ? '<p class="muted">No sessions logged yet.</p>' : ''}
        <ul class="session-log">
          ${log.map((s) => `<li><span class="date">${s.date}</span><span>${s.label}</span><span class="muted">${s.exerciseCount} exercises</span></li>`).join('')}
        </ul>
      </section>
      <section class="card">
        <h2>Exercise progress</h2>
        <select id="exercise-picker">
          ${Object.values(EXERCISES).map((e) => `<option value="${e.id}">${e.name}</option>`).join('')}
        </select>
        <div id="exercise-trend"></div>
      </section>
    `;
    const picker = document.getElementById('exercise-picker');
    const renderTrend = () => {
      document.getElementById('exercise-trend').innerHTML = this._trendHtml(picker.value);
    };
    picker.addEventListener('change', renderTrend);
    renderTrend();
  },

  _trendHtml(exerciseId) {
    const exercise = EXERCISES[exerciseId];
    const history = Storage.getExerciseHistory(exerciseId);
    if (history.length === 0) return '<p class="muted">No history yet for this exercise.</p>';
    const rows = history.slice().reverse().map((h) => {
      if (exercise.type === 'time') {
        return `<tr><td>${h.date}</td><td>${h.sets.map((s) => s.duration + 's').join(', ')}</td></tr>`;
      }
      return `<tr><td>${h.date}</td><td>${h.sets.map((s) => `${s.weight}x${s.reps}`).join(', ')}</td></tr>`;
    }).join('');
    return `<table class="trend-table"><thead><tr><th>Date</th><th>Sets</th></tr></thead><tbody>${rows}</tbody></table>`;
  },

  // ---------------- EXERCISE DETAIL ----------------
  renderExerciseDetail(app, exerciseId) {
    const exercise = EXERCISES[exerciseId];
    if (!exercise) {
      this.navigate('/');
      return;
    }
    const video = VIDEOS[exerciseId];
    const range = exercise.type === 'time'
      ? `${exercise.timeRange[0]}-${exercise.timeRange[1]}s hold, ${exercise.sets} sets`
      : `${exercise.repRange[0]}-${exercise.repRange[1]} reps, ${exercise.sets} sets`;

    app.innerHTML = `
      <section class="card">
        <a href="#/session" class="link-btn">&larr; Back</a>
        <h1>${exercise.name}</h1>
        <p class="muted">${range} · rest ${exercise.restSec}s</p>
        ${exercise.caution ? `<p class="caution">⚠ ${exercise.caution}</p>` : ''}
        ${video
          ? `<a class="btn primary" target="_blank" rel="noopener" href="${video.url}">▶ Watch form video (${video.channel})</a>`
          : '<p class="muted">No reference video linked yet.</p>'
        }
      </section>
      <section class="card">
        <h2>History</h2>
        ${this._trendHtml(exerciseId)}
      </section>
    `;
  },

  // ---------------- SETTINGS ----------------
  renderSettings(app) {
    const settings = Storage.getSettings();
    app.innerHTML = `
      <section class="card">
        <h1>Settings</h1>
        <label class="settings-row">
          <span>Units</span>
          <select id="units">
            <option value="lb" ${settings.units === 'lb' ? 'selected' : ''}>lb</option>
            <option value="kg" ${settings.units === 'kg' ? 'selected' : ''}>kg</option>
          </select>
        </label>
        <label class="settings-row">
          <span>Sound on timer complete</span>
          <input type="checkbox" id="sound" ${settings.soundEnabled ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span>Vibration on timer complete</span>
          <input type="checkbox" id="vibration" ${settings.vibrationEnabled ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span>Extra rest time (sec)</span>
          <input type="number" id="extra-rest" value="${settings.extraRestSec}" min="0" step="5">
        </label>
      </section>
      <section class="card">
        <h2>Data</h2>
        <button class="btn subtle" id="reset-data">Reset all data</button>
      </section>
    `;
    const save = () => {
      Storage.saveSettings({
        units: document.getElementById('units').value,
        soundEnabled: document.getElementById('sound').checked,
        vibrationEnabled: document.getElementById('vibration').checked,
        extraRestSec: parseInt(document.getElementById('extra-rest').value, 10) || 0
      });
    };
    ['units', 'sound', 'vibration', 'extra-rest'].forEach((id) => {
      document.getElementById(id).addEventListener('change', save);
    });
    document.getElementById('reset-data').addEventListener('click', () => {
      if (confirm('This clears all logged workouts and settings on this device. Continue?')) {
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
        this.navigate('/');
        this.render();
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.initRestBanner();
  App.init();
});
