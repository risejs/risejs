/**
 * Weapons + server-side hit resolution. Pure; can be shared by client and server.
 * The client does not send damage; the server picks the weapon by id and computes it.
 */
export const WEAPONS = {
  rifle: { id: 'rifle', damage: 22, range: 60, rpm: 600, mag: 30, reloadMs: 1800, cone: 0.06 },
  pistol: { id: 'pistol', damage: 18, range: 35, rpm: 400, mag: 12, reloadMs: 1200, cone: 0.08 },
  smg: { id: 'smg', damage: 12, range: 28, rpm: 900, mag: 35, reloadMs: 1500, cone: 0.11 },
  melee: { id: 'melee', damage: 18, range: 2.6, rpm: 120, mag: Infinity, reloadMs: 0, cone: 0.7 },
};

export function weaponOf(id) {
  return WEAPONS[id] || WEAPONS.rifle;
}

/** Whether a 2D segment (x,z) intersects an AABB (min/max x,z); slab test. */
export function segmentBlocked(a, b, box, pad = 0) {
  const minX = (box.min?.x ?? 0) - pad;
  const maxX = (box.max?.x ?? 0) + pad;
  const minZ = (box.min?.z ?? 0) - pad;
  const maxZ = (box.max?.z ?? 0) + pad;

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

/**
 * @param {{origin:{x,z}, dir:{x,z}, targets:{id,pos:{x,z},dead?}[], obstacles?:any[], weapon:string|object, ignoreId?:any, spread?:number}} o
 * @returns {{hit:boolean, target:any|null, distance:number, blocked:boolean}}
 */
export function resolveShot({ origin, dir, targets = [], obstacles = [], weapon = 'rifle', ignoreId = null, spread = 0 } = {}) {
  const w = typeof weapon === 'string' ? weaponOf(weapon) : weapon;
  const len = Math.hypot(dir.x, dir.z) || 1;
  const dx = dir.x / len;
  const dz = dir.z / len;
  const cosCone = Math.cos(Math.min(Math.PI, Math.max(0.001, w.cone + spread)));

  let best = null;
  let blockedAny = false;

  for (const t of targets) {
    if (!t || t.dead || t.id === ignoreId) continue;
    const tx = t.pos.x - origin.x;
    const tz = t.pos.z - origin.z;
    const dist = Math.hypot(tx, tz);
    if (dist > w.range || dist < 1e-6) continue;

    if ((tx / dist) * dx + (tz / dist) * dz < cosCone) continue;

    if (obstacles.some((box) => segmentBlocked(origin, t.pos, box))) {
      blockedAny = true;
      continue;
    }

    if (!best || dist < best.distance) best = { target: t, distance: dist };
  }

  return { hit: !!best, target: best?.target || null, distance: best?.distance || 0, blocked: !best && blockedAny };
}
