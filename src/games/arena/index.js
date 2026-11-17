import { buildArena } from './world.js';
import { reactive } from '../../rise/reactive.js';
import { netPlugin } from '../../rise/packs/net/index.js';
import { touchPlugin } from '../../rise/packs/touch/index.js';
import { xrPlugin } from '../../rise/packs/xr/index.js';
import { nameplatePlugin } from '../../rise/packs/nameplate/index.js';
import { chatPlugin } from '../../rise/packs/chat/index.js';
import { a11yPlugin } from '../../rise/packs/a11y/index.js';
import { telemetryPlugin } from '../../rise/packs/telemetry/index.js';
import { lobbyPlugin } from '../../rise/packs/lobby/index.js';

/**
 * Top-down sample game. The config uses presets to stay short:
 * camera and crosshair take one line, everything else uses the defaults.
 */
export default {
  id: 'arena',
  title: 'Rise — Arena',

  config: {
    preset: { camera: 'topdown', crosshair: 'none' },
    render: { fog: 0.011, exposure: 1.3 },
    lights: { sun: { position: [-30, 42, 24], intensity: 3.3 } },
    player: {
      spawn: [0, 0, 6],
      walk: 5.2,
      run: 7.6,
      jump: 4.6,
      crouch: { enabled: false },
    },
    hud: { hint: { enabled: true, text: 'WASD MOVE · V CAMERA · E +10 POINTS · P PAUSE' } },
  },

  hud: {
    kicker: '@arena.kicker',
    title: '@arena.title',
    sub: '@arena.sub',
  },

  locale: 'vi',
  strings: {
    vi: {
      'arena.kicker': 'DEMO TOP-DOWN',
      'arena.title': 'CLEAR THE YARD',
      'arena.sub': 'Same Rise core · different camera · no guns',
    },
    en: {
      'arena.kicker': 'TOP-DOWN DEMO',
      'arena.title': 'CLEAR THE YARD',
      'arena.sub': 'Same Rise core · different camera · no guns',
    },
  },

  async build(app) {
    app.use(a11yPlugin);

    const netUrl = app.options.net;
    const origin = netUrl ? new URL(netUrl).origin : '';
    app.use(telemetryPlugin, { url: `${origin}/api/events` });
    app.use(lobbyPlugin, { url: origin });

    const arena = buildArena();
    app.world.setStatic(arena.root, arena.colliders, arena.surface);
    app.use(touchPlugin);

    // vfx and combat are loaded lazily to keep the game chunk small
    const [{ vfxPlugin }, { combatPlugin }] = await Promise.all([
      import('../../rise/packs/vfx/index.js'),
      import('../../rise/packs/combat/index.js'),
    ]);
    app.use(vfxPlugin);
    app.use(combatPlugin);

    const [{ npcPlugin }, { tweenPlugin }] = await Promise.all([
      import('../../rise/packs/npc/index.js'),
      import('../../rise/packs/tween/index.js'),
    ]);
    app.use(npcPlugin);
    app.use(tweenPlugin);

    if (('xr' in app.options)) {
      app.use(xrPlugin, { mode: app.options.xr === 'ar' ? 'immersive-ar' : 'immersive-vr' });
    }

    // reactive state: the HUD updates itself, no manual setX calls
    const score = reactive({ value: 0, hp: 100 });
    app.score = score;
    app.hud.bind('.obj-s', () => `HP ${score.hp} · SCORE ${score.value}`);

    // --- multiplayer turns on when ?net= is present ---
    if (netUrl) {
      app.use(netPlugin, {
        url: netUrl,
        room: app.options.room || 'arena',
        name: app.options.name || 'player',
        map: 'arena',
        chat: false,
      });
      app.use(nameplatePlugin);
      app.use(chatPlugin);
      const badge = document.createElement('div');
      badge.className = 'stats';
      badge.style.bottom = '44px';
      badge.textContent = 'NET …';
      app.hud.root.appendChild(badge);
      app.netBadge = badge;
      app.events.on('net:hit', (msg) => {
        if (msg.target === app.net.selfNid) score.hp = msg.hp;
      });
      app.events.on('net:wallet', (msg) => {
        const items = msg.wallet?.items || {};
        const total = Object.values(items).reduce((a, b) => a + b, 0);
        badge.textContent = `NET ${app.net.status.toUpperCase()} · ${total} item`;
      });
    }

    // --- NPCs with health: left mouse punches the nearest target ---
    const npcs = [
      { path: [[-20, 0, -20], [20, 0, -20], [20, 0, 20], [-20, 0, 20]], speed: 2.2, pause: 0.4, color: 0x2f4b6b, name: 'runner' },
      { path: [[-16, 0, 16], [-16, 0, 4], [-4, 0, 4]], speed: 1.2, pause: 2, color: 0x6b3a2a, name: 'walker' },
      { path: [[16, 0, -16]], speed: 0, color: 0x4a3b6b, name: 'guard' },
    ];

    for (const spec of npcs) {
      const npc = app.spawnNpc(spec);
      const entry = app.combat.register(npc, { hp: 60, team: 2 });
      npc.team = 2;
      npc.home = npc.mesh.position.clone();
      npc.respawn = spec;
      entry.health.max = 60;

      app.events.on('combat:hit', ({ target }) => {
        if (target === npc) app.audio.play('hit');
      });

      app.events.on('combat:death', ({ target, attacker }) => {
        if (target !== npc) return;
        score.value += 25;
        app.audio.play('ui');

        const spec2 = npc.respawn;
        app.world.remove(npc);
        app.combat.unregister(npc);

        // respawn after 5 s, keeping the same patrol path
        app.tween.to({
          from: 0,
          to: 1,
          duration: 5,
          onDone: () => {
            const again = app.spawnNpc(spec2);
            again.team = 2;
            again.respawn = spec2;
            app.combat.register(again, { hp: 60, team: 2 });
          },
        });
      });
    }
  },

  tick(dt, app) {
    if (app.input.justPressed('interact')) {
      app.score.value += 10;
      app.audio.play('ui');
    }

    // left mouse: punch the nearest target inside the arc in front
    if (!app.combatPlayer && app.player && app.combat) {
      app.combatPlayer = { pos: app.player.pos, mesh: { position: app.player.pos }, team: 1 };
      app.combat.register(app.combatPlayer, { hp: 100, team: 1, bar: false });
    }
    if (app.input.justPressed('fire')) {
      // Online: the server decides hit or miss (ammo, rpm, LOS). Offline: punch locally.
      if (app.net && app.net.status === 'open') app.net.fire('rifle');
      else if (app.combatPlayer) {
        const res = app.combat.strike(app.combatPlayer, { damage: 22, range: 2.8, arc: 0.8, yaw: app.player.yaw });
        if (res) app.score.value += Math.round(res.applied / 2);
        else app.audio.play('ui');
      }
    }

    if (app.input.justPressed('interact') && app.net && app.net.status === 'open') {
      app.net.loot('crate-main');
    }

    if (app.netBadge && app.net) {
      const peers = app.world.query('remote').length;
      const text = `NET ${app.net.status.toUpperCase()} · ${peers} peer`;
      if (app.netBadge.textContent !== text) app.netBadge.textContent = text;
    }
  },
};
