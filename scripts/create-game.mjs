#!/usr/bin/env node
/**
 * Rise scaffolder: creates a new sample game from a template.
 *
 *   npm run create-game -- canyon
 *   → src/games/canyon/index.js + world.js
 */
import fs from 'node:fs';
import path from 'node:path';

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npm run create-game -- <id>   (e.g. canyon)');
  process.exit(1);
}

const id = raw.toLowerCase();
if (!/^[a-z][a-z0-9-]{1,30}$/.test(id)) {
  console.error('Invalid id: use lowercase letters, digits and hyphens only, starting with a letter.');
  process.exit(1);
}

const dir = path.resolve('src/games', id);
if (fs.existsSync(dir)) {
  console.error(`Already exists: ${dir}`);
  process.exit(1);
}

const title = id.replace(/(^|-)([a-z])/g, (_, __, c) => ' ' + c.toUpperCase()).trim();

const indexJs = `import { buildWorld } from './world.js';

export default {
  id: '${id}',
  title: 'Rise — ${title}',

  config: {
    render: { fog: 0.008, exposure: 1.3 },
    lights: { sun: { position: [-26, 22, 40], intensity: 3.4 } },
    player: { spawn: [0, 0, 12], yaw: 0 },
    // example of customising the HUD:
    // hud: { crosshair: { enabled: false } },
  },

  hud: {
    kicker: 'NEW DISTRICT',
    title: 'FIRST OBJECTIVE',
    sub: 'Describe the goal here',
  },

  build(app) {
    const { root, colliders, surface } = buildWorld();
    app.world.setStatic(root, colliders, surface);
  },
};
`;

const worldJs = `import * as THREE from 'three';
import { SurfaceMap, SURFACE } from '../../rise/world/surface.js';

/** Sample world: a floor and 3 blocks with colliders, plus a lawn. */
export function buildWorld() {
  const root = new THREE.Group();
  const colliders = [];
  const surface = new SurfaceMap();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const mat = new THREE.MeshStandardMaterial({ color: 0x4e545c, roughness: 0.8 });
  for (const [x, z, w, h, d] of [
    [-14, -10, 6, 8, 6],
    [0, -18, 10, 14, 8],
    [16, -6, 5, 5, 5],
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    root.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(mesh));
  }

  // surfaces: a lawn and a small pond
  surface.circle(SURFACE.GRASS, -18, 18, 12);
  surface.circle(SURFACE.WATER, 18, 18, 8);

  return { root, colliders, surface };
}
`;

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.js'), indexJs, 'utf8');
fs.writeFileSync(path.join(dir, 'world.js'), worldJs, 'utf8');

console.log(`✔ Created src/games/${id}/`);
console.log(`  Run: http://localhost:5173/?game=${id}`);
