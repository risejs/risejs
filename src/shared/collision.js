/**
 * 2D collision shared by client and server. Pure, no dependency on three.
 *
 * Centre-form box: { x, z, w, d, h?, cover?, kind? }, or { min:{x,z}, max:{x,z} }.
 * `cover: true`  → also blocks bullets (walls, tall crates).
 * `cover: false` → blocks movement only (low objects, fences).
 */
const boxBounds = (b) => {
  if (b.min && b.max) {
    return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, cover: b.cover !== false };
  }
  const hw = (b.w ?? 1) / 2;
  const hd = (b.d ?? 1) / 2;
  return { minX: b.x - hw, maxX: b.x + hw, minZ: b.z - hd, maxZ: b.z + hd, cover: b.cover !== false };
};

export class CollisionMap {
  constructor({ boxes = [], circles = [] } = {}) {
    this.boxes = boxes.map((b) => ({ ...boxBounds(b), raw: b }));
    this.circles = circles.map((c) => ({ x: c.x, z: c.z, r: c.r ?? 1, cover: c.cover !== false }));
  }

  get size() {
    return this.boxes.length + this.circles.length;
  }

  /** Whether segment a→b is blocked by an obstacle (for LOS and bullets). `pad` = radius of the person or object. */
  segmentBlocked(a, b, { coverOnly = true, pad = 0 } = {}) {
    for (const box of this.boxes) {
      if (coverOnly && !box.cover) continue;
      if (segmentHitsBox(a, b, box, pad)) return true;
    }
    for (const c of this.circles) {
      if (coverOnly && !c.cover) continue;
      if (segmentHitsCircle(a, b, c, pad)) return true;
    }
    return false;
  }

  /** Whether a position overlaps an obstacle (for movement). */
  circleBlocked(x, z, r = 0) {
    for (const box of this.boxes) {
      const cx = Math.min(Math.max(x, box.minX), box.maxX);
      const cz = Math.min(Math.max(z, box.minZ), box.maxZ);
      if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) return true;
    }
    for (const c of this.circles) {
      if (Math.hypot(x - c.x, z - c.z) <= c.r + r) return true;
    }
    return false;
  }

  /**
   * Movement with sliding: try the full step, then X only, then Z only.
   * Returns the valid end point + a `blocked` flag so the server knows a correction happened.
   */
  resolveMove(from, to, r = 0.35) {
    const hits = (x, z) => this.circleBlocked(x, z, r * 0.5) || this.segmentBlocked(from, { x, z }, { coverOnly: false, pad: r });
    if (!hits(to.x, to.z)) return { x: to.x, z: to.z, blocked: false };
    if (!hits(to.x, from.z)) return { x: to.x, z: from.z, blocked: true };
    if (!hits(from.x, to.z)) return { x: from.x, z: to.z, blocked: true };
    return { x: from.x, z: from.z, blocked: true };
  }
}

function segmentHitsBox(a, b, box, pad = 0) {
  const minX = box.minX - pad;
  const maxX = box.maxX + pad;
  const minZ = box.minZ - pad;
  const maxZ = box.maxZ + pad;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let t0 = 0;
  let t1 = 1;
  for (const [p, d, lo, hi] of [
    [a.x, dx, minX, maxX],
    [a.z, dz, minZ, maxZ],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

function segmentHitsCircle(a, b, c, pad = 0) {
  const r = c.r + pad;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(a.x - c.x, a.z - c.z) <= r;
  let t = ((c.x - a.x) * dx + (c.z - a.z) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + dx * t;
  const pz = a.z + dz * t;
  return Math.hypot(px - c.x, pz - c.z) <= r;
}
