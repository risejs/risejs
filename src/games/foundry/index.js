import { buildFoundry } from './world.js';
import { npcPlugin } from '../../rise/packs/npc/index.js';

/** Second sample game: a metal foundry. Same core, different content. */
export default {
  id: 'foundry',
  title: 'Rise — Foundry',

  config: {
    preset: { crosshair: 'dot' },
    render: { fog: 0.016, fogColor: '#3a2018', exposure: 1.28 },
    sky: { zenith: '#0a0a0c', horizon: '#c96a34', ground: '#150e0b', glow: '#ff8a3c', glowStrength: 0.7 },
    lights: {
      sun: { position: [-26, 22, 40], intensity: 3.4 },
      fillSky: 0x3d5570,
      fillGround: 0x2c211a,
      rimColor: 0x4a6f96,
      bounce: { color: '#ff6a2a', intensity: 14 },
    },
    player: { spawn: [4.5, 0, 12], yaw: 0 },
  },

  hud: {
    kicker: 'SECTOR B — SMELTER',
    title: 'RESTART THE EXHAUST FANS',
    sub: 'Foundry floor · three stacks',
  },

  build(app) {
    app.use(npcPlugin);
    const { root, colliders } = buildFoundry();
    app.world.setStatic(root, colliders);

    import('../../rise/packs/vfx/embers.js').then(({ createEmbers }) => {
      const embers = createEmbers({ count: 180, seed: 9, color: 0xffa257 });
      app.scene.add(embers);
      let t = 0;
      app.events.on('frame', (dt) => {
        t += dt;
        embers.userData.update(dt, t);
      });
    });

    app.spawnNpc({
      path: [
        [-6, 0, 4],
        [10, 0, 4],
        [10, 0, 10],
        [-6, 0, 10],
      ],
      speed: 1.3,
      color: 0x6b3a2a,
      name: 'walkers',
    });
  },
};
