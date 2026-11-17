/** Seeded content generation: noise, scatter, rooms. Pure and testable. */
import { Rng } from '../../rng.js';

export function makeRng(seed = 1) {
  return seed instanceof Rng ? seed : new Rng(seed);
}

/** 2D value noise + fbm, deterministic per seed. */
export function makeNoise(seed = 1) {
  const rng = new Rng(seed);
  const perm = rng.shuffle([...Array(256).keys()]);
  const grad = new Float32Array(256);
  for (let i = 0; i < 256; i++) grad[i] = rng.float();

  const at = (x, y) => grad[(perm[x & 255] + perm[y & 255]) & 255];
  const smooth = (t) => t * t * (3 - 2 * t);

  function noise2D(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  }

  return {
    noise2D,
    fbm(x, y, { octaves = 4, lacunarity = 2, gain = 0.5 } = {}) {
      let sum = 0;
      let amp = 1;
      let norm = 0;
      let fx = x;
      let fy = y;
      for (let i = 0; i < octaves; i++) {
        sum += noise2D(fx, fy) * amp;
        norm += amp;
        amp *= gain;
        fx *= lacunarity;
        fy *= lacunarity;
      }
      return sum / norm;
    },
  };
}

/** Poisson-lite point scatter (rejects points closer than a minimum distance). */
export function scatter(rng, { count = 40, width = 100, height = 100, minDist = 4, maxTries = 12 } = {}) {
  const r = makeRng(rng);
  const points = [];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < maxTries; t++) {
      const x = r.range(0, width);
      const y = r.range(0, height);
      if (points.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist)) {
        points.push({ x, y });
        break;
      }
    }
  }
  return points;
}

/** Non-overlapping rooms plus corridors joining the centers of adjacent rooms. */
export function generateRooms(rng, { count = 6, width = 96, height = 96, min = 8, max = 18, margin = 2, tries = 60 } = {}) {
  const r = makeRng(rng);
  const rooms = [];

  for (let i = 0; i < count; i++) {
    for (let t = 0; t < tries; t++) {
      const w = r.int(min, max);
      const h = r.int(min, max);
      const x = r.int(margin, Math.max(margin, width - w - margin));
      const y = r.int(margin, Math.max(margin, height - h - margin));
      const rect = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
      const overlap = rooms.some(
        (o) => rect.x < o.x + o.w + 2 && rect.x + rect.w + 2 > o.x && rect.y < o.y + o.h + 2 && rect.y + rect.h + 2 > o.y
      );
      if (!overlap) {
        rooms.push(rect);
        break;
      }
    }
  }

  const corridors = [];
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    corridors.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: a.cy });
    corridors.push({ x1: b.cx, y1: a.cy, x2: b.cx, y2: b.cy });
  }

  return { rooms, corridors, start: rooms[0] || null, end: rooms[rooms.length - 1] || null };
}

/** 4-direction autotile: bits N=1, E=2, S=4, W=8 → variant index 0..15. */
export function autotileMask({ n = false, e = false, s = false, w = false } = {}) {
  return (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
}
