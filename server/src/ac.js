/**
 * Server-side anti-cheat: normalises input, checks speed, checks hits.
 * Pure, testable in Node.
 */
export const MAX_SPEED = 9.5; // m/s, faster than any legitimate speed (run 6.2 + tolerance)
export const MAX_TELEPORT = 6; // m in one tick
export const MAX_HIT_RANGE = 45;

export function clampInput(input = {}) {
  let { mx = 0, mz = 0, yaw = 0 } = input;
  mx = Number(mx) || 0;
  mz = Number(mz) || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  if (!Number.isFinite(yaw)) yaw = 0;
  return { mx, mz, yaw: ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) };
}

/** true if the move is legitimate; false for a teleport or speed hack. */
export function acceptMove(prev, next, dt, { maxSpeed = MAX_SPEED, maxTeleport = MAX_TELEPORT } = {}) {
  if (!prev || !next || !(dt > 0)) return true;
  const d = Math.hypot(next.x - prev.x, next.z - prev.z);
  if (d > maxTeleport) return false;
  if (d / dt > maxSpeed) return false;
  return true;
}

export function validHit({ from, to, yaw = 0, range = 3, tolerance = 0.6 } = {}) {
  if (!from || !to) return false;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist > Math.min(range, MAX_HIT_RANGE)) return false;
  if (dist < 0.001) return true;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const dot = (dx / dist) * fx + (dz / dist) * fz;
  return dot >= 1 - tolerance;
}

export class ChatGuard {
  constructor({ max = 5, windowMs = 5000 } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  accept(key, now = Date.now()) {
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }

  forget(key) {
    this.hits.delete(key);
  }
}
