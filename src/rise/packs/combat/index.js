import * as THREE from 'three';
import './combat.css';
import { Health, inMeleeArc, hostile, pickTarget } from './core.js';
import { projectToScreen } from '../../projection.js';
export { Health, inMeleeArc, hostile, pickTarget };

/**
 * Combat pack: health, melee attacks, i-frames, overhead health bars and death.
 *
 *   app.use(combatPlugin);
 *   app.combat.register(npc, { hp: 60, team: 2 });
 *   app.combat.hit(player, npc, { damage: 22 });
 *   const target = app.combat.pick(player, { range: 2.6, yaw: player.yaw });
 */
export function combatPlugin(app, { barHeight = 2.3, iframe = 0.25 } = {}) {
  const entries = new Map();
  const v = new THREE.Vector3();
  const screen = {};

  function makeBar(entity) {
    const el = document.createElement('div');
    el.className = 'hp-bar';
    el.innerHTML = '<i class="hp-fill"></i>';
    app.hud.root.appendChild(el);
    return { el, fill: el.querySelector('.hp-fill') };
  }

  function register(entity, { hp = 100, armor = 0, team = 0, bar = true } = {}) {
    const health = new Health({ hp, armor });
    const entry = { entity, health, team, bar: bar ? makeBar(entity) : null, lastRatio: -1 };
    entries.set(entity, entry);
    return entry;
  }

  function unregister(entity) {
    const e = entries.get(entity);
    if (!e) return;
    e.bar?.el.remove();
    entries.delete(entity);
  }

  function hit(attacker, target, { damage = 10, crit = false, ignoreArmor = false, iframe: hitIframe = iframe } = {}) {
    const e = entries.get(target);
    if (!e) return { applied: 0, blocked: 'no-health' };

    const res = e.health.damage(damage, { ignoreArmor });
    if (res.blocked) return res;

    e.health.setInvulnerable(hitIframe);

    const pos = target.mesh?.position ?? target.pos ?? { x: 0, y: 0, z: 0 };
    app.vfx?.damage(pos, res.applied, { crit });
    if (target.mesh) app.vfx?.hitFlash(target.mesh);
    app.vfx?.burst(pos, { count: crit ? 20 : 10, speed: 2.6, color: crit ? 0xff8a3c : 0xd6452f });

    app.events.emit('combat:hit', { attacker, target, applied: res.applied, crit, health: e.health });
    if (res.dead) {
      app.events.emit('combat:death', { attacker, target });
      e.bar?.el.classList.add('dead');
      if (app.nameplates?.items?.has(target)) {
        const item = app.nameplates.items.get(target);
        app.nameplates.say?.(item, '…', 2);
      }
    }
    return res;
  }

  const api = {
    register,
    unregister,
    hit,
    entries,
    healthOf: (entity) => entries.get(entity)?.health ?? null,
    pick: (attacker, opts) => {
      const list = [...entries.keys()].map((entity) => ({
        entity,
        pos: entity.mesh?.position ?? entity.pos,
        team: entries.get(entity).team,
        dead: entries.get(entity).health.dead,
        ref: entity,
      }));
      const found = pickTarget({ pos: attacker.mesh?.position ?? attacker.pos }, list, opts);
      return found?.ref ?? null;
    },
    /** Strikes the nearest target inside the arc; returns the result or null. */
    strike(attacker, { damage = 10, range = 2.5, arc = 0.7, yaw = null, crit = false } = {}) {
      const source = {
        pos: attacker.mesh?.position ?? attacker.pos,
        team: entries.get(attacker)?.team ?? 0,
        yaw: yaw ?? app.player?.yaw ?? 0,
      };
      const target = api.pick(source, { range, arc, yaw: source.yaw, team: source.team });
      if (!target) return null;
      return { target, ...hit(attacker, target, { damage, crit }) };
    },
  };

  const off = app.events.on('frame', (dt) => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const e of entries.values()) {
      e.health.tick(dt);
      const bar = e.bar;
      if (!bar) continue;

      const mesh = e.entity.mesh;
      if (!mesh || !e.entity.alive) {
        bar.el.style.display = 'none';
        continue;
      }

      if (e.health.ratio !== e.lastRatio) {
        e.lastRatio = e.health.ratio;
        bar.fill.style.width = `${(e.health.ratio * 100).toFixed(0)}%`;
        bar.el.classList.toggle('low', e.health.ratio < 0.3);
      }

      const pos = mesh.position;
      v.set(pos.x, pos.y + barHeight, pos.z);
      projectToScreen(app.camera, v, w, h, screen);
      const dist = app.camera.position.distanceTo(v);
      const show = screen.visible && dist < 45 && !e.health.dead && e.health.ratio < 1;
      bar.el.style.display = show ? 'block' : 'none';
      if (show) bar.el.style.transform = `translate(-50%,-100%) translate(${screen.x}px, ${screen.y}px)`;
    }
  });

  api.dispose = () => {
    off();
    for (const e of entries.values()) e.bar?.el.remove();
    entries.clear();
    if (app.combat === api) app.combat = null;
  };

  app.combat = api;
  return api;
}
