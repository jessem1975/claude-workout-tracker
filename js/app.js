// Router + view rendering. Hash-based routes: #/, #/session, #/history,
// #/exercise/<id>, #/settings. Everything renders into #app; the rest-timer
// banner is a persistent element outside the router-controlled area.

const App = {
  restTimer: null,
  exerciseTimers: {}, // exerciseId+setIndex -> CountdownTimer, for inline time-based sets
  _expandedDetails: {}, // exerciseId -> bool, whether its "Details & video" panel is expanded

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
    if (route.name === 'import-preview') return this.renderImportPreview(app);
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
    const log = Storage.getSessionLog();
    const last7 = log.filter((s) => this._withinDays(s.date, 7));
    const showBackupBanner = Storage.isBackupDue() && Storage.canPromptForBackup();

    if (active) {
      const day = Session.getDay(active);
      app.innerHTML = `
        <section class="card">
          <h1>Workout Tracker</h1>
          <p class="muted">Resume your in-progress workout</p>
          <div class="day-banner">
            <div class="day-name">${day.label}</div>
            <div class="day-focus">${day.focus}</div>
          </div>
          <button class="btn primary big" id="start-btn">Resume Workout</button>
        </section>
        ${this._backupBannerHtml(showBackupBanner)}
        ${this._thisWeekHtml(last7)}
      `;
      document.getElementById('start-btn').addEventListener('click', () => this.navigate('/session'));
      this._wireBackupBanner();
      return;
    }

    const plans = Plans.getAll();
    const activePlanId = Plans.getActiveId();
    const activePlan = Plans.getActive();
    const suggested = Session.getSuggestedDayIndex();
    if (this._selectedDayIndex == null || this._selectedDayIndex >= activePlan.days.length) {
      this._selectedDayIndex = suggested;
    }
    const selectedDay = activePlan.days[this._selectedDayIndex];

    app.innerHTML = `
      <section class="card">
        <h1>Workout Tracker</h1>
        ${plans.length > 1 ? `
          <label class="settings-row">
            <span>Plan</span>
            <select id="plan-picker">
              ${plans.map((p) => `<option value="${p.id}" ${p.id === activePlanId ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </label>
        ` : ''}
        <p class="muted">Pick today's workout</p>
        <div class="day-picker">
          ${activePlan.days.map((d, i) => `
            <button class="day-option ${i === this._selectedDayIndex ? 'selected' : ''}" data-day-index="${i}">
              ${d.label}${i === suggested ? '<span class="day-option-badge">Suggested</span>' : ''}
            </button>
          `).join('')}
        </div>
        <div class="day-banner">
          <div class="day-name">${selectedDay.label}</div>
          <div class="day-focus">${selectedDay.focus || ''}</div>
          ${selectedDay.exercises.length
            ? `<ul class="exercise-sublist">${selectedDay.exercises.map((id) => `<li>${ExerciseRegistry.get(id).name}</li>`).join('')}</ul>`
            : '<p class="muted">Rest day — nothing to log.</p>'
          }
        </div>
        ${selectedDay.exercises.length
          ? `<button class="btn primary big" id="start-btn">Start Workout</button>`
          : `<button class="btn primary big" id="rest-btn">Mark Rest Day Done</button>`
        }
      </section>

      ${this._backupBannerHtml(showBackupBanner)}
      ${this._thisWeekHtml(last7)}
    `;

    document.querySelectorAll('.day-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._selectedDayIndex = parseInt(btn.dataset.dayIndex, 10);
        this.render();
      });
    });
    const planPicker = document.getElementById('plan-picker');
    if (planPicker) {
      planPicker.addEventListener('change', () => {
        Plans.setActiveId(planPicker.value);
        this._selectedDayIndex = null;
        this.render();
      });
    }
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        Session.start(activePlanId, this._selectedDayIndex);
        this.navigate('/session');
      });
    }
    const restBtn = document.getElementById('rest-btn');
    if (restBtn) {
      restBtn.addEventListener('click', () => {
        Session.completeRestDay(activePlanId, this._selectedDayIndex);
        this.render();
      });
    }
    this._wireBackupBanner();
  },

  _thisWeekHtml(last7) {
    return `
      <section class="card">
        <h2>This week</h2>
        <p class="muted">${last7.length} session${last7.length === 1 ? '' : 's'} logged in the last 7 days</p>
      </section>
    `;
  },

  _backupBannerHtml(show) {
    if (!show) return '';
    return `
      <section class="card backup-banner">
        <h2>Weekly backup</h2>
        <p class="muted">Save your workout history somewhere safe (like iCloud Drive) in case you ever delete the app.</p>
        <div class="nav-row">
          <button class="btn subtle" id="backup-later-btn">Not now</button>
          <button class="btn primary" id="backup-now-btn">Back Up Now</button>
        </div>
      </section>`;
  },

  _wireBackupBanner() {
    const backupNowBtn = document.getElementById('backup-now-btn');
    if (backupNowBtn) {
      backupNowBtn.addEventListener('click', () => this._runBackup().then(() => this.render()));
    }
    const backupLaterBtn = document.getElementById('backup-later-btn');
    if (backupLaterBtn) {
      backupLaterBtn.addEventListener('click', () => {
        Storage.markPromptedNow();
        this.render();
      });
    }
  },

  _withinDays(dateStr, days) {
    const d = new Date(dateStr);
    const now = new Date();
    return (now - d) / 86400000 <= days;
  },

  // ---------------- BACKUP / RESTORE ----------------
  async _runBackup() {
    const data = Storage.exportAll();
    const json = JSON.stringify(data, null, 2);
    const filename = `workout-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([json], { type: 'application/json' });

    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Workout Tracker Backup' });
        Storage.markBackedUpNow();
        return true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false; // user cancelled the share sheet
    }

    // fallback for browsers without file-sharing support: plain download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Storage.markBackedUpNow();
    return true;
  },

  _importBackupFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm('Restore this backup? This replaces all current data on this device.')) return;
        Storage.importAll(data);
        alert('Backup restored.');
        this.navigate('/');
        this.render();
      } catch (e) {
        alert("Couldn't read that backup file: " + e.message);
      }
    };
    reader.readAsText(file);
  },

  // ---------------- PLAN IMPORT (Excel) ----------------
  _loadScriptOnce(src) {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  },

  _importPlanFile(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof XLSX === 'undefined') {
          await this._loadScriptOnce('js/vendor/xlsx.core.min.js');
        }
        const draft = Importer.parseWorkbook(reader.result);
        draft.suggestedName = file.name.replace(/\.(xlsx|xls)$/i, '');
        this._importDraft = draft;
        this.navigate('/import-preview');
      } catch (e) {
        alert("Couldn't read that file: " + e.message);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  renderImportPreview(app) {
    const draft = this._importDraft;
    if (!draft) {
      this.navigate('/settings');
      return;
    }
    app.innerHTML = `
      <section class="card">
        <a href="#/settings" class="link-btn">&larr; Cancel</a>
        <h1>Import Preview</h1>
        <label class="settings-row">
          <span>Plan name</span>
          <input type="text" id="import-plan-name" value="${draft.suggestedName}">
        </label>
        ${draft.warnings.length ? `<p class="caution">⚠ ${draft.warnings.join('<br>')}</p>` : ''}
      </section>
      <section class="card">
        <h2>${draft.days.length} day${draft.days.length === 1 ? '' : 's'} found</h2>
        <ul class="rotation-list">
          ${draft.days.map((d) => `<li>${d.label}<ul class="exercise-sublist">${d.exercises.map((id) => {
            const isNew = draft.newExercises.some((e) => e.id === id);
            const ex = isNew ? draft.newExercises.find((e) => e.id === id) : ExerciseRegistry.get(id);
            return `<li>${ex.name}${isNew ? ' <span class="muted">(new)</span>' : ''}</li>`;
          }).join('')}</ul></li>`).join('')}
        </ul>
      </section>
      <section class="card">
        <button class="btn primary big" id="save-plan-btn">Save Plan</button>
      </section>
    `;
    document.getElementById('save-plan-btn').addEventListener('click', () => {
      const name = document.getElementById('import-plan-name').value.trim() || draft.suggestedName || 'Imported Plan';
      draft.newExercises.forEach((ex) => ExerciseRegistry.addCustom(ex));
      const plan = Plans.create(name, draft.days);
      Plans.setActiveId(plan.id);
      this._importDraft = null;
      this._selectedDayIndex = null;
      this.navigate('/');
    });
  },

  // ---------------- SESSION (one exercise at a time) ----------------
  renderSession(app) {
    const session = Session.getActive();
    if (!session) {
      this.navigate('/');
      return;
    }
    const day = Session.getDay(session);
    const exerciseIds = Object.keys(session.entries);
    const idx = Math.max(0, Math.min(session.currentExerciseIndex || 0, exerciseIds.length - 1));
    const exerciseId = exerciseIds[idx];
    const isFirst = idx === 0;
    const isLast = idx === exerciseIds.length - 1;

    app.innerHTML = `
      <section class="card session-header">
        <div class="session-top-row">
          <h1>${day.label}</h1>
          <button class="btn subtle" id="discard-btn">Discard</button>
        </div>
        <p class="exercise-progress">Exercise ${idx + 1} of ${exerciseIds.length}</p>
        <div class="exercise-dots">
          ${exerciseIds.map((id, i) => {
            const isDone = Session.isExerciseComplete(session, id);
            return `<button class="dot ${i === idx ? 'active' : ''} ${isDone ? 'done' : ''}" data-jump="${i}">${isDone ? '&check;' : i + 1}</button>`;
          }).join('')}
        </div>
      </section>
      <div id="exercise-card-holder"></div>
      <section class="card nav-row">
        <button class="btn huge nav-btn" id="prev-btn" ${isFirst ? 'disabled' : ''}>
          <span class="nav-btn-arrow">&larr; Prev</span>
          ${!isFirst ? `<span class="nav-btn-name">${ExerciseRegistry.get(exerciseIds[idx - 1]).name}</span>` : ''}
        </button>
        <button class="btn primary huge nav-btn" id="${isLast ? 'finish-btn' : 'next-btn'}">
          ${isLast
            ? '<span class="nav-btn-arrow">Finish Workout</span>'
            : `<span class="nav-btn-arrow">Next &rarr;</span><span class="nav-btn-name">${ExerciseRegistry.get(exerciseIds[idx + 1]).name}</span>`
          }
        </button>
      </section>
      <section class="card">
        ${!isLast ? '<button class="btn subtle full" id="finish-early-btn">Finish workout now</button>' : ''}
        <button class="btn subtle full" id="skip-workout-btn">Skip this workout</button>
      </section>
    `;

    document.getElementById('exercise-card-holder').appendChild(this._renderExerciseCard(session, exerciseId));

    document.querySelectorAll('[data-jump]').forEach((dot) => {
      dot.addEventListener('click', () => {
        Session.goToExercise(session, parseInt(dot.dataset.jump, 10));
        this.renderSession(app);
        this._scrollToTop();
      });
    });
    const prevBtn = document.getElementById('prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      Session.goToExercise(session, idx - 1);
      this.renderSession(app);
      this._scrollToTop();
    });
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      Session.goToExercise(session, idx + 1);
      this.renderSession(app);
      this._scrollToTop();
    });
    const finishEarlyBtn = document.getElementById('finish-early-btn');
    if (finishEarlyBtn) finishEarlyBtn.addEventListener('click', () => this._finishWorkout(session));
    const finishBtn = document.getElementById('finish-btn');
    if (finishBtn) finishBtn.addEventListener('click', () => this._finishWorkout(session));
    document.getElementById('skip-workout-btn').addEventListener('click', () => {
      if (confirm(`Skip ${day.label}? Any unlogged sets won't be saved.`)) {
        Session.skipToday(session.planId, session.dayIndex);
        this._clearRestTimer();
        this.navigate('/');
      }
    });

    document.getElementById('discard-btn').addEventListener('click', () => {
      if (confirm('Discard this in-progress workout? Nothing will be saved.')) {
        Session.discard();
        this._clearRestTimer();
        this.navigate('/');
      }
    });
  },

  _finishWorkout(session) {
    Session.finish(session);
    this._clearRestTimer();
    this.navigate('/');
  },

  _scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  _renderExerciseCard(session, exerciseId) {
    const exercise = ExerciseRegistry.get(exerciseId);
    const entry = session.entries[exerciseId];
    const video = VIDEOS[exerciseId];
    const complete = Session.isExerciseComplete(session, exerciseId);
    const expanded = !!this._expandedDetails[exerciseId];

    const card = document.createElement('section');
    card.className = 'card exercise-card' + (complete ? ' complete' : '');
    card.innerHTML = `
      <div class="exercise-head">
        <h2>${exercise.name}</h2>
        <button class="link-btn" id="details-toggle" data-exercise="${exerciseId}">
          Details${video ? ' & video' : ''} ${expanded ? '▴' : '▾'}
        </button>
      </div>
      <div class="exercise-details ${expanded ? '' : 'hidden'}" id="exercise-details">
        ${exercise.caution ? `<p class="caution">⚠ ${exercise.caution}</p>` : ''}
        ${video ? `<button class="btn primary full" id="details-watch-video-btn">▶ Watch quick demo${video.channel ? ` (${video.channel})` : ''}</button>` : ''}
        <a href="#/exercise/${exerciseId}" class="link-btn">Full history &rarr;</a>
      </div>
      <p class="suggestion">${entry.suggestion.note}</p>
      <div class="set-rows" data-exercise="${exerciseId}"></div>
    `;

    card.querySelector('#details-toggle').addEventListener('click', () => {
      this._expandedDetails[exerciseId] = !this._expandedDetails[exerciseId];
      const holder = document.getElementById('exercise-card-holder');
      if (holder) {
        holder.innerHTML = '';
        holder.appendChild(this._renderExerciseCard(session, exerciseId));
      }
    });
    const watchBtn = card.querySelector('#details-watch-video-btn');
    if (watchBtn) watchBtn.addEventListener('click', () => this._openVideoModal(video.url));

    const rows = card.querySelector('.set-rows');
    entry.sets.forEach((set, idx) => {
      rows.appendChild(this._renderSetRow(session, exerciseId, exercise, idx));
    });

    return card;
  },

  _lastSetResult(exerciseId, setIndex) {
    const history = Storage.getExerciseHistory(exerciseId);
    if (!history.length) return null;
    const lastSet = history[history.length - 1].sets[setIndex];
    if (!lastSet) return null;
    if (lastSet.duration != null) return `${lastSet.duration}s`;
    if (lastSet.weight != null && lastSet.reps != null) {
      return `${lastSet.weight} ${Storage.getSettings().units} &times; ${lastSet.reps}`;
    }
    return null;
  },

  _renderSetRow(session, exerciseId, exercise, setIndex) {
    const set = session.entries[exerciseId].sets[setIndex];
    const row = document.createElement('div');
    row.className = 'set-row' + (set.done ? ' done' : '');
    row.dataset.setIndex = String(setIndex);
    const lastResult = this._lastSetResult(exerciseId, setIndex);
    const lastResultHtml = lastResult ? `<div class="last-result">Last: ${lastResult}</div>` : '';

    if (exercise.type === 'time') {
      const target = set.targetDuration;
      row.innerHTML = `
        ${lastResultHtml}
        <span class="set-num">${setIndex + 1}</span>
        <span class="target">Target ${target}s</span>
        <span class="timer-display" data-timer-display>${set.duration != null ? set.duration + 's' : target + 's'}</span>
        <button class="btn small" data-action="timer-toggle">${set.done ? 'Redo' : 'Start'}</button>
        <input type="number" inputmode="numeric" class="input duration-input" placeholder="${target}" value="${set.duration != null ? set.duration : ''}" data-field="duration">
        <button class="btn small primary" data-action="log">${set.done ? '✓' : 'Log'}</button>
      `;
    } else {
      row.innerHTML = `
        ${lastResultHtml}
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
      const isLastSet = Session.isLastSet(session, exerciseId, setIndex);
      const exerciseIds = Object.keys(session.entries);
      const exerciseJustCompleted = Session.isExerciseComplete(session, exerciseId);
      const isLastExercise = exerciseIds.indexOf(exerciseId) === exerciseIds.length - 1;
      const advancingExercise = exerciseJustCompleted && !isLastExercise;
      if (advancingExercise) {
        Session.goToExercise(session, exerciseIds.indexOf(exerciseId) + 1);
      }
      this.renderSession(document.getElementById('app'));
      if (advancingExercise) this._scrollToTop();
      if (!isLastSet) this._startRestTimer(exercise.restSec);
    });

    const timerBtn = row.querySelector('[data-action="timer-toggle"]');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        this._startExerciseTimer(row, exercise, set.targetDuration);
      });
    }

    // Typing a value into one set fills the same value into the other
    // not-yet-logged sets of this exercise, since most sets use the same
    // weight/reps (or duration) — saves re-typing for every set. This has
    // to update the underlying session data too, not just the visible
    // input, or the propagated values vanish the moment the view re-renders
    // (e.g. right after logging a set).
    row.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const container = row.parentElement;
        if (!container) return;
        const field = input.dataset.field;
        container.querySelectorAll('.set-row').forEach((sibling) => {
          if (sibling === row || sibling.classList.contains('done')) return;
          const match = sibling.querySelector(`[data-field="${field}"]`);
          if (match) match.value = input.value;
          const siblingIndex = parseInt(sibling.dataset.setIndex, 10);
          const siblingSet = session.entries[exerciseId].sets[siblingIndex];
          if (siblingSet && !siblingSet.done) {
            const v = parseFloat(input.value);
            siblingSet[field] = isNaN(v) ? null : v;
          }
        });
        Storage.saveActiveSession(session);
      });
    });

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
    if (this._restHideTimeout) clearTimeout(this._restHideTimeout);

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
        this._restHideTimeout = setTimeout(() => this._clearRestTimer(), 2500);
      }
    });
    document.getElementById('rest-label').textContent = 'Resting...';
    this.restTimer.start();
  },

  _clearRestTimer() {
    if (this.restTimer) this.restTimer.pause();
    this.restTimer = null;
    if (this._restHideTimeout) {
      clearTimeout(this._restHideTimeout);
      this._restHideTimeout = null;
    }
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
          ${Object.values(ExerciseRegistry.all()).map((e) => `<option value="${e.id}">${e.name}</option>`).join('')}
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
    const exercise = ExerciseRegistry.get(exerciseId);
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
    const exercise = ExerciseRegistry.get(exerciseId);
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
          ? `<button class="btn primary full" id="watch-video-btn">▶ Watch quick demo${video.channel ? ` (${video.channel})` : ''}</button>`
          : '<p class="muted">No reference video linked yet.</p>'
        }
      </section>
      <section class="card">
        <h2>History</h2>
        ${this._trendHtml(exerciseId)}
      </section>
    `;

    const watchBtn = document.getElementById('watch-video-btn');
    if (watchBtn) watchBtn.addEventListener('click', () => this._openVideoModal(video.url));
  },

  // ---------------- VIDEO MODAL ----------------
  _youtubeEmbedUrl(url) {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (!match) return null;
    return `https://www.youtube.com/embed/${match[1]}?playsinline=1&autoplay=1&rel=0`;
  },

  _openVideoModal(url) {
    const embedUrl = this._youtubeEmbedUrl(url);
    const modal = document.getElementById('video-modal');
    const frame = document.getElementById('video-modal-frame');
    const fallback = document.getElementById('video-modal-fallback');
    if (!embedUrl) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    fallback.href = url;
    frame.innerHTML = `<iframe src="${embedUrl}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    modal.classList.remove('hidden');
  },

  _closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const frame = document.getElementById('video-modal-frame');
    modal.classList.add('hidden');
    frame.innerHTML = ''; // stop playback by removing the iframe entirely
  },

  initVideoModal() {
    document.getElementById('video-modal-close').addEventListener('click', () => this._closeVideoModal());
    document.querySelector('#video-modal .video-modal-backdrop').addEventListener('click', () => this._closeVideoModal());
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
        <h2>Workout Plans</h2>
        <ul class="plan-list">
          ${Plans.getAll().map((p) => {
            const isActive = p.id === Plans.getActiveId();
            return `
              <li class="plan-row ${isActive ? 'active' : ''}">
                <div class="plan-row-info">
                  <span class="plan-row-name">${p.name}</span>
                  <span class="muted">${p.days.length} day${p.days.length === 1 ? '' : 's'}${isActive ? ' · Active' : ''}</span>
                </div>
                <div class="plan-row-actions">
                  ${isActive ? '' : `<button class="btn small" data-plan-action="activate" data-plan-id="${p.id}">Use</button>`}
                  <button class="btn small" data-plan-action="rename" data-plan-id="${p.id}">Rename</button>
                  ${p.builtin ? '' : `<button class="btn small subtle" data-plan-action="delete" data-plan-id="${p.id}">Delete</button>`}
                </div>
              </li>`;
          }).join('')}
        </ul>
        <button class="btn primary full" id="import-plan-btn">Import Plan from Excel</button>
        <p class="muted">Expects columns: Day, Exercise, Sets, Reps, Rest (sec). "Reps" can be a number, a range like 8-12, or a hold time like 30s.</p>
        <input type="file" id="import-plan-input" accept=".xlsx,.xls" class="hidden">
      </section>
      <section class="card">
        <h2>Backup</h2>
        <p class="muted">${this._lastBackupText()}</p>
        <button class="btn primary full" id="backup-settings-btn">Back Up Now</button>
        <button class="btn full" id="restore-settings-btn">Restore from Backup</button>
        <input type="file" id="restore-file-input" accept="application/json" class="hidden">
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
    document.querySelectorAll('[data-plan-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.planId;
        const action = btn.dataset.planAction;
        if (action === 'activate') {
          Plans.setActiveId(id);
          this._selectedDayIndex = null;
          this.render();
        } else if (action === 'rename') {
          const plan = Plans.get(id);
          const name = prompt('Plan name:', plan.name);
          if (name && name.trim()) {
            Plans.rename(id, name.trim());
            this.render();
          }
        } else if (action === 'delete') {
          const plan = Plans.get(id);
          if (confirm(`Delete "${plan.name}"? This can't be undone (your logged exercise history is kept).`)) {
            if (!Plans.remove(id)) alert("Can't delete your only plan.");
            this._selectedDayIndex = null;
            this.render();
          }
        }
      });
    });
    const importPlanBtn = document.getElementById('import-plan-btn');
    const importPlanInput = document.getElementById('import-plan-input');
    importPlanBtn.addEventListener('click', () => importPlanInput.click());
    importPlanInput.addEventListener('change', () => {
      if (importPlanInput.files[0]) this._importPlanFile(importPlanInput.files[0]);
    });
    document.getElementById('backup-settings-btn').addEventListener('click', () => {
      this._runBackup().then(() => this.render());
    });
    const fileInput = document.getElementById('restore-file-input');
    document.getElementById('restore-settings-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) this._importBackupFile(fileInput.files[0]);
    });
    document.getElementById('reset-data').addEventListener('click', () => {
      if (confirm('This clears all logged workouts, custom plans, and settings on this device. Continue?')) {
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
        localStorage.removeItem(CUSTOM_EXERCISES_KEY);
        localStorage.removeItem(PLANS_KEY);
        localStorage.removeItem(ACTIVE_PLAN_KEY);
        this._selectedDayIndex = null;
        this.navigate('/');
        this.render();
      }
    });
  },

  _lastBackupText() {
    const last = Storage.getLastBackupAt();
    if (!last) return 'Never backed up.';
    const days = Math.floor((Date.now() - last) / 86400000);
    if (days <= 0) return 'Last backed up today.';
    if (days === 1) return 'Last backed up yesterday.';
    return `Last backed up ${days} days ago.`;
  },

  // ---------------- WAKE LOCK ----------------
  // Keep the screen on for as long as the app stays open, not just during
  // rest timers. The OS releases the lock whenever the tab is backgrounded,
  // so it has to be re-requested every time the app comes back to the front.
  initWakeLock() {
    const requestLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          this._appWakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {
        // not supported, or the browser refused it — nothing to do
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') requestLock();
    });
    requestLock();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.initRestBanner();
  App.initVideoModal();
  App.initWakeLock();
  App.init();
});
