/** Attributes, modifiers, levels and status effects. Pure. */

export class Stats {
  constructor(base = {}) {
    this.base = { ...base };
    this.mods = [];
    this.dirty = true;
    this.cache = {};
  }

  set(key, value) {
    this.base[key] = value;
    this.dirty = true;
    return this;
  }

  add(key, value) {
    this.base[key] = (this.base[key] || 0) + value;
    this.dirty = true;
    return this;
  }

  /** mode: 'add' | 'mul' (mul is applied after add and accumulates as 1 + sum) */
  modifier({ stat, value = 0, mode = 'add', source = 'default' }) {
    this.mods.push({ stat, value, mode, source });
    this.dirty = true;
    return this;
  }

  removeBySource(source) {
    const before = this.mods.length;
    this.mods = this.mods.filter((m) => m.source !== source);
    this.dirty = this.dirty || before !== this.mods.length;
    return before - this.mods.length;
  }

  get(key) {
    if (!this.dirty && key in this.cache) return this.cache[key];
    this._recalc();
    return this.cache[key] ?? this.base[key] ?? 0;
  }

  all() {
    this._recalc();
    return { ...this.cache };
  }

  _recalc() {
    const out = { ...this.base };
    const muls = {};
    for (const m of this.mods) {
      if (m.mode === 'mul') muls[m.stat] = (muls[m.stat] || 0) + m.value;
      else out[m.stat] = (out[m.stat] || 0) + m.value;
    }
    for (const [k, v] of Object.entries(muls)) out[k] = (out[k] || 0) * (1 + v);
    this.cache = out;
    this.dirty = false;
    return out;
  }
}

/** XP → level; a simple curve: 100 * level^1.5 */
export function xpForLevel(level = 1) {
  return Math.round(100 * Math.pow(Math.max(1, level), 1.5));
}

export class Progression {
  constructor({ level = 1, xp = 0, curve = xpForLevel } = {}) {
    this.level = level;
    this.xp = xp;
    this.curve = curve;
    this.total = xp;
  }

  get next() {
    return this.curve(this.level);
  }

  get ratio() {
    return Math.min(1, this.xp / this.next);
  }

  /** Returns the number of levels gained. */
  addXp(amount = 0) {
    this.xp += Math.max(0, amount);
    this.total += Math.max(0, amount);
    let gained = 0;
    let guard = 0;
    while (this.xp >= this.next && guard++ < 1000) {
      this.xp -= this.next;
      this.level++;
      gained++;
    }
    return gained;
  }
}

/**
 * Status effects: timed dot/hot/buff, stacked by id.
 */
export class StatusEffects {
  constructor() {
    this.list = [];
  }

  add({ id, duration = 3, dot = 0, hot = 0, stat = null, value = 0, mode = 'add', source = null }) {
    const existing = this.list.find((e) => e.id === id && e.source === source);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.stacks = Math.min(existing.maxStacks || 5, (existing.stacks || 1) + 1);
      return existing;
    }
    const effect = { id, duration, dot, hot, stat, value, mode, source, stacks: 1, maxStacks: 5 };
    this.list.push(effect);
    return effect;
  }

  remove(id) {
    const before = this.list.length;
    this.list = this.list.filter((e) => e.id !== id);
    return before !== this.list.length;
  }

  has(id) {
    return this.list.some((e) => e.id === id);
  }

  /**
   * @returns {{damage:number, heal:number, expired:string[]}}
   */
  tick(dt) {
    let damage = 0;
    let heal = 0;
    const expired = [];

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.duration -= dt;
      const stacks = e.stacks || 1;
      if (e.dot) damage += e.dot * stacks * dt;
      if (e.hot) heal += e.hot * stacks * dt;
      if (e.duration <= 0) {
        expired.push(e.id);
        this.list.splice(i, 1);
      }
    }

    return { damage, heal, expired };
  }

  /** Active modifiers, to push into Stats. */
  modifiers() {
    return this.list.filter((e) => e.stat).map((e) => ({ stat: e.stat, value: e.value * (e.stacks || 1), mode: e.mode, source: e.source || e.id }));
  }
}
