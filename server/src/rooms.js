/**
 * Pure lobby logic: picks a room, computes load. Does not depend on KV.
 */
export const ROOM_TTL = 60;

export function normalizeRoom(input = {}) {
  return {
    name: String(input.room || input.name || 'arena').slice(0, 40),
    players: Math.max(0, Number(input.players) || 0),
    max: Math.max(1, Number(input.max) || 16),
    ts: Number(input.ts) || Date.now(),
  };
}

/** Picks the least crowded room that still has space; prefers `prefer` when it has space. */
export function pickRoom(rooms = [], { prefer = null, maxPlayers = 16 } = {}) {
  const list = rooms.map(normalizeRoom).filter((r) => r.players < Math.min(r.max, maxPlayers));
  if (!list.length) return null;

  if (prefer) {
    const hit = list.find((r) => r.name === prefer);
    if (hit) return hit.name;
  }
  list.sort((a, b) => a.players - b.players || a.name.localeCompare(b.name));
  return list[0].name;
}

export function roomSummary(rooms = []) {
  const list = rooms.map(normalizeRoom);
  return {
    rooms: list,
    total: list.reduce((n, r) => n + r.players, 0),
    open: list.filter((r) => r.players < r.max).length,
  };
}
