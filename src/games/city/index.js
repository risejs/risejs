import { buildCity } from './world.js';
import { box } from '../../rise/index.js';
import { inventoryPlugin } from '../../rise/packs/inventory/index.js';
import { questPlugin } from '../../rise/packs/quest/index.js';
import { audio3dPlugin } from '../../rise/packs/audio3d/index.js';

const DIALOGUE = {
  intro: {
    speaker: 'MARA',
    text: 'Warden, three supply crates dropped around this area. Could you pick them up for me?',
    choices: [
      {
        label: 'Take the job',
        next: 'accepted',
        action(app) {
          app.quests.add({
            id: 'supply',
            title: 'SUPPLY RUN',
            steps: [{ id: 'crates', text: 'Collect supply crates', need: 3 }],
          });
          // crates picked up before taking the job count too
          const have = app.inventory?.count('supply') ?? 0;
          if (have) app.quests.progress('supply', 'crates', have);
          app.setObjective({ title: 'COLLECT 3 CRATES', sub: 'Dock · plaza · park' });
        },
      },
      { label: 'Later', next: null },
    ],
  },
  accepted: {
    speaker: 'MARA',
    text: 'Three crates: by the dock, next to the stone plaza, and in the park to the west.',
    choices: [{ label: 'Got it', next: null }],
  },
  done: {
    speaker: 'MARA',
    text: 'That is all of them. Thanks, Warden.',
    choices: [{ label: 'Done', next: null }],
  },
};

export default {
  id: 'city',
  title: 'Rise — City',

  config: {
    render: { fog: 0.0068, fogColor: '#4a2a1b', exposure: 1.35 },
    sky: { zenith: '#0a0c10', horizon: '#d9793a', ground: '#160f0c', glow: '#ff8c3d', glowStrength: 0.85 },
    lights: {
      sun: { position: [-26, 22, 40], intensity: 3.6 },
      fillSky: 0x3d5570,
      fillGround: 0x2c211a,
      rimColor: 0x4a6f96,
      bounce: { color: '#ff6a2a', intensity: 12 },
    },
    player: { spawn: [0, 0, 10], yaw: 0 },
    hud: { hint: { enabled: true, text: 'WASD · E INTERACT · I BAG · V CAMERA · P MENU' } },
  },

  hud: {
    kicker: 'DISTRICT 04 — FOUNDRY WARD',
    title: 'REACH THE PARK',
    sub: 'Cross the street · pond to the north',
  },

  async build(app) {
    const { npcPlugin } = await import('../../rise/packs/npc/index.js');
    app.use(inventoryPlugin, { capacity: 8 });
    app.use(questPlugin);
    app.use(audio3dPlugin);
    app.use(npcPlugin);

    const city = buildCity();
    app.city = city;
    app.world.setStatic(city.root, city.colliders, city.surface);

    let t = 0;
    app.world.updateStatic = (dt, ctx) => {
      t += dt;
      city.update(t, ctx.player.pos);
    };

    // embers are city decoration → loaded lazily, not part of the core
    import('../../rise/packs/vfx/embers.js').then(({ createEmbers }) => {
      const embers = createEmbers({ count: 220, seed: 4 });
      app.scene.add(embers);
      let t = 0;
      app.events.on('frame', (dt) => {
        t += dt;
        embers.userData.update(dt, t);
      });
    });

    // --- Mara: a standing NPC that opens a dialogue ---
    const mara = app.spawnNpc({ path: [[2, 0, 6]], speed: 0, color: 0x7a4a2a, name: 'mara' });
    app.interaction.add(mara, {
      label: 'Talk to Mara',
      range: 3.4,
      onUse: () => app.dialogue.start(DIALOGUE, 'intro'),
    });

    // --- glTF crate + rise.asset.json manifest (collider/anchor/budget) ---
    import('../../rise/packs/gltf/index.js')
      .then(async ({ loadAsset, applyManifestColliders, prefabFromGltf, budgetCheck }) => {
        const asset = await loadAsset('/models/crate.glb');
        if (asset.warnings.length) console.warn('[city] manifest:', asset.warnings.map((w) => w.code).join(', '));

        let triangles = 0;
        asset.gltf.scene.traverse((o) => {
          if (o.isMesh) triangles += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
        });
        const budget = budgetCheck(asset.manifest?.budget, { triangles: { LOD0: triangles }, draws: 1 });
        if (budget.status === 'fail') console.warn('[city] asset budget exceeded:', budget.tiers);

        const make = prefabFromGltf(asset.gltf, { scale: 0.9, tags: ['deco', 'solid'] });
        const { attachSurfaceWear } = await import('../../rise/packs/surface/index.js');
        attachSurfaceWear(asset.gltf.scene, { strength: 0.6 });

        for (const [x, z, rotY] of [
          [3.4, 8, 0.3],
          [4.2, 7.4, 1.1],
          [3.8, 8.4, 2.2],
        ]) {
          const entity = make({ pos: [x, 0.45, z], rotY });
          applyManifestColliders(entity, asset.manifest);
          app.add(entity);
        }
      })
      .catch(() => console.warn('[city] could not load crate.glb'));

    // --- 3 supply crates ---
    const spots = [
      [6, 0.4, 4, 'the crate by the dock'],
      [17, 0.4, 12, 'the crate by the plaza'],
      [-24, 0.4, 26, 'the crate in the park'],
    ];

    for (const [x, y, z, label] of spots) {
      const crate = box({
        size: [0.8, 0.8, 0.8],
        position: [x, y, z],
        color: 0x8a5a2b,
        tags: ['pickup', 'supply'],
        opts: { emissive: 0x3a1a00, emissiveIntensity: 0.7 },
      });
      app.add(crate);
      app.interaction.add(crate, {
        label: `Pick up ${label}`,
        range: 2.8,
        onUse: () => {
          app.inventory.add({ id: 'supply', name: 'Supply crate' }, 1);
          app.world.remove(crate);
          app.audio.play('ui');
        },
      });
    }

    // --- quest wiring ---
    app.events.on('inventory:add', ({ item, count }) => {
      if (item.id === 'supply') app.quests.progress('supply', 'crates', count ?? 1);
    });

    app.events.on('quest:complete', ({ quest }) => {
      if (quest.id !== 'supply') return;
      app.setObjective({ title: 'BRING THE CRATES TO MARA', sub: 'Talk to Mara' });
      app.hud.setHint('All 3 crates collected. Go back to Mara');
    });

    // extra NPCs to keep the scene lively
    app.spawnNpc({
      path: [
        [8, 0, 2],
        [26, 0, 2],
        [26, 0, 12],
        [8, 0, 12],
      ],
      speed: 1.5,
      pause: 1.6,
      color: 0x2f4b6b,
      name: 'patrol-street',
    });
  },

  tick(dt, app) {
    // positional audio at the pond
    app._ping = (app._ping || 0) + dt;
    if (app._ping > 6) {
      app._ping = 0;
      const d = Math.hypot(app.player.pos.x - 0, app.player.pos.z + 34);
      if (d < 40) app.audio3d.playAt('ui', { x: 0, y: 0.4, z: -34 }, { gain: 0.12 });
    }
  },
};
