// Multi-plan management. Seeds a "Default Plan" from DEFAULT_PLAN_DAYS the
// first time the app runs, then supports multiple named plans (the default
// one, plus any created by importing an Excel workbook), with one marked
// active at a time.

const PLANS_KEY = 'wt_plans_v1';
const ACTIVE_PLAN_KEY = 'wt_active_plan_v1';

function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'plan';
}
function uniqueId(base, existingIds) {
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
}

const Plans = {
  _readAll() {
    try {
      const raw = localStorage.getItem(PLANS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Failed to read plans', e);
      return null;
    }
  },
  _writeAll(plans) {
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  },

  _ensureSeeded() {
    let plans = this._readAll();
    if (!plans || plans.length === 0) {
      plans = [{ id: 'default', name: 'Default Plan', builtin: true, days: DEFAULT_PLAN_DAYS }];
      this._writeAll(plans);
    }
    if (!localStorage.getItem(ACTIVE_PLAN_KEY)) {
      localStorage.setItem(ACTIVE_PLAN_KEY, plans[0].id);
    }
    return plans;
  },

  getAll() {
    return this._ensureSeeded();
  },

  getActiveId() {
    this._ensureSeeded();
    const id = localStorage.getItem(ACTIVE_PLAN_KEY);
    const plans = this.getAll();
    if (id && plans.some((p) => p.id === id)) return id;
    return plans[0].id;
  },

  setActiveId(id) {
    localStorage.setItem(ACTIVE_PLAN_KEY, id);
  },

  getActive() {
    return this.get(this.getActiveId());
  },

  get(id) {
    return this.getAll().find((p) => p.id === id) || this.getActive();
  },

  create(name, days) {
    const plans = this.getAll();
    const id = uniqueId(slugify(name), plans.map((p) => p.id));
    const plan = { id, name, builtin: false, days: days || [] };
    plans.push(plan);
    this._writeAll(plans);
    return plan;
  },

  rename(id, newName) {
    const plans = this.getAll();
    const plan = plans.find((p) => p.id === id);
    if (plan) {
      plan.name = newName;
      this._writeAll(plans);
    }
  },

  // Always keeps at least one plan around; returns false if this was the
  // last remaining plan and the removal was refused.
  remove(id) {
    let plans = this.getAll();
    if (plans.length <= 1) return false;
    plans = plans.filter((p) => p.id !== id);
    this._writeAll(plans);
    if (this.getActiveId() === id) this.setActiveId(plans[0].id);
    return true;
  }
};

if (typeof module !== 'undefined') module.exports = { Plans, PLANS_KEY, ACTIVE_PLAN_KEY };
