/** Lightweight tweens and easing, no dependencies. */
export const EASING = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  cubicIn: (t) => t ** 3,
  cubicOut: (t) => 1 - (1 - t) ** 3,
  cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  backOut: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  elasticOut: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  bounceOut: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class Tweens {
  constructor() {
    this.items = [];
    this.now = 0;
  }

  /**
   * @param {object} o
   * @param {number} o.from @param {number} o.to
   * @param {number} [o.duration] seconds
   * @param {string|function} [o.ease]
   * @param {number} [o.delay]
   * @param {number} [o.repeat] -1 = forever
   * @param {(v:number)=>void} [o.onUpdate]
   * @param {()=>void} [o.onDone]
   */
  add(o = {}) {
    const ease = typeof o.ease === 'function' ? o.ease : EASING[o.ease] || EASING.quadOut;
    const item = {
      from: Number(o.from) || 0,
      to: Number(o.to) || 0,
      duration: Math.max(0.0001, Number(o.duration) || 0.3),
      ease,
      delay: Math.max(0, Number(o.delay) || 0),
      repeat: Number.isFinite(o.repeat) ? Number(o.repeat) : 0,
      onUpdate: o.onUpdate,
      onDone: o.onDone,
      t: 0,
      started: false,
      done: false,
      value: Number(o.from) || 0,
    };
    this.items.push(item);
    return item;
  }

  update(dt) {
    this.now += dt;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.done) {
        this.items.splice(i, 1);
        continue;
      }

      let step = dt;
      if (!it.started) {
        if (it.delay > 0) {
          const used = Math.min(it.delay, step);
          it.delay -= used;
          step -= used;
          if (it.delay > 0) continue;
        }
        it.started = true;
      }

      it.t += step;
      let k = it.t / it.duration;
      let guard = 0;
      while (k >= 1 && guard++ < 1000) {
        if (it.repeat === -1) {
          it.t -= it.duration;
        } else if (it.repeat > 0) {
          it.repeat--;
          it.t -= it.duration;
        } else {
          it.done = true;
          it.value = it.to;
          it.onUpdate?.(it.value);
          it.onDone?.();
          this.items.splice(i, 1);
          break;
        }
        k = it.t / it.duration;
      }

      if (it.done) continue;

      it.value = lerp(it.from, it.to, it.ease(Math.min(1, k)));
      it.onUpdate?.(it.value);
    }
    return this.items.length;
  }

  cancel(item) {
    item.done = true;
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  clear() {
    for (const it of this.items) it.done = true;
    this.items.length = 0;
  }

  get size() {
    return this.items.length;
  }
}

/** Attaches Tweens to the app: updates every frame and exposes `app.tween`. */
export function tweenPlugin(app) {
  const tweens = new Tweens();
  const off = app.events.on('frame', (dt) => tweens.update(dt));
  const api = {
    to: (o) => tweens.add(o),
    update: (dt) => tweens.update(dt),
    cancel: (it) => tweens.cancel(it),
    clear: () => tweens.clear(),
    get size() {
      return tweens.size;
    },
    easing: EASING,
    dispose() {
      off();
      tweens.clear();
      if (app.tween === api) app.tween = null;
    },
  };
  app.tween = api;
  return api;
}
