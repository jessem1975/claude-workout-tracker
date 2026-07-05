// Countdown timer used for both rest-between-sets and time-based exercises
// (planks, wall sits, dead hangs, intervals, etc). Uses wall-clock timestamps
// rather than tick-counting so it stays accurate even if the tab is throttled
// in the background.

class CountdownTimer {
  constructor({ duration, onTick, onComplete }) {
    this.duration = duration; // seconds
    this.onTick = onTick || function () {};
    this.onComplete = onComplete || function () {};
    this.remaining = duration;
    this.running = false;
    this._intervalId = null;
    this._endAt = null;
    this._wakeLock = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._endAt = Date.now() + this.remaining * 1000;
    this._requestWakeLock();
    this._intervalId = setInterval(() => this._tick(), 200);
    this._tick();
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._intervalId);
    this.remaining = Math.max(0, Math.round((this._endAt - Date.now()) / 1000));
    this._releaseWakeLock();
  }

  reset(newDuration) {
    this.pause();
    this.duration = typeof newDuration === 'number' ? newDuration : this.duration;
    this.remaining = this.duration;
    this.onTick(this.remaining);
  }

  addSeconds(delta) {
    this.remaining = Math.max(0, this.remaining + delta);
    if (this.running) this._endAt = Date.now() + this.remaining * 1000;
    this.onTick(this.remaining);
  }

  _tick() {
    const remaining = Math.max(0, Math.round((this._endAt - Date.now()) / 1000));
    this.remaining = remaining;
    this.onTick(remaining);
    if (remaining <= 0) {
      this.pause();
      this.onComplete();
    }
  }

  async _requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      // wake lock is best-effort; ignore failures (e.g. backgrounded tab)
    }
  }

  _releaseWakeLock() {
    if (this._wakeLock) {
      this._wakeLock.release().catch(() => {});
      this._wakeLock = null;
    }
  }
}

// Count-up stopwatch, used when someone wants to just track elapsed time
// (e.g. holding an exercise longer than the target, or free-form carries).
class Stopwatch {
  constructor({ onTick } = {}) {
    this.onTick = onTick || function () {};
    this.elapsed = 0;
    this.running = false;
    this._intervalId = null;
    this._startedAt = null;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this._startedAt = Date.now() - this.elapsed * 1000;
    this._intervalId = setInterval(() => {
      this.elapsed = Math.round((Date.now() - this._startedAt) / 1000);
      this.onTick(this.elapsed);
    }, 200);
  }
  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._intervalId);
  }
  reset() {
    this.pause();
    this.elapsed = 0;
    this.onTick(0);
  }
}

const AlertFX = {
  beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, startTime, duration, peak) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square'; // brighter/more piercing harmonic content than sine, cuts through music better
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      };
      // three loud, bright chimes (like a phone notification) instead of one
      // quiet blip, so it has a real chance of being heard over music
      const now = ctx.currentTime;
      playTone(1046.5, now, 0.16, 0.9);
      playTone(1046.5, now + 0.22, 0.16, 0.9);
      playTone(1318.5, now + 0.44, 0.3, 0.9);
    } catch (e) {
      // audio not available; ignore
    }
  },
  vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern || [200, 100, 200]);
  }
};

if (typeof module !== 'undefined') module.exports = { CountdownTimer, Stopwatch, AlertFX };
