import * as THREE from 'three';
import { buildRogue, spotsInRooms } from './world.js';
import { combatPlugin } from '../../rise/packs/combat/index.js';
import { vfxPlugin } from '../../rise/packs/vfx/index.js';
import { lootPlugin } from '../../rise/packs/loot/index.js';
import { npcPlugin, NpcAgent } from '../../rise/packs/npc/index.js';
import { bakesPlugin } from '../../rise/packs/bakes/index.js';
import { musicPlugin } from '../../rise/packs/music/index.js';

const LOOT_NAMES = { ammo: 'Ammo', scrap: 'Scrap', medkit: 'Medkit', core: 'Power core' };
void LOOT_NAMES;

export default {
  id: 'rogue',
  title: 'Rise — Rogue',

  config: {
    preset: { camera: 'topdown', crosshair: 'none' },
    render: { fog: 0.011, exposure: 1.2 },
    sky: { zenith: '#080b10', horizon: '#1b2836', ground: '#070a0d' },
    lights: { sun: { position: [-18, 26, 14], intensity: 2.4 }, ambient: 0.55 },
    player: { spawn: [0, 0, 0], yaw: 0, speed: 6.4 },
    hud: { hint: { enabled: true, text: 'WASD move · LEFT MOUSE attack · E pick up · R reload level' } },
  },

  hud: {
    kicker: 'RUN 01 — SEEDED DUNGEON',
    title: 'CLEAR THE FLOOR',
    sub: 'Rooms generated from a seed · enemies chase along the navmesh',
  },

  async build(app) {
    app.use(vfxPlugin);
    app.use(combatPlugin);
    app.use(lootPlugin);
    app.use(npcPlugin);
    app.use(musicPlugin);

    const seed = app.seed || 'rogue-1';
    const level = buildRogue({ seed, rooms: 7 });
    app.world.setStatic(level.root, level.colliders);
    app.nav = level.nav;
    app.rogue = level;

    app.player.pos.set(level.spawn.x, 0, level.spawn.z);
    app.music.play('tense');

    app.playerRef = { pos: app.player.pos, mesh: { position: app.player.pos }, team: 1 };
    app.combat.register(app.playerRef, { hp: 100, team: 1, bar: false });

    // enemies and loot spawn gradually within the frame budget (bakes pack)
    const rng = app.rng.fork('enemies');
    const rooms = level.rooms.slice(1);
    const total = rooms.length;

    app.use(bakesPlugin, { budgetMs: 4, urgentMs: 8 });

    function* spawnEnemies() {
      for (const room of rooms) {
        const spot = { x: room.cx - 48, z: room.cy - 48 };
        const npc = new NpcAgent({
          path: [[spot.x, 0, spot.z]],
          speed: 1.4,
          chaseSpeed: 3.1,
          sight: 26,
          lose: 40,
          color: 0x6b2f2a,
          name: 'enemy',
          nav: level.nav,
        });
        app.world.add(npc);
        app.combat.register(npc, { hp: 40 + rng.int(0, 30), team: 2 });
        yield room;
      }
      return total;
    }

    function* spawnLoot() {
      for (const spot of spotsInRooms(level.rooms, rng, { perRoom: 1 })) {
        app.loot.spawnAt({ x: spot.x, y: 0.5, z: spot.z }, { table: 'rogue' });
        yield spot;
      }
    }

    app.bakes.add({ id: 'rogue-enemies', owner: 'rogue', priority: 2, work: spawnEnemies() });
    app.bakes.add({ id: 'rogue-loot', owner: 'rogue', priority: 0, work: spawnLoot() });

    app.score = { kills: 0, loot: 0, total };
    app.hud.bind('.obj-s', () => `HP ${Math.round(app.combat.healthOf(app.playerRef).hp)} · ENEMIES ${app.score.kills}/${app.score.total} · LOOT ${app.score.loot}`);

    app.events.on('combat:death', ({ target }) => {
      if (target === app.playerRef) {
        app.hud.setHint('YOU DIED · R to play again');
        return;
      }
      app.score.kills++;
      app.audio.play('ui');
      if (app.score.kills >= app.score.total) {
        app.hud.setHint('ALL CLEAR · head to the glowing door to exit');
        app.exitPortal.visible = true;
      }
    });

    app.events.on('loot:pick', () => {
      app.score.loot++;
      app.audio.play('ui');
    });

    // exit gate
    const portal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 3, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fd18b, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    portal.position.set(level.exit.x, 1.5, level.exit.z);
    portal.visible = false;
    app.scene.add(portal);
    app.exitPortal = portal;

    app.events.on('frame', (dt) => {
      portal.rotation.y += dt * 0.8;
      if (portal.visible && app.player.pos.distanceTo(portal.position) < 2) {
        app.hud.setHint('ESCAPED. New seed: ' + Math.random().toString(36).slice(2, 8));
        portal.visible = false;
      }
    });

    ('nb' in app.options) || app.hud.setHint('WASD · LEFT MOUSE attack · E pick up · R reload level');
  },

  tick() {},
};
