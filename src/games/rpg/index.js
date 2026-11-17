import * as THREE from 'three';
import { box } from '../../rise/index.js';
import { combatPlugin } from '../../rise/packs/combat/index.js';
import { vfxPlugin } from '../../rise/packs/vfx/index.js';
import { statsPlugin, Stats, Progression } from '../../rise/packs/stats/index.js';
import { lootPlugin } from '../../rise/packs/loot/index.js';
import { inventoryPlugin } from '../../rise/packs/inventory/index.js';
import { dialoguePlugin } from '../../rise/packs/dialogue/index.js';
import { vnPlugin } from '../../rise/packs/vn/index.js';
import { musicPlugin } from '../../rise/packs/music/index.js';
import { npcPlugin } from '../../rise/packs/npc/index.js';

const DIALOGUE = {
  intro: {
    speaker: 'MERCHANT',
    text: 'You are late. Bandits took all my goods. Help me get them back and I will pay you.',
    choices: [
      { label: 'Take the job (get 20 coins)', next: 'accepted', action: (app) => (app.rpg.coins += 20) },
      { label: 'Ask about the bandits', next: 'info' },
      { label: 'Later', next: null },
    ],
  },
  info: {
    speaker: 'MERCHANT',
    text: 'Three of them, each carrying a bag of goods. Knock them down, pick up the bags and come back here.',
    choices: [{ label: 'Understood', next: null }],
  },
  accepted: {
    speaker: 'MERCHANT',
    text: 'Remember: left mouse to attack, E to pick up. Do not let them surround you.',
    choices: [{ label: 'Go', next: null }],
  },
  done: {
    speaker: 'MERCHANT',
    text: 'My goods! You really are skilled. Take your reward.',
    choices: [{ label: 'Accept (50 coins)', next: null, action: (app) => (app.rpg.coins += 50) }],
  },
};

const VN_INTRO = {
  start: 'a',
  nodes: {
    a: {
      speaker: 'JOURNAL',
      portrait: 'I',
      expression: 'neutral',
      text: 'There is no law in this borderland. Only the strong, the weak, and bags of goods left behind.',
      next: 'b',
    },
    b: {
      speaker: 'JOURNAL',
      portrait: 'I',
      expression: 'smug',
      text: 'You have a sword, a bag, and three bandits holding the merchant\'s goods.',
      next: 'c',
    },
    c: {
      text: 'Begin?',
      choices: [
        { label: 'Get to work', next: null },
        { label: 'Show controls', next: 'help' },
      ],
    },
    help: {
      speaker: 'JOURNAL',
      text: 'WASD move · left mouse attack · E pick up · I bag · R equip · press E nearby to talk.',
      choices: [{ label: 'Got it', next: null }],
    },
  },
};

export default {
  id: 'rpg',
  title: 'Rise — RPG',

  config: {
    preset: { camera: 'topdown', crosshair: 'none' },
    render: { fog: 0.009, exposure: 1.25 },
    sky: { zenith: '#0b0d14', horizon: '#3a3348', ground: '#0a0a0c', glow: '#ffb9a0', glowStrength: 0.4 },
    lights: { sun: { position: [-20, 24, 18], intensity: 2.8 }, ambient: 0.6 },
    player: { spawn: [0, 0, 6], yaw: 0, speed: 6.2 },
    hud: { hint: { enabled: true, text: 'WASD · LEFT MOUSE attack · E talk/pick up · I bag · R equip' } },
  },

  hud: {
    kicker: 'BORDERLAND — ACT I',
    title: 'RECOVER THE CRATES',
    sub: 'RPG-lite: stats · loot · inventory · dialogue · VN',
  },

  async build(app) {
    app.use(vfxPlugin);
    app.use(combatPlugin);
    app.use(statsPlugin);
    app.use(lootPlugin);
    app.use(inventoryPlugin, { capacity: 8 });
    app.use(dialoguePlugin);
    app.use(vnPlugin);
    app.use(musicPlugin);
    app.use(npcPlugin);

    const rpg = { coins: 0, xp: new Progression({ level: 1 }), stats: new Stats({ str: 12, vit: 10 }), kills: 0 };
    app.rpg = rpg;

    // --- floor + props ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x33302a, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    app.world.setStatic(ground, []);
    app.scene.add(ground);

    for (const [x, z, s] of [[6, -4, 1.4], [-8, -6, 2], [10, 8, 1], [-12, 10, 1.6]]) {
      app.add(box({ size: [s, s, s], position: [x, s / 2, z], color: 0x4a4034, tags: ['prop'], autoCollider: true }));
    }

    app.music.play('calm');

    // --- merchant ---
    const merchant = app.spawnNpc({ path: [[0, 0, -6]], speed: 0, color: 0x8a6a3a, name: 'merchant' });
    app.interaction.add(merchant, {
      label: 'Talk to the merchant',
      range: 3,
      onUse: () => app.dialogue.start(DIALOGUE, rpg.kills >= 3 ? 'done' : 'intro'),
    });

    // --- bandits ---
    const enemies = [];
    for (const [x, z] of [[-14, -12], [15, -10], [2, -18]]) {
      const npc = app.spawnNpc({ path: [[x, 0, z]], speed: 1.1, color: 0x6b2f2a, name: 'bandit' });
      npc.team = 2;
      app.combat.register(npc, { hp: 45, team: 2 });
      enemies.push(npc);
    }

    const playerRef = { pos: app.player.pos, mesh: { position: app.player.pos }, team: 1 };
    app.combat.register(playerRef, { hp: 100, team: 1, bar: false });
    app.playerRef = playerRef;

    app.hud.bind('.obj-s', () => `HP ${Math.round(app.combat.healthOf(playerRef).hp)} · LV ${rpg.xp.level} · XP ${rpg.xp.xp}/${rpg.xp.next} · XU ${rpg.coins}`);

    app.events.on('combat:death', ({ target }) => {
      if (target === playerRef) {
        app.hud.setHint('YOU DIED · reload the page to try again');
        return;
      }
      rpg.kills++;
      const gained = rpg.xp.addXp(60);
      app.hud.setHint(gained ? `LEVEL ${rpg.xp.level}!` : `+60 XP · ${3 - rpg.kills} left`);
      app.loot.spawnAt({ x: target.mesh.position.x, y: 0.5, z: target.mesh.position.z }, { table: 'rogue' });
    });

    // one-time VN intro
    if (!('skip' in app.options)) app.vn.start(VN_INTRO);

    app.events.on('inventory:select', () => {});
  },

  tick(dt, app) {
    if (app.input.justPressed('fire') && app.playerRef) {
      const res = app.combat.strike(app.playerRef, { damage: 18 + app.rpg.stats.get('str') * 0.5, range: 2.8, arc: 0.85, yaw: app.player.yaw });
      if (!res) app.audio.play('ui');
    }
  },
};
