/**
 * Exports maps as static JSON for clients and other tools (the server reads src/games/[game]/map.js directly).
 *   node scripts/make-map.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GAME_MAPS } from '../src/games/arena/map.js';

const outDir = 'public/maps';
mkdirSync(outDir, { recursive: true });

for (const [name, map] of Object.entries(GAME_MAPS)) {
  const file = `${outDir}/${name}.json`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(map, null, 2) + '\n', 'utf8');
  const boxes = map.boxes?.length ?? 0;
  const circles = map.circles?.length ?? 0;
  console.log(`✓ ${file} — ${boxes} box, ${circles} circle`);
}
