/**
 * Reactive-lite (~2 KB): Proxy + effect + computed + per-frame flush.
 *
 * For UI and small state (HP, ammo, score, objective). NOT for thousands of entities;
 * the game loop still updates those by hand to stay fast.
 *
 *   const s = reactive({ hp: 100 });
 *   effect(() => (el.textContent = `HP ${s.hp}`));
 *   s.hp = 90;      // the effect is queued
 *   flush();        // the app calls this at the end of every frame
 */

const deps = new WeakMap();
const proxyCache = new WeakMap();
const queue = new Set();
let active = null;

const isObject = (v) => v !== null && typeof v === 'object';

export function reactive(obj) {
  if (!isObject(obj)) return obj;
  if (proxyCache.has(obj)) return proxyCache.get(obj);

  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      const value = Reflect.get(target, key, receiver);
      return isObject(value) ? reactive(value) : value;
    },
    set(target, key, value, receiver) {
      const old = target[key];
      const ok = Reflect.set(target, key, value, receiver);
      if (!Object.is(old, value)) trigger(target, key);
      return ok;
    },
    deleteProperty(target, key) {
      const ok = Reflect.deleteProperty(target, key);
      trigger(target, key);
      return ok;
    },
  });

  proxyCache.set(obj, proxy);
  return proxy;
}

function track(target, key) {
  if (!active) return;
  let map = deps.get(target);
  if (!map) deps.set(target, (map = new Map()));
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  set.add(active);
  active.deps.push([target, key]);
}

function trigger(target, key) {
  const map = deps.get(target);
  if (!map) return;
  const set = map.get(key);
  if (!set) return;
  for (const eff of set) queue.add(eff);
}

/** Runs fn and tracks what it reads. Returns a stop function. */
export function effect(fn) {
  const runner = {
    deps: [],
    run() {
      cleanup(runner);
      const prev = active;
      active = runner;
      try {
        fn();
      } finally {
        active = prev;
      }
    },
  };
  runner.run();
  return () => {
    cleanup(runner);
    queue.delete(runner);
  };
}

function cleanup(runner) {
  for (const [target, key] of runner.deps) {
    deps.get(target)?.get(key)?.delete(runner);
  }
  runner.deps.length = 0;
}

/** Derived value, updated when its dependencies change (flushed per frame). */
export function computed(getter) {
  let value;
  effect(() => {
    value = getter();
  });
  return () => value;
}

/** Call at the end of each frame to update dirty UI. */
export function flush() {
  for (const eff of [...queue]) {
    queue.delete(eff);
    eff.run();
  }
}

/** Changes several values, then flushes once. */
export function batch(fn) {
  fn();
  flush();
}
