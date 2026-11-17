/** Minimal event bus: on / once / off / emit. */
export class Emitter {
  constructor() {
    this.map = new Map();
  }

  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off(type, fn) {
    this.map.get(type)?.delete(fn);
  }

  /** Removes every listener (called last by app.destroy()). */
  clear() {
    this.map.clear();
  }

  emit(type, payload) {
    for (const fn of this.map.get(type) || []) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[rise] listener for "${type}" threw`, err);
      }
    }
  }
}
