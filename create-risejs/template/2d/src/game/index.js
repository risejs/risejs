import * as THREE from 'three';
import { sidePlugin } from 'risejs-core/packs/sideview';

// Side-scrolling platformer (2.5D): A/D to move, Space to jump, touch the green gate to win.
export default {
  id: '__NAME__',
  title: '__TITLE__',

  config: {
    preset: { camera: 'fp', crosshair: 'none' },
    // Turn off the first-person controller so the sideview pack drives the character.
    player: { controller: 'none', spawn: [0, 3] },
    hud: { hint: { enabled: true, text: 'A/D MOVE · SPACE JUMP' } },
  },

  hud: {
    kicker: 'LEVEL 1',
    title: 'REACH THE GREEN GATE',
    sub: 'Platformer 2.5D',
  },

  build(app) {
    const root = new THREE.Group();
    const colliders = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0x4e545c, roughness: 0.85 });

    // Block with a collider: (width, height, centre x, bottom y).
    const block = (w, h, x, y) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), mat);
      mesh.position.set(x, y + h / 2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      root.updateMatrixWorld(true);
      colliders.push(new THREE.Box3().setFromObject(mesh));
    };

    block(80, 2, 30, -2); // floor
    block(6, 1, 12, 2); // step
    block(6, 1, 22, 4);
    block(8, 1, 34, 2.5);

    app.world.setStatic(root, colliders);

    // Goal gate: a trigger that fires once when the player touches it.
    app.use(sidePlugin, {
      spawn: [0, 3],
      speed: 6,
      jump: 11.5,
      gravity: 30,
      cameraDist: 26,
      triggers: [
        {
          id: 'goal',
          box: new THREE.Box3(new THREE.Vector3(48, 0, -2), new THREE.Vector3(52, 6, 2)),
          once: true,
          onEnter: () => app.setObjective({ title: 'COMPLETE', sub: 'You reached the green gate' }),
        },
      ],
    });

    // Gate mesh (visual only).
    const gate = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 6),
      new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    gate.position.set(50, 3, 0);
    app.scene.add(gate);
  },
};
