/** Pure lobby logic (rules kept in sync with server/src/rooms.js). */
export function pickRoom(rooms = [], { prefer = null, maxPlayers = 16 } = {}) {
  const list = rooms.filter((r) => r && r.players < Math.min(r.max || 16, maxPlayers));
  if (!list.length) return null;
  if (prefer && list.some((r) => r.name === prefer)) return prefer;
  return [...list].sort((a, b) => a.players - b.players || String(a.name).localeCompare(b.name))[0].name;
}

export function formatRooms(summary) {
  const rooms = summary?.rooms || [];
  if (!rooms.length) return 'No open rooms yet.';
  return rooms.map((r) => `${r.name} ${r.players}/${r.max}`).join(' · ');
}
