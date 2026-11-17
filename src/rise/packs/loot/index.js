import * as THREE from 'three';
import { LootTable, CRATE_LOOT } from './core.js';
export { LootTable, CRATE_LOOT };

const DEFAULT_TABLES = {
  crate: CRATE_LOOT,
  rogue: new LootTable([
    { id: 'ammo', weight: 40, min: 2, max: 8 },
    { id: 'medkit', weight: 25, min: 1, max: 1 },
    { id: 'scrap', weight: 30, min: 1, max: 4 },
    { id: 'core', weight: 5, min: 1, max: 1, chance: 0.5, rarity: 'epic' },
  ]),
};

/**
 * Loot pack: loot tables plus drops on the map, picked up with E.
 *
 *   app.use(lootPlugin);
 *   app.loot.spawnAt({ x, y, z }, { table: 'rogue' });
 *   const drops = app.loot.roll('crate', { luck: 0.1 });
 */
export function lootPlugin(app, { range = 2, tables = {} } = {}) {
  const registry = new Map(Object.entries({ ...DEFAULT_TABLES, ...tables }));
  const drops = [];

  function roll(table, { luck = 0, rolls = 1 } = {}) {
    const t = typeof table === 'string' ? registry.get(table) : table;
    if (!t) return [];
    return t.roll(app.rng, { luck, rolls });
  }

  function spawnAt(pos, { table = 'crate', color = 0xffb347 } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color, emissive: 0x3a2400, emissiveIntensity: 0.8, roughness: 0.6 })
    );
    mesh.position.set(pos.x, pos.y ?? 0.5, pos.z);
    mesh.castShadow = true;
    app.scene.add(mesh);

    const item = { mesh, table, taken: false };
    drops.push(item);
    return item;
  }

  function pickup(item) {
    if (!item || item.taken) return [];
    item.taken = true;
    const result = roll(item.table);
    item.mesh.removeFromParent();
    item.mesh.geometry.dispose();
    item.mesh.material.dispose();

    for (const d of result) {
      app.inventory?.add({ id: d.id, name: d.id, rarity: d.rarity?.id }, d.count);
    }

    app.vfx?.burst(item.mesh.position, { count: 8, speed: 2, color: 0xffd27f });
    app.events.emit('loot:pick', { drops: result, item });
    return result;
  }

  const off = app.events.on('frame', (dt) => {
    const player = app.player;
    for (let i = drops.length - 1; i >= 0; i--) {
      const item = drops[i];
      if (item.taken) {
        drops.splice(i, 1);
        continue;
      }
      item.mesh.rotation.y += dt * 1.6;
      item.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.002 + i) * 0.06;

      if (!player) continue;
      const d = Math.hypot(item.mesh.position.x - player.pos.x, item.mesh.position.z - player.pos.z);
      if (d < range && app.input?.justPressed('interact')) pickup(item);
    }
  });

  const api = {
    roll,
    spawnAt,
    pickup,
    register: (name, table) => registry.set(name, table instanceof LootTable ? table : new LootTable(table)),
    get count() {
      return drops.length;
    },
    drops,
    dispose() {
      off();
      for (const d of drops) {
        d.mesh.removeFromParent();
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
      }
      drops.length = 0;
      if (app.loot === api) app.loot = null;
    },
  };

  app.loot = api;
  return api;
}
