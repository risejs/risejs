/**
 * Arena map data: the SINGLE SOURCE for both the client (geometry) and the server (LOS + collision).
 * Plain data only: no three import, so the server and Node can read it.
 *
 * boxes: { x, z, w, d, h, kind, cover }
 *  - cover: true  → blocks bullets (walls, tall crates)
 *  - cover: false → only blocks movement
 */
export const ARENA_MAP = {
  name: 'arena',
  spawn: { x: 0, z: 8 },
  bounds: { min: { x: -30, z: -30 }, max: { x: 30, z: 30 } },
  boxes: [
    // perimeter walls
    { x: 0, z: -30, w: 60, d: 1, h: 4, kind: 'wall' },
    { x: 0, z: 30, w: 60, d: 1, h: 4, kind: 'wall' },
    { x: -30, z: 0, w: 1, d: 60, h: 4, kind: 'wall' },
    { x: 30, z: 0, w: 1, d: 60, h: 4, kind: 'wall' },

    // pillars
    { x: -14, z: -12, w: 3, d: 3, h: 5, kind: 'wall' },
    { x: 14, z: -12, w: 3, d: 3, h: 5, kind: 'wall' },
    { x: -14, z: 14, w: 3, d: 3, h: 5, kind: 'wall' },
    { x: 14, z: 14, w: 3, d: 3, h: 5, kind: 'wall' },

    // crates (low, but they still block bullets: cover)
    { x: -4, z: -6, w: 2, d: 2, h: 1.4, kind: 'crate' },
    { x: 6, z: 2, w: 3, d: 3, h: 1.4, kind: 'crate' },
    { x: -8, z: 8, w: 2.4, d: 2.4, h: 1.4, kind: 'crate' },
    { x: 10, z: -4, w: 2, d: 2, h: 1.4, kind: 'crate' },
    { x: 0, z: 14, w: 2.6, d: 2.6, h: 1.4, kind: 'crate' },
  ],
  circles: [{ x: -16, z: 16, r: 9, cover: false }],
};

/** Server-side map registry (to extend: add new games here). */
export const GAME_MAPS = { arena: ARENA_MAP };
