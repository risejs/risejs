/**
 * Seeded RNG: reproducible for procgen, netcode, replay and tests.
 * mulberry32: 32-bit, fast, good enough for games (not for cryptography).
 */
export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(input = '') {
  let h = 2166136261 >>> 0;
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed = 1) {
    this.seed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    this.next = mulberry32(this.seed || 1);
  }

  /** [0,1) */
  float() {
    return this.next();
  }

  /** [min,max) */
  range(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  /** integer in [min,max] */
  int(min = 0, max = 1) {
    return Math.floor(this.range(min, max + 1));
  }

  bool(p = 0.5) {
    return this.next() < p;
  }

  pick(list = []) {
    return list.length ? list[Math.floor(this.next() * list.length)] : undefined;
  }

  shuffle(list = []) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** entries: [[value, weight], ...] or [{ value, weight }] */
  weighted(entries = []) {
    const list = entries.map((e) => (Array.isArray(e) ? { value: e[0], weight: Number(e[1]) || 0 } : e));
    const total = list.reduce((n, e) => n + Math.max(0, e.weight), 0);
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const e of list) {
      roll -= Math.max(0, e.weight);
      if (roll <= 0) return e.value;
    }
    return list[list.length - 1]?.value;
  }

  /** Independent child generator; the same root seed gives the same sequence. */
  fork(salt = 0) {
    return new Rng(hashSeed(`${this.seed}:${salt}`));
  }
}
