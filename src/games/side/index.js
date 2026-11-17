import { buildSideLevel } from './world.js';
import { sidePlugin } from '../../rise/packs/sideview/index.js';
import * as THREE from 'three';

/**
 * 2.5D sample game: side-scrolling platformer, side camera, layered background.
 * Uses `player.controller: 'none'` so the core does not run the first-person controller.
 */
export default {
  id: 'side',
  title: 'Rise — Sideview',

  config: {
    preset: { camera: 'fp', crosshair: 'none' },
    render: { fog: 0.004, exposure: 1.25 },
    lights: { sun: { position: [-22, 34, 20], intensity: 3.1 } },
    player: {
      controller: 'none',
      spawn: [0, 3],
      crouch: { enabled: false },
    },
    hud: {
      hint: { enabled: true, text: 'A/D MOVE · SPACE JUMP · P MENU' },
    },
  },

  hud: {
    kicker: 'SIDEVIEW DEMO',
    title: 'REACH THE GREEN GATE',
    sub: '2.5D platformer · same Rise core',
  },

  build(app) {
    const level = buildSideLevel();
    app.world.setStatic(level.root, level.colliders);
    app.sideLevel = level;

    app.use(sidePlugin, {
      spawn: [0, 3],
      speed: 6,
      jump: 11.5,
      gravity: 30,
      cameraDist: 26,
      fov: 32,
      slopes: level.slopes,
      platforms: level.platforms,
      ladders: level.ladders,
      triggers: [
        {
          id: 'checkpoint',
          box: new THREE.Box3(new THREE.Vector3(40, 3, -2), new THREE.Vector3(44, 7, 2)),
          once: true,
          onEnter: () => app.hud.setHint('CHECKPOINT · position saved'),
        },
        {
          id: 'goal',
          box: new THREE.Box3(new THREE.Vector3(104, 3, -2), new THREE.Vector3(110, 7, 2)),
          once: true,
          onEnter: () => {
            app.setObjective({ title: '2.5D LEVEL COMPLETE', sub: 'Press P for the menu' });
            app.audio.play('hit');
          },
        },
      ],
    });

    app.events.on('side:ready', () => {
      app.hud.setHint('A/D MOVE · SPACE JUMP · P MENU');
    });
  },

  tick(dt, app) {
    const c = app.side;
    if (!c || app.sideWon) return;
    if (c.x >= app.sideLevel.goalX) {
      app.sideWon = true;
      app.setObjective({ title: 'LEVEL COMPLETE', sub: 'Try P for the menu' });
      app.audio.play('hit');
    }
  },
};
