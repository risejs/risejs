/**
 * Zone grid: the basis for interest management in multiplayer.
 *
 * Each zone is a square of `size` metres. The server only sends data for the current zone
 * and its neighbours, so 1000 players still only cost the bandwidth of about 9 cells.
 */

export const DEFAULT_ZONE = 64;

export function zoneCoords(x, z, size = DEFAULT_ZONE) {
  return [Math.floor(x / size), Math.floor(z / size)];
}

export function zoneKey(x, z, size = DEFAULT_ZONE) {
  const [zx, zz] = zoneCoords(x, z, size);
  return `${zx},${zz}`;
}

/** Integer id, usable as a Map key or a Redis slot. */
export function zoneId(x, z, size = DEFAULT_ZONE) {
  const [zx, zz] = zoneCoords(x, z, size);
  return (zx & 0xffff) * 65536 + (zz & 0xffff);
}

/** Zones within radius `r` (r=1 → 3×3). */
export function neighborKeys(x, z, size = DEFAULT_ZONE, r = 1) {
  const [zx, zz] = zoneCoords(x, z, size);
  const out = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) out.push(`${zx + dx},${zz + dz}`);
  }
  return out;
}

/** Whether two points are within each other's area of interest. */
export function inInterest(ax, az, bx, bz, size = DEFAULT_ZONE, r = 1) {
  const [ax0, az0] = zoneCoords(ax, az, size);
  const [bx0, bz0] = zoneCoords(bx, bz, size);
  return Math.abs(ax0 - bx0) <= r && Math.abs(az0 - bz0) <= r;
}

/** Filters an entity list by zone of interest; used on the server before sending a snapshot. */
export function filterByInterest(entities, x, z, size = DEFAULT_ZONE, r = 1) {
  return entities.filter((e) => inInterest(x, z, e.x ?? e.position[0], e.z ?? e.position[2], size, r));
}
