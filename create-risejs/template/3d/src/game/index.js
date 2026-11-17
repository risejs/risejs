import * as THREE from 'three';
import { box } from 'risejs-core';
import { inventoryPlugin } from 'risejs-core/packs/inventory';

const TOTAL = 3;

// First-person 3D game: collect all 3 crystals (walk up to one and press E).
export default {
  id: '__NAME__',
  title: '__TITLE__',

  // Overrides the default config. See the docs at risejs.dev.
  config: {
    player: { spawn: [0, 0, 10], yaw: 0 },
  },

  // Objective block on the HUD.
  hud: {
    kicker: 'LEVEL 1',
    title: 'COLLECT THE CRYSTALS',
    sub: `0/${TOTAL}`,
  },

  build(app) {
    // Floor (no collider; the player walks on the y = 0 plane).
    const root = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    app.world.setStatic(root, []);

    // Inventory pack (opt-in): provides app.inventory and app.interaction.
    app.use(inventoryPlugin, { capacity: 8 });

    // Obstacles: entities with automatic colliders.
    for (const [x, z] of [[-6, -4], [7, -8]]) {
      app.add(box({ size: [3, 4, 3], position: [x, 2, z], color: 0x4e545c }));
    }

    // Crystals: no collider; press E when close to pick one up.
    let found = 0;
    for (const [x, z] of [[-10, 2], [0, -14], [11, -2]]) {
      const crystal = app.add(
        box({
          size: [0.7, 0.7, 0.7],
          position: [x, 1, z],
          color: 0xffb347,
          tags: ['pickup'],
          autoCollider: false,
          opts: { emissive: 0xffb347, emissiveIntensity: 0.6 },
        })
      );
      app.interaction.add(crystal, {
        label: 'Pick up crystal',
        onUse: () => {
          app.inventory.add({ id: 'crystal', name: 'Crystal' }, 1);
          app.interaction.remove(crystal);
          app.world.remove(crystal);
          found++;
          app.setObjective(
            found >= TOTAL
              ? { title: 'COMPLETE', sub: 'You collected every crystal' }
              : { sub: `${found}/${TOTAL}` }
          );
        },
      });
    }
  },

  // Runs every frame (dt is in seconds).
  tick(dt, app) {
    for (const e of app.world.query('pickup')) e.mesh.rotation.y += dt;
  },
};
