/**
 * Core tests that need no DOM:
 *   node scripts/test-core.mjs
 */
import * as THREE from 'three';
import { reactive, effect, flush } from '../src/rise/reactive.js';
import { zoneKey, neighborKeys, inInterest } from '../src/rise/net/zone.js';
import { resolveConfig } from '../src/rise/config.js';
import { GridMover } from '../src/rise/packs/grid/index.js';
import { SpatialHash } from '../src/rise/spatial.js';
import { Obb } from '../src/rise/packs/physics/obb.js';
import { Heightfield } from '../src/rise/packs/physics/heightfield.js';
import { SideController } from '../src/rise/packs/sideview/index.js';
import { SpriteBatch } from '../src/rise/packs/sprite2d/index.js';
import { atlasUV } from '../src/rise/packs/sprite2d/index.js';
import { SpriteAnimator } from '../src/rise/packs/sprite2d/index.js';
import { Triggers } from '../src/rise/packs/triggers/index.js';
import { Camera2D } from '../src/rise/packs/camera2d/index.js';
import { Timeline, QTE, BranchGraph } from '../src/rise/packs/fmv/core.js';
import { parseChat, RateLimiter } from '../src/rise/packs/chat/core.js';
import { projectToScreen } from '../src/rise/packs/nameplate/projection.js';
import { NpcAgent } from '../src/rise/packs/npc/index.js';
import { readFileSync } from 'node:fs';
import { maskWords, SpamGuard, IgnoreList } from '../src/rise/packs/chat/filter.js';
import { Rng, mulberry32, hashSeed } from '../src/rise/rng.js';
import { Tweens, EASING } from '../src/rise/packs/tween/index.js';
import { Pool, resetParticle, stepParticle, burst } from '../src/rise/packs/vfx/core.js';
import { Health, inMeleeArc, hostile, pickTarget } from '../src/rise/packs/combat/core.js';
import { Stats, Progression, StatusEffects, xpForLevel } from '../src/rise/packs/stats/core.js';
import { LootTable, rarityOf, RARITY, CRATE_LOOT } from '../src/rise/packs/loot/core.js';
import { classify, normalizeList, progressOf } from '../src/rise/packs/assets/core.js';
import { chordFreqs, crossfade, duckGain, moodOf, MOODS } from '../src/rise/packs/music/core.js';
import { Typewriter, paginate, normalizeNode } from '../src/rise/packs/vn/core.js';
import { makeNoise, scatter, generateRooms, autotileMask } from '../src/rise/packs/procgen/core.js';
import { dayCycle, blendWeather } from '../src/rise/packs/weather/core.js';
import { Recorder, Playback, packInput, unpackInput } from '../src/rise/packs/replay/core.js';
import { ok as okResult, fail as failResult, isOk, unwrap, formatDiagnostic, mergeDiagnostics } from '../src/rise/packs/contracts/diagnostics.js';
import { stableStringify, hashValue, shortHash, sha256Hex, fnv1a } from '../src/rise/packs/contracts/hash.js';
import { SaveSlot, migrateData } from '../src/rise/save.js';
import { BakeQueue } from '../src/rise/packs/bakes/core.js';
import { determinant3, classifyTransform, groupInstances, flipIndices, composeAnchor } from '../src/rise/packs/prefabs/instances.js';
import { validateManifest, roleMatches, collidersOf, shapeBounds, lodIndexFor, budgetCheck } from '../src/rise/packs/gltf/manifest.js';
import { ByteCache } from '../src/rise/packs/assets/cache.js';
import { decodeHeightmap, encodeHeightmap, heightfieldFrom, chunkRanges, lodIndexForDistance } from '../src/rise/packs/terrain/heightmap.js';
import { parseSheet, uvFor, clipTimeline } from '../src/rise/packs/sprite2d/sheet.js';
import { packAtlas, composePages, validatePages } from '../src/rise/packs/atlas/index.js';
import { glbInfo, needsMeshopt, needsKtx2, isQuantized, ktx2Plan } from '../src/rise/packs/gltf/loader-info.js';
import { LodGroup } from '../src/rise/packs/prefabs/lod-group.js';
import { edgeWeights, applySurfaceWear } from '../src/rise/packs/surface/index.js';
import { VERSION, API_VERSION, apiInfo, deprecate } from '../src/rise/version.js';
import { hasWebGL2, isTouchDevice, prefersReducedMotion, envInfo } from '../src/rise/env.js';
import { pickMode, featuresFor, detectSupport } from '../src/rise/packs/xr/support.js';
import { clampDamage, clampRange, sanitizeName, sanitizeChat, validRoom, normalizeRoomName, clampPosition, takeToken, safeJsonParse } from '../server/src/security.js';
import { acceptSeq, canHit, timeOk, clockOffset } from '../server/src/session-guard.js';
import { weaponOf, segmentBlocked, resolveShot } from '../src/shared/weapons.js';
import { WeaponState } from '../src/shared/combat.js';
import { ShotPattern } from '../server/src/detection.js';
import { signToken, verifyToken } from '../server/src/auth.js';
import { CollisionMap } from '../src/shared/collision.js';
import { ARENA_MAP, GAME_MAPS } from '../src/games/arena/map.js';
import { Wallet, rollLoot, seededRng, LOOT_TABLE } from '../server/src/economy.js';
import { advance, resolveFixed } from '../src/rise/timestep.js';
import { Tilemap } from '../src/rise/packs/tilemap/index.js';
import { Inventory } from '../src/rise/packs/inventory/data.js';
import { Terrain, terrainLod } from '../src/rise/packs/terrain/index.js';
import { pickPlayback, isHls, canPlayNativeHls } from '../src/rise/packs/fmv/playback.js';
import { summarizeFrames, buildReport, formatReport as formatBench, percentile } from '../src/rise/packs/bench/stats.js';
import { pickRoom, formatRooms } from '../src/rise/packs/lobby/core.js';
import { NavGrid } from '../src/rise/packs/navmesh/index.js';
import { clampInput, acceptMove, validHit, ChatGuard } from '../server/src/ac.js';
import { attachAnimations } from '../src/rise/packs/gltf/index.js';
import { Body, stepBody, Vehicle } from '../src/rise/packs/physics/body.js';
import { TelemetryBuffer, summarize, makeEvent } from '../src/rise/packs/telemetry/core.js';
import { activeCue, parseVtt } from '../src/rise/packs/fmv/core.js';
import { memoryKv } from '../server/src/kv.js';
import { normalizeRoom, roomSummary } from '../server/src/rooms.js';
import { I18n } from '../src/rise/i18n.js';
import { resolveA11y, a11yCss } from '../src/rise/packs/a11y/core.js';
import { collidersFromGltf, mergeBoxes, prefabFromGltf } from '../src/rise/packs/gltf/index.js';
import { SortedSprites, parallaxOffset } from '../src/rise/packs/sprite2d/index.js';
import { QuestLog } from '../src/rise/packs/quest/data.js';
import { encodeSnapshot, decodeSnapshot } from '../src/shared/snapshot.js';
import { validateLevel, normalizeLevel, parseLevel } from '../src/shared/level.js';
import { PrefabRegistry } from '../src/rise/packs/prefabs/index.js';

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log('  ✓', name);
  } else {
    fail++;
    console.log('  ✗', name, extra);
  }
}

console.log('\n[reactive]');
{
  const s = reactive({ hp: 100, ammo: 30 });
  let seen = null;
  effect(() => {
    seen = s.hp;
  });
  ok('effect runs on creation', seen === 100);
  s.hp = 90;
  ok('no change before flush', seen === 100);
  flush();
  ok('flush applies the update', seen === 90);
}

console.log('\n[zone]');
{
  ok('zoneKey 70,130', zoneKey(70, 130) === '1,2');
  ok('neighbor 3x3', neighborKeys(70, 130, 64, 1).length === 9);
  ok('same zone', inInterest(0, 0, 60, 60) === true);
  ok('distant zone differs', inInterest(0, 0, 600, 0) === false);
}

console.log('\n[config preset]');
{
  const cfg = resolveConfig({ preset: { camera: 'topdown', crosshair: 'none' } });
  ok('camera topdown', cfg.player.view.mode === 'topdown');
  ok('crosshair off', cfg.hud.crosshair.enabled === false);
  ok('preset removed', !('preset' in cfg));
}

console.log('\n[grid]');
{
  const app = {
    player: { pos: new THREE.Vector3(0, 0, 6), vel: new THREE.Vector3() },
    world: { colliders: [] },
    events: { emit() {} },
    input: { down: () => false, justPressed: () => false },
    state: { is: () => true },
  };

  const g = new GridMover(app, { cell: 3, min: [-3, -3], max: [3, 3] });
  ok('starts at cell (0,2)', g.cell.i === 0 && g.cell.j === 2, JSON.stringify(g.cell));

  ok('steps up', g.move(0, -1) === true);
  ok('new cell (0,1)', g.cell.i === 0 && g.cell.j === 1);

  for (let k = 0; k < 20; k++) g.update(0.02);
  ok('lerps to the cell centre', Math.abs(app.player.pos.z - 3) < 0.01, app.player.pos.z);

  // blocked by a collider
  app.world.colliders.push(
    new THREE.Box3(new THREE.Vector3(-1.2, 0, -0.6), new THREE.Vector3(1.2, 1.8, 0.6))
  );
  const blocked = g.move(0, -1);
  ok('does not enter an obstacle', blocked === false && g.cell.j === 1);

  ok('out of bounds is rejected', g.moveTo(9, 9) === false && g.cell.j === 1);
}

console.log('\n[spatial hash]');
{
  const hash = new SpatialHash(16);
  const boxes = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  for (let i = 0; i < 3000; i++) {
    const x = (rnd() - 0.5) * 400;
    const z = (rnd() - 0.5) * 400;
    const b = new THREE.Box3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 2, 2, z + 2));
    boxes.push(b);
    hash.insert(b);
  }

  const q = new THREE.Box3(new THREE.Vector3(10, 0, 10), new THREE.Vector3(12, 2, 12));
  const near = hash.query(q);
  const truth = boxes.filter((b) => b.intersectsBox(q));

  ok('query returns few boxes', near.length < 50, near.length);
  ok('no intersecting box is missed', truth.every((b) => near.includes(b)));

  const t0 = performance.now();
  for (let i = 0; i < 500; i++) hash.query(q);
  const tHash = performance.now() - t0;

  const t1 = performance.now();
  for (let i = 0; i < 500; i++) boxes.filter((b) => b.intersectsBox(q));
  const tNaive = performance.now() - t1;

  ok('faster than a full scan', tHash < tNaive, `${tHash.toFixed(1)}ms vs ${tNaive.toFixed(1)}ms`);
  console.log(`    hash ${tHash.toFixed(1)} ms · naive ${tNaive.toFixed(1)} ms (500 query)`);
}

console.log('\n[obb]');
{
  const obb = new Obb([0, 1, 0], [2, 1, 0.5], Math.PI / 4);
  const inside = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 2, 0.5));
  const outside = new THREE.Box3(new THREE.Vector3(5, 0, 5), new THREE.Vector3(6, 2, 6));

  ok('AABB inside OBB', obb.intersectsAabb(inside) === true);
  ok('AABB outside OBB', obb.intersectsAabb(outside) === false);

  const ray = new THREE.Ray(new THREE.Vector3(0, 1, 5), new THREE.Vector3(0, 0, -1));
  const hit = obb.intersectRay(ray);
  ok('ray hits OBB', !!hit && Math.abs(hit.z) < 3, hit ? hit.z.toFixed(2) : 'null');

  const miss = new THREE.Ray(new THREE.Vector3(10, 1, 5), new THREE.Vector3(0, 0, -1));
  ok('ray misses OBB', obb.intersectRay(miss) === null);
}

console.log('\n[heightfield]');
{
  const hf = new Heightfield({ size: 100, res: 10, height: (x, z) => x + 2 * z });
  ok('height at the origin', Math.abs(hf.heightAt(0, 0)) < 1e-6);
  ok('height at a grid point', Math.abs(hf.heightAt(10, 10) - 30) < 1e-6);
  ok('interpolates inside a cell', Math.abs(hf.heightAt(5, 5) - 15) < 1e-3, hf.heightAt(5, 5));
  const n = hf.normalAt(0, 0);
  ok('normal tilts with the slope', Math.abs(n.x) > 0.5 && n.y === 1);
}

console.log('\n[sideview 2.5D]');
{
  const ground = new THREE.Box3(new THREE.Vector3(-50, -2, -4), new THREE.Vector3(50, 0, 4));
  const colliders = [ground];
  const none = { down: () => false };
  const ctrl = new SideController({ spawn: [0, 3] });

  for (let i = 0; i < 180; i++) ctrl.update(1 / 120, none, colliders);
  ok('falls and rests on the floor', ctrl.onGround && Math.abs(ctrl.y) < 0.05, ctrl.y.toFixed(3));

  const jump = { down: (a) => a === 'jump' };
  ctrl.update(1 / 60, jump, colliders);
  for (let i = 0; i < 10; i++) ctrl.update(1 / 60, none, colliders);
  ok('jumps', ctrl.y > 0.5, ctrl.y.toFixed(2));

  for (let i = 0; i < 120; i++) ctrl.update(1 / 60, none, colliders);
  const x0 = ctrl.x;
  const right = { down: (a) => a === 'right' };
  for (let i = 0; i < 60; i++) ctrl.update(1 / 60, right, colliders);
  ok('moves right', ctrl.x > x0 + 1, (ctrl.x - x0).toFixed(2));

  // one-way: jump through from below, stand on top
  const ow = [new THREE.Box3(new THREE.Vector3(-3, 1.7, -2), new THREE.Vector3(3, 1.95, 2))];
  const c2 = new SideController({ spawn: [0, 0.1], jump: 12 });
  const jump2 = { down: (a) => a === 'jump' };
  c2.update(1 / 60, jump2, colliders, ow);
  for (let i = 0; i < 180; i++) c2.update(1 / 60, none, colliders, ow);
  ok('stands on a one-way platform', c2.onGround && Math.abs(c2.y - 1.95) < 0.05, c2.y.toFixed(2));

  // coyote time: can still jump within 0.1 s of leaving the floor
  const c3 = new SideController({ spawn: [0, 0] });
  for (let i = 0; i < 60; i++) c3.update(1 / 60, none, colliders);
  c3.onGround = false;
  c3.sinceGround = 0.05;
  c3.update(1 / 60, jump2, colliders);
  ok('coyote time', c3.vy > 5, c3.vy.toFixed(2));

  // slope: sticks to the slope when walking up
  const slope = [{ x0: 0, x1: 10, y0: 0, y1: 5 }];
  const c4 = new SideController({ spawn: [0, 0] });
  c4.onGround = true;
  for (let i = 0; i < 60; i++) c4.update(1 / 60, right, [], [], slope);
  ok('sticks to the slope', c4.y > 1.5 && c4.y < 4.5, c4.y.toFixed(2));
  ok('still onGround on a slope', c4.onGround === true);

  // moving platform: carries the player
  const pbox = new THREE.Box3(new THREE.Vector3(-2, 1, -2), new THREE.Vector3(2, 1.4, 2));
  const plat = { box: pbox, vx: 2, vy: 0 };
  const c5 = new SideController({ spawn: [0, 1.4] });
  c5.onGround = true;
  const xStart = c5.x;
  for (let i = 0; i < 30; i++) c5.update(1 / 60, none, [pbox], [], [], [plat]);
  ok('platform carries the player', c5.x - xStart > 0.7, (c5.x - xStart).toFixed(2));

  // ladder: climb with W
  const ladderBox = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 6, 1));
  const c6 = new SideController({ spawn: [0, 1] });
  const up = { down: (a) => a === 'forward' };
  for (let i = 0; i < 60; i++) c6.update(1 / 60, up, [], [], [], [], [ladderBox]);
  ok('climbs the ladder', c6.y > 2.5, c6.y.toFixed(2));
  ok('climbing', c6.climbing === true);

  // trigger: enter fires once and does not repeat while inside
  const events = [];
  const trg = new Triggers({ emit: (type) => events.push(type) });
  const zone = new THREE.Box3(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 2, 1));
  trg.add({ id: 'cp', box: zone, once: true });
  const playerBox = new THREE.Box3(new THREE.Vector3(0.2, 0, -0.5), new THREE.Vector3(0.8, 1.7, 0.5));
  trg.update(playerBox);
  trg.update(playerBox);
  ok('enter fires once', events.filter((t) => t === 'trigger:enter').length === 1);

  playerBox.translate(new THREE.Vector3(10, 0, 0));
  trg.update(playerBox);
  playerBox.translate(new THREE.Vector3(-10, 0, 0));
  trg.update(playerBox);
  ok('once does not fire again', events.filter((t) => t === 'trigger:enter').length === 1);
}

console.log('\n[inventory]');
{
  const inv = new Inventory(2);
  ok('add ×2', inv.add({ id: 'ammo', name: 'Ammo' }, 2) === true);
  ok('stacks', inv.add({ id: 'ammo' }, 1) === true && inv.count('ammo') === 3);
  ok('adds a new item', inv.add({ id: 'med', name: 'Medkit' }) === true);
  ok('rejects when full', inv.add({ id: 'key' }) === false);
  ok('remove works', inv.remove('ammo', 2) === true && inv.count('ammo') === 1);
  ok('rejects removing more than held', inv.remove('ammo', 5) === false);
  ok('entries are correct', inv.entries().length === 2);
}

console.log('\n[quest]');
{
  const types = [];
  const events = { emit: (t) => types.push(t) };
  const log = new QuestLog(events);
  const q = log.add({ id: 'supply', title: 'Supply run', steps: [{ id: 'a', text: 'A', need: 1 }, { id: 'b', text: 'B', need: 2 }] });

  log.progress('supply', 'a', 1);
  ok('step 1 done, quest not complete', q.done === false && q.steps[0].count === 1);

  log.progress('supply', 'b', 5);
  ok('clamps to need', q.steps[1].count === 2);
  ok('quest complete', q.done === true);
  ok('emits the complete event', types.includes('quest:complete'));
  ok('progress after completion is ignored', (log.progress('supply', 'b', 1), q.steps[1].count === 2));
}

console.log('\n[signed save]');
{
  const mem = new Map();
  const adapter = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  const slot = new SaveSlot({ gameId: 'test', adapter });

  await slot.write({ score: 5, level: 2 });
  const r1 = await slot.read();
  ok('reads back correctly', r1.data.score === 5 && r1.tampered === false);

  const key = 'rise.save.v1.test';
  const env = JSON.parse(adapter.getItem(key));
  env.data.score = 999;
  adapter.setItem(key, JSON.stringify(env));

  const r2 = await slot.read();
  ok('detects an edited save', r2.tampered === true && r2.reason === 'signature');
}

console.log('\n[binary snapshot]');
{
  const buf = encodeSnapshot({
    self: 3,
    tick: 77,
    players: [
      { nid: 1, x: 1.25, y: 0, z: -3.5, yaw: Math.PI / 2, seq: 9 },
      { nid: 2, x: -8.1, y: 0, z: 12.34, yaw: 0, seq: 10 },
    ],
  });

  const d = decodeSnapshot(buf);
  ok('header is correct', d.self === 3 && d.tick === 77 && d.players.length === 2);
  ok('11 bytes per player', buf.byteLength === 7 + 2 * 11, `${buf.byteLength} byte`);
  ok('coordinates rounded to 1 cm', Math.abs(d.players[0].x - 1.25) < 0.011 && Math.abs(d.players[1].z - 12.34) < 0.011);
  ok('seq preserved', d.players[0].seq === 9);
  ok('yaw approximately equal', Math.abs(d.players[0].yaw - Math.PI / 2) < 0.03, d.players[0].yaw.toFixed(3));

  const big = encodeSnapshot({ self: 1, tick: 0, players: [{ nid: 1, x: 1000, y: 0, z: 0, yaw: 0, seq: 0 }] });
  ok('clamps large coordinates', decodeSnapshot(big).players[0].x <= 327.67);
}

console.log('\n[sprite2d]');
{
  const b = new SpriteBatch({ capacity: 3 });
  ok('adds 2 sprites', b.add({ x: 0, y: 0 }) === 0 && b.add({ x: 2, y: 0 }) === 1);
  ok('mesh.count in sync', b.mesh.count === 2 && b.count === 2);

  b.remove(0);
  ok('remove swap-last', b.count === 1 && b.mesh.count === 1);

  const m = new THREE.Matrix4();
  b.mesh.getMatrixAt(0, m);
  ok('remaining sprite keeps its position', Math.abs(m.elements[12] - 2) < 1e-6, m.elements[12]);

  b.clear();
  ok('clear', b.count === 0 && b.mesh.count === 0);

  const full = new SpriteBatch({ capacity: 1 });
  full.add({ x: 0, y: 0 });
  ok('returns -1 when full', full.add({ x: 1, y: 1 }) === -1);

  const r0 = atlasUV(0, 4, 4);
  const r5 = atlasUV(5, 4, 4);
  ok('atlasUV bottom-left corner', r0[0] === 0 && r0[1] === 0.75 && r0[2] === 0.25 && r0[3] === 1);
  ok('atlasUV index 5', r5[0] === 0.25 && r5[1] === 0.5 && r5[2] === 0.5 && r5[3] === 0.75);

  const ab = new SpriteBatch({ capacity: 2 });
  ab.add({ x: 0, y: 0 });
  ok('default uv', ab.uvAttr.array[0] === 0 && ab.uvAttr.array[2] === 1);
  ab.add({ x: 1, y: 1, uv: [0.5, 0, 0.75, 0.25] });
  ok('uv per instance', ab.uvAttr.array[4] === 0.5 && ab.uvAttr.array[7] === 0.25);

  const frames = [0, 1, 2, 3].map((i) => atlasUV(i, 4, 1));
  const anim = new SpriteAnimator({ frames, fps: 4 });
  ok('first frame', anim.index === 0 && anim.uv[0] === 0);
  anim.update(0.3);
  ok('advances to frame 1', anim.index === 1, anim.index);
  anim.update(0.3);
  ok('advances to frame 2', anim.index === 2, anim.index);
  anim.update(0.6);
  ok('loop wraps to 0', anim.index === 0, anim.index);

  const once = new SpriteAnimator({ frames, fps: 4, loop: false });
  once.update(10);
  ok('no loop clamps at the end', once.index === 3);
}

console.log('\n[level v1]');
{
  const good = { version: 1, game: 'city', spawn: [0, 0, 10], entities: [{ prefab: 'box', pos: [1, 0.5, 2] }] };
  ok('valid level', validateLevel(good).ok === true);
  ok('wrong version', validateLevel({ ...good, version: 2 }).ok === false);
  ok('missing spawn', validateLevel({ ...good, spawn: null }).ok === false);
  ok('entity with a bad pos', validateLevel({ ...good, entities: [{ prefab: 'box', pos: [0] }] }).ok === false);
  ok('inverted bounds', validateLevel({ ...good, bounds: { min: [1, 0, 0], max: [0, 1, 1] } }).ok === false);

  const parsed = parseLevel(JSON.stringify(good));
  ok('parse + normalize', parsed.ok === true && parsed.level.entities[0].size[0] === 1);
  ok('broken JSON is rejected', parseLevel('{oops').ok === false);

  const norm = normalizeLevel({ game: 'x', spawn: [0, 0, 0] });
  ok('default bounds', Array.isArray(norm.bounds.min) && norm.entities.length === 0);
}

console.log('\n[tilemap]');
{
  const data = [
    [0, 0, 0, 0],
    [-1, -1, -1, -1],
    [1, 0, 1, 0],
  ];
  const map = new Tilemap({ texture: null, cols: 4, rows: 4, tile: 1, data, solids: [0, 1] });
  const built = map.build({ chunk: 2 });

  ok('colliders merged per row', built.colliders.length === 2, built.colliders.length);
  ok('first-row collider is 4 wide', built.colliders[0].max.x - built.colliders[0].min.x === 4);
  ok('last row merges 4 cells', built.colliders[1].max.x - built.colliders[1].min.x === 4);
  ok('has per-chunk batches', built.batches.length > 0);

  const total = built.batches.reduce((n, b) => n + b.batch.count, 0);
  ok('tile count is complete', total === 8, total);

  built.update(0, 1);
  const visibleNear = built.batches.filter((b) => b.batch.mesh.visible).length;
  built.update(100, 1);
  const visibleFar = built.batches.filter((b) => b.batch.mesh.visible).length;
  ok('far camera hides chunks', visibleNear > 0 && visibleFar < visibleNear);
}

console.log('\n[prefab registry]');
{
  const reg = new PrefabRegistry();
  reg.register('crate', (e) => ({ prefab: e.prefab, pos: e.pos }));
  ok('builds with the right builder', reg.build({ prefab: 'crate', pos: [1, 2, 3] }).pos[1] === 2);
  ok('unknown prefab returns null', reg.build({ prefab: 'nope' }) === null);
}

console.log('\n[camera2d]');
{
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  const c2 = new Camera2D(cam, { height: 12, zoom: 1, pixelPerfect: true, ppu: 16 });
  ok('view height 12', Math.abs(cam.top - cam.bottom - 12) < 1e-6);

  c2.setZoom(2);
  ok('zoom 2 → view 6', Math.abs(cam.top - cam.bottom - 6) < 1e-6);

  c2.update(0.016, 0.03);
  const snapped = Math.round(cam.position.x * 16) / 16;
  ok('pixel-perfect snap', Math.abs(cam.position.x - snapped) < 1e-9, cam.position.x);

  c2.shake(1, 0.2);
  c2.update(0.01, 0);
  const shaken = cam.position.x;
  c2.update(0.3, 0);
  ok('shake ends after duration', shaken !== 0 || cam.position.x === 0, shaken);
  ok('back in position after shake', Math.abs(cam.position.x) < 1e-9);
}

console.log('\n[sorting + parallax]');
{
  const batch = new SpriteBatch({ capacity: 4 });
  const sorter = new SortedSprites(batch);
  sorter.add({ x: 0, y: 5, w: 1, h: 1 });
  sorter.add({ x: 0, y: 1, w: 1, h: 1 });
  sorter.add({ x: 0, y: 3, w: 1, h: 1 });

  const sorted = sorter.flush();
  ok('sorted by descending y', sorted.map((s) => s.y).join(',') === '5,3,1');

  const m = new THREE.Matrix4();
  batch.mesh.getMatrixAt(0, m);
  ok('first instance has the large y', Math.abs(m.elements[13] - 5) < 1e-6, m.elements[13]);
  batch.mesh.getMatrixAt(2, m);
  ok('last instance has the small y', Math.abs(m.elements[13] - 1) < 1e-6, m.elements[13]);

  ok('parallax factor 0.5', parallaxOffset(100, 0.5) === 50);
  ok('parallax factor 1 = 0', parallaxOffset(100, 1) === 0);
}

console.log('\n[fmv core]');
{
  const tl = new Timeline([{ t: 1, text: 'a' }, { t: 3, text: 'b' }]);
  ok('before the cue', tl.update(0.5).length === 0);
  ok('cue 1 fires', tl.update(0.6).length === 1);
  ok('does not fire again', tl.update(0.5).length === 0);
  ok('cue 2 fires', tl.update(1.5).length === 1);

  const q = new QTE({ at: 1, window: 0.5, key: 'KeyE' });
  ok('qte idle', q.state === 'idle');
  q.update(1.1);
  ok('qte opens', q.state === 'open');
  ok('correct key hits', q.press('KeyE') === true && q.state === 'hit');

  const q2 = new QTE({ at: 1, window: 0.5, key: 'KeyE' });
  q2.update(2);
  ok('expired misses', q2.state === 'miss');
  ok('wrong key does not hit', q2.press('KeyE') === false);

  const g = new BranchGraph(
    { a: { choices: [{ label: 'x', next: 'b' }] }, b: { text: 'B' } },
    'a'
  );
  ok('starts at a', g.current().choices.length === 1);
  g.choose(0);
  ok('goes to b', g.current().text === 'B');
  ok('go(null) is safe', g.go(null) === null);
}

console.log('\n[chat + nameplate + npc]');
{
  const dm = parseChat('/w an hello there');
  ok('parse DM', dm.channel === 'dm' && dm.to === 'an' && dm.body === 'hello there');
  ok('parse /all', parseChat('/all hi').channel === 'all');
  ok('defaults to zone', parseChat('hi').channel === 'zone');
  ok('empty returns null', parseChat('   ') === null);

  const rl = new RateLimiter({ max: 2, window: 1000 });
  ok('rate 1', rl.try(0) === true);
  ok('rate 2', rl.try(10) === true);
  ok('rate limit blocks', rl.try(20) === false);
  ok('rate window expires', rl.try(1100) === true);

  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.set(0, 0, 0);
  cam.lookAt(0, 0, -1);
  cam.updateMatrixWorld(true);
  const front = projectToScreen(cam, new THREE.Vector3(0, 0, -5), 800, 600);
  const behind = projectToScreen(cam, new THREE.Vector3(0, 0, 5), 800, 600);
  ok('projects to the screen centre', Math.abs(front.x - 400) < 1 && Math.abs(front.y - 300) < 1, `${front.x},${front.y}`);
  ok('point behind the camera is hidden', behind.visible === false);

  const npc = new NpcAgent({ path: [[0, 0, 0], [5, 0, 0]], sight: 10, speed: 2 });
  const near = new THREE.Vector3(2, 0, 0);
  npc.update(0.1, { player: { pos: near } });
  ok('NPC detects → chase', npc.state === 'chase');
  const x0 = npc.mesh.position.x;
  npc.update(0.2, { player: { pos: near } });
  ok('NPC moves toward the player', npc.mesh.position.x > x0, npc.mesh.position.x.toFixed(2));

  npc.update(0.1, { player: { pos: new THREE.Vector3(100, 0, 0) } });
  ok('lost track → return', npc.state === 'return');
  for (let i = 0; i < 12; i++) npc.update(1 / 30, { player: { pos: new THREE.Vector3(100, 0, 0) } });
  ok('back home → patrol', npc.state === 'patrol' && npc.mesh.position.length() < 1.2, `${npc.state} ${npc.mesh.position.length().toFixed(2)}`);
}

console.log('\n[i18n]');
{
  const i18n = new I18n({
    locale: 'vi',
    fallback: 'en',
    strings: {
      vi: { hello: 'Xin chào {name}', onlyVi: 'Chỉ tiếng Việt' },
      en: { hello: 'Hello {name}', onlyEn: 'English only' },
    },
  });
  ok('vi translation', i18n.t('hello', { name: 'An' }) === 'Xin chào An');
  ok('fallback en', i18n.t('onlyEn') === 'English only');
  ok('missing key returns the key', i18n.t('missing.key') === 'missing.key');
  ok('translateDeep @key', i18n.translateDeep({ a: '@onlyVi', b: 'plain' }).a === 'Chỉ tiếng Việt');
  i18n.setLocale('en');
  ok('switches locale', i18n.t('hello', { name: 'An' }) === 'Hello An');
}

console.log('\n[gltf collider]');
{
  const group = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  a.position.set(0, 0.5, 0);
  const b = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  b.position.set(4, 1, 0);
  group.add(a, b);
  group.updateMatrixWorld(true);

  const boxes = collidersFromGltf(group);
  ok('bake 2 mesh', boxes.length === 2, boxes.length);

  const merged = mergeBoxes(boxes);
  ok('merges the right edges', merged.min.x === -0.5 && merged.max.x === 5, `${merged.min.x}..${merged.max.x}`);

  const gltf = { scene: group.clone(true) };
  const build = prefabFromGltf(gltf, { scale: 2 });
  const entity = build({ pos: [3, 0, 0], rotY: 0.5, tags: ['prop'] });
  ok('prefab returns an Entity', !!entity.mesh && entity.tags.has('prop'));
  ok('prefab sets the position', entity.mesh.position.x === 3 && entity.mesh.scale.x === 2);
}

console.log('\n[a11y]');
{
  const d = resolveA11y();
  ok('defaults', d.colorblind === 'none' && d.uiScale === 1 && d.reduceMotion === false);
  ok('clamp scale', resolveA11y({ uiScale: 9 }).uiScale === 1.6);
  ok('unknown colorblind → none', resolveA11y({ colorblind: 'xx' }).colorblind === 'none');
  const css = a11yCss({ colorblind: 'protanopia', reduceMotion: true });
  ok('filter protanopia', css.filter.includes('protanopia'));
  ok('reduce motion', css.reduceMotion === true);
}

console.log('\n[glb asset]');
{
  const buf = readFileSync(new URL('../public/models/crate.glb', import.meta.url));
  ok('magic glTF', buf.toString('ascii', 0, 4) === 'glTF');
  ok('version 2', buf.readUInt32LE(4) === 2);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  ok('1 mesh', json.meshes.length === 1);
  ok('has normals', !!json.meshes[0].primitives[0].attributes.NORMAL);
  ok('12 triangles', json.accessors[2].count === 36);
}

console.log('\n[glb parse — GLTFLoader]');
{
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const buf = readFileSync(new URL('../public/models/crate.glb', import.meta.url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
  let meshes = 0;
  let tris = 0;
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      tris += o.geometry.index ? o.geometry.index.count / 3 : 0;
    }
  });
  ok('GLTFLoader can read it', meshes === 1 && tris === 12, `${meshes} mesh / ${tris} tris`);
  const build = prefabFromGltf(gltf, { scale: 2 });
  const e = build({ pos: [1, 0, 2], rotY: 1 });
  ok('prefab from a real glb', e.mesh.children.length > 0 && e.mesh.scale.x === 2);
}

console.log('\n[chat filter + lobby]');
{
  const masked = maskWords('fuck you, shit happens');
  ok('masks blocked words', !/fuck|shit/i.test(masked), masked);
  ok('keeps other words', maskWords('hello world') === 'hello world');

  const sg = new SpamGuard({ windowMs: 1000, limit: 2 });
  ok('spam 1', sg.accept('hi', 0) === true);
  ok('spam 2', sg.accept('hi', 100) === true);
  ok('spam blocked on the 3rd message', sg.accept('hi', 200) === false);
  ok('window expired', sg.accept('hi', 2000) === true);

  const ig = new IgnoreList(['bob']);
  ok('ignore list has bob', ig.has('bob') && ig.add('an').has('an') && !ig.remove('an').has('an'));

  const rooms = [
    { name: 'arena', players: 3, max: 8 },
    { name: 'foundry', players: 1, max: 8 },
    { name: 'full', players: 8, max: 8 },
  ];
  ok('picks the emptiest room', pickRoom(rooms) === 'foundry');
  ok('skips full rooms', pickRoom(rooms, { prefer: 'full' }) === 'foundry');
  ok('prefers rooms with space', pickRoom(rooms, { prefer: 'arena' }) === 'arena');
  ok('no rooms', pickRoom([{ name: 'x', players: 4, max: 4 }]) === null);
  ok('format rooms', formatRooms({ rooms }).includes('arena 3/8'));
}

console.log('\n[navmesh + anti-cheat]');
{
  const nav = new NavGrid({ cell: 1, minX: 0, maxX: 20, minZ: 0, maxZ: 20 });
  // vertical wall at x=10, z 0..14 → must go around through z>14
  for (let z = 0; z <= 14; z++) nav.block(10, z);

  const path = nav.findPath({ x: 2.5, z: 5.5 }, { x: 17.5, z: 5.5 });
  ok('A* finds a path', path.length > 0, `${path.length} points`);
  ok('path goes around the wall', path.some((p) => p.z > 14.4 || p.z < 14.4) && path.every((p) => !nav.isBlocked(...Object.values(nav.toCell(p.x, p.z)))), `${path.length}`);
  ok('does not cut through blocked cells', path.every((p) => { const c = nav.toCell(p.x, p.z); return !nav.isBlocked(c.cx, c.cz); }));
  ok('same cell → 1 point', nav.findPath({ x: 1.5, z: 1.5 }, { x: 1.6, z: 1.4 }).length === 1);
  ok('blocked target → empty', nav.findPath({ x: 2.5, z: 2.5 }, { x: 10.5, z: 5.5 }).length === 0);

  const wall = { min: { x: 5, z: 5 }, max: { x: 7, z: 7 } };
  const nav2 = new NavGrid({ cell: 1, minX: 0, maxX: 10, minZ: 0, maxZ: 10 });
  nav2.blockBox(wall);
  ok('blockBox blocks the area', nav2.isBlocked(5, 5) && nav2.isBlocked(7, 7) && !nav2.isBlocked(4, 4));

  const c = clampInput({ mx: 3, mz: 4, yaw: 100 });
  ok('clamp input ≤ 1', Math.hypot(c.mx, c.mz).toFixed(3) === '1.000' && c.yaw >= 0 && c.yaw < Math.PI * 2);
  ok('valid move', acceptMove({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.25) === true);
  ok('blocks teleport', acceptMove({ x: 0, z: 0 }, { x: 30, z: 0 }, 0.25) === false);
  ok('blocks speed hack', acceptMove({ x: 0, z: 0 }, { x: 4, z: 0 }, 0.2) === false);
  ok('hit in range and facing', validHit({ from: { x: 0, z: 0 }, to: { x: 0, z: -2 }, yaw: 0, range: 3 }) === true);
  ok('hit from behind → rejected', validHit({ from: { x: 0, z: 0 }, to: { x: 0, z: 2 }, yaw: 0, range: 3 }) === false);
  ok('hit too far → rejected', validHit({ from: { x: 0, z: 0 }, to: { x: 0, z: -9 }, yaw: 0, range: 3 }) === false);

  const cg = new ChatGuard({ max: 2, windowMs: 1000 });
  ok('chat guard 1', cg.accept('a', 0) === true);
  ok('chat guard 2', cg.accept('a', 1) === true);
  ok('chat guard blocks', cg.accept('a', 2) === false);
  ok('chat guard new window', cg.accept('a', 1500) === true);
}

console.log('\n[physics lite + telemetry + fmv cue + kv + rooms]');
{
  const b = new Body({ y: 5, radius: 0.3 });
  for (let i = 0; i < 120; i++) stepBody(b, 1 / 60);
  ok('falls and stops on the ground', Math.abs(b.pos.y - 0.3) < 0.05 && b.onGround, b.pos.y.toFixed(3));

  const b2 = new Body({ y: 3, radius: 0.3, restitution: 0.5 });
  stepBody(b2, 1 / 60);
  for (let i = 0; i < 200 && !b2.onGround; i++) stepBody(b2, 1 / 60);
  ok('bounces then stops', b2.onGround === true);

  const b3 = new Body({ y: 2 });
  stepBody(b3, 0.05, { groundY: () => 1.5 });
  ok('groundY follows the terrain', b3.pos.y >= 1.75, b3.pos.y.toFixed(2));

  const car = new Vehicle({ x: 0, z: 0 });
  for (let i = 0; i < 60; i++) car.update(1 / 60, { throttle: 1 });
  ok('car accelerates', car.speed > 5 && car.pos.z > 1, `${car.speed.toFixed(1)} m/s`);
  const z0 = car.pos.z;
  for (let i = 0; i < 60; i++) car.update(1 / 60, { steer: 1 });
  ok('car steers', Math.abs(car.pos.x) > 0.01 && car.pos.z !== z0, car.pos.x.toFixed(2));
  for (let i = 0; i < 200; i++) car.update(1 / 60, { brake: 1 });
  ok('car brakes to a stop', car.speed === 0);

  const tb = new TelemetryBuffer({ max: 3 });
  tb.push('a', { n: 1 });
  tb.push('b', { n: 2 });
  tb.push('c', {});
  tb.push('d', {});
  ok('buffer keeps max', tb.size === 3 && tb.queue.at(-1).type === 'd');
  const taken = tb.take();
  ok('take drains the queue', taken.length === 3 && tb.size === 0);
  ok('summarize counts', summarize(taken).counts.d === 1);
  ok('makeEvent filters numbers', makeEvent('x', { ok: 1.23456, bad: 'x'.repeat(300) }).ok === 1.23);

  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello\n\n00:00:03.500 --> 00:00:05.000\nGoodbye';
  const cues = parseVtt(vtt);
  ok('parse VTT 2 cue', cues.length === 2 && cues[0].text === 'Hello', cues.length);
  ok('cue at t=2', activeCue(cues, 2)?.text === 'Hello');
  ok('cue at t=4', activeCue(cues, 4)?.text === 'Goodbye');
  ok('no cue', activeCue(cues, 9) === null);

  const kv = memoryKv({ a: '1' });
  await kv.put('b', 2);
  ok('kv get/put', (await kv.get('b')) === '2' && (await kv.get('zz')) === null);
  ok('kv list prefix', (await kv.list({ prefix: 'a' })).length === 1);
  await kv.delete('a');
  ok('kv delete', (await kv.get('a')) === null);

  const room = normalizeRoom({ room: 'arena', players: 3, max: 8 });
  ok('normalizeRoom', room.name === 'arena' && room.players === 3);
  ok('roomSummary', roomSummary([room, normalizeRoom({ room: 'x', players: 1, max: 2 })]).total === 4);
}

console.log('\n[gltf animation mixer]');
{
  const root = new THREE.Group();
  const child = new THREE.Object3D();
  root.add(child);
  const track = new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 5, 0, 0]);
  const clip = new THREE.AnimationClip('move', 1, [track]);
  const anim = attachAnimations({ animations: [clip] }, root);
  ok('creates a mixer', !!anim && anim.names.includes('move'));
  anim.play('move');
  anim.update(0.5);
  ok('mixer runs', root.position.x > 1 && root.position.x < 4, root.position.x.toFixed(2));
  ok('no clip → null', attachAnimations({ animations: [] }, root) === null);
}

console.log('\n[fmv playback + bench]');
{
  ok('detects HLS', isHls('a.m3u8') && isHls('a.m3u8?x=1') && !isHls('a.mp4'));

  const safari = (t) => (String(t).includes('mpegurl') ? 'maybe' : '');
  const chrome = () => '';

  const p1 = pickPlayback('/v/intro.m3u8', safari);
  ok('Safari → native HLS', p1.mode === 'native-hls' && p1.src === '/v/intro.m3u8');

  const p2 = pickPlayback('/v/intro.m3u8', chrome, { mp4: '/v/intro.mp4' });
  ok('Chrome → MP4 fallback', p2.mode === 'fallback-mp4' && p2.src === '/v/intro.mp4');

  ok('no MP4 → unsupported', pickPlayback('/v/intro.m3u8', chrome).mode === 'unsupported');
  ok('direct MP4', pickPlayback('/v/clip.mp4', chrome).mode === 'progressive');
  ok('no source', pickPlayback('', chrome).mode === 'none');
  ok('canPlayType throws → false', canPlayNativeHls(() => { throw new Error('x'); }) === false);

  ok('percentile middle', percentile([1, 2, 3, 4, 5], 50) === 3);
  ok('percentile empty', percentile([], 95) === 0);

  const smooth = Array.from({ length: 120 }, () => 1000 / 60);
  const s1 = summarizeFrames(smooth);
  ok('fps 60', Math.abs(s1.fps - 60) < 0.5 && Math.abs(s1.p50 - 16.7) < 0.2, s1.fps.toFixed(1));
  ok('no jank', s1.jank === 0);

  const mixed = [...Array.from({ length: 90 }, () => 1000 / 120), ...Array.from({ length: 10 }, () => 50)];
  const s2 = summarizeFrames(mixed);
  ok('p95 catches slow frames', s2.p95 >= 50, s2.p95);
  ok('jank ~10%', Math.abs(s2.jank * 100 - 10) < 2, (s2.jank * 100).toFixed(1));
  ok('1% low is worse than p50', s2.worst1 > s2.p50);
  ok('filters negative/NaN', summarizeFrames([16, -1, NaN, 0, 17]).frames === 2);

  const rep = buildReport({
    stats: s1,
    info: { render: { calls: 42, triangles: 12345 }, memory: { geometries: 9, textures: 3 } },
    game: 'city',
    size: { width: 1920, height: 1080 },
    dpr: 2,
  });
  ok('report merges correctly', rep.drawCalls === 42 && rep.triangles === 12345 && rep.width === 1920 && rep.dpr === 2);
  ok('format includes fps', formatBench(rep).includes('fps 60'));
}

console.log('\n[pwa shell]');
{
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  ok('manifest standalone', manifest.display === 'standalone' && manifest.start_url === '/');
  ok('icon 192 + 512', manifest.icons.some((i) => i.sizes === '192x192') && manifest.icons.some((i) => i.sizes === '512x512'));
  ok('has maskable', manifest.icons.some((i) => i.purpose === 'maskable'));

  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
    const buf = readFileSync(new URL(`../public/${f}`, import.meta.url));
    ok(`valid png: ${f}`, buf.readUInt32BE(0) === 0x89504e47);
  }

  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  ok('sw cache version', sw.includes('rise-shell-v2'));
  ok('sw cache icon', sw.includes('/icon-192.png'));
}

console.log('\n[rng + tween + vfx + combat]');
{
  const a = new Rng(42);
  const b = new Rng(42);
  ok('same seed → same sequence', [a.float(), a.float(), a.float()].join() === [b.float(), b.float(), b.float()].join());
  ok('different seed → different sequence', new Rng(1).float() !== new Rng(2).float());
  ok('hashSeed is stable', hashSeed('city') === hashSeed('city') && hashSeed('city') !== hashSeed('arena'));
  ok('mulberry32 within [0,1)', (() => { const r = mulberry32(9); for (let i = 0; i < 200; i++) { const v = r(); if (v < 0 || v >= 1) return false; } return true; })());

  const r = new Rng('test');
  const ints = Array.from({ length: 200 }, () => r.int(1, 6));
  ok('int within range', ints.every((v) => v >= 1 && v <= 6 && Number.isInteger(v)));
  ok('range is correct', (() => { const x = new Rng(3).range(-2, 2); return x >= -2 && x < 2; })());
  ok('pick is from the list', ['a', 'b', 'c'].includes(new Rng(5).pick(['a', 'b', 'c'])));
  ok('pick empty → undefined', new Rng(1).pick([]) === undefined);

  const src = [1, 2, 3, 4, 5];
  const sh = new Rng(7).shuffle(src);
  ok('shuffle keeps the elements', sh.length === 5 && [...sh].sort().join() === '1,2,3,4,5');
  ok('shuffle leaves the source array alone', src.join() === '1,2,3,4,5');
  ok('shuffle is reproducible', new Rng(7).shuffle(src).join() === sh.join());

  const w = new Rng(11);
  let y = 0;
  for (let i = 0; i < 500; i++) if (w.weighted([['x', 1], ['y', 9]]) === 'y') y++;
  ok('weighted leans toward y', y > 400, `${y}/500`);
  ok('weighted all 0 → undefined', new Rng(1).weighted([['a', 0]]) === undefined);
  ok('fork is reproducible', new Rng(5).fork('a').float() === new Rng(5).fork('a').float());

  const t = new Tweens();
  let seen = -1;
  t.add({ from: 0, to: 10, duration: 1, ease: 'linear', onUpdate: (v) => (seen = v) });
  t.update(0.5);
  ok('tween midpoint', Math.abs(seen - 5) < 0.001, seen);
  t.update(0.6);
  ok('tween finishes', seen === 10 && t.size === 0);

  let done = 0;
  const t2 = new Tweens();
  t2.add({ from: 0, to: 1, duration: 0.2, onDone: () => done++ });
  t2.update(0.3);
  ok('onDone called once', done === 1);

  let delayed = -1;
  const t3 = new Tweens();
  t3.add({ from: 0, to: 5, duration: 0.5, delay: 0.3, onUpdate: (v) => (delayed = v) });
  t3.update(0.2);
  ok('delay has not started', delayed === -1);
  t3.update(0.2);
  ok('runs after the delay', delayed > 0 && delayed < 5);

  let repeats = 0;
  const t4 = new Tweens();
  t4.add({ from: 0, to: 1, duration: 0.1, repeat: 2, onDone: () => repeats++ });
  t4.update(0.05);
  t4.update(0.05);
  ok('repeat keeps running', t4.size === 1 && repeats === 0);
  t4.update(0.3);
  ok('repeat done', t4.size === 0 && repeats === 1);

  const item = t4.add({ from: 0, to: 1, duration: 5 });
  t4.cancel(item);
  ok('cancel removes it from the list', t4.size === 0);

  ok('easing start/end', Math.abs(EASING.quadOut(0)) < 1e-9 && Math.abs(EASING.quadOut(1) - 1) < 1e-9);
  ok('cubicInOut midpoint = 0.5', Math.abs(EASING.cubicInOut(0.5) - 0.5) < 1e-9);

  const pool = new Pool(() => ({ v: 1 }), { size: 2 });
  const x1 = pool.acquire();
  const x2 = pool.acquire();
  ok('pool allocates', pool.stats.active === 2 && pool.stats.total === 2);
  const x3 = pool.acquire();
  ok('pool grows by itself', pool.stats.total === 3 && !!x3);
  ok('pool release', pool.release(x1) === true && pool.stats.active === 2 && pool.stats.free === 1);
  ok('release twice → false', pool.release(x1) === false);
  pool.releaseAll();
  ok('releaseAll', pool.stats.active === 0 && pool.stats.free === 3);

  const p = resetParticle({}, { x: 1, y: 2, z: 3, vx: 1, life: 0.5 });
  ok('resetParticle', p.x === 1 && p.alive && p.maxLife === 0.5);
  ok('stepParticle alive', stepParticle(p, 0.2) === true && p.x > 1);
  ok('stepParticle expired', stepParticle(p, 1) === false && p.alive === false);

  const dirs = burst(new Rng(3), 8, { speed: 2 });
  ok('burst count is correct', dirs.length === 8 && dirs.every((d) => Number.isFinite(d.vx) && Number.isFinite(d.vz)));

  const h = new Health({ hp: 100, armor: 5 });
  ok('damage subtracts armour', h.damage(30).applied === 25 && h.hp === 75);
  h.setInvulnerable(0.2);
  ok('i-frames block', h.damage(10).blocked === 'iframe');
  h.tick(0.3);
  ok('i-frames over', h.damage(10).applied === 5);
  ok('heal does not exceed max', h.heal(999) === 30 && h.hp === 100, `${h.hp}`);

  const dead = new Health({ hp: 10 });
  ok('dies at hp≤0', dead.damage(50).dead === true && dead.hp === 0);
  ok('hitting a corpse → blocked', dead.damage(10).blocked === 'dead');
  ok('revive', dead.revive(5).hp === 5 && dead.dead === false);

  const from = { x: 0, z: 0 };
  ok('arc in front', inMeleeArc(from, { x: 0, z: -1.5 }, { range: 2, arc: 0.6, yaw: 0 }) === true);
  ok('behind → miss', inMeleeArc(from, { x: 0, z: 1.5 }, { range: 2, arc: 0.6, yaw: 0 }) === false);
  ok('too far → miss', inMeleeArc(from, { x: 0, z: -5 }, { range: 2, arc: 0.6, yaw: 0 }) === false);
  ok('same spot → hit', inMeleeArc(from, { x: 0, z: 0 }, { range: 2 }) === true);

  ok('hostile to another team', hostile(1, 2) === true && hostile(2, 2) === false && hostile(0, 2) === true);

  const attacker = { pos: { x: 0, z: 0 } };
  const list = [
    { pos: { x: 0, z: -2.5 }, team: 2, dead: false, ref: 'far' },
    { pos: { x: 0, z: -1 }, team: 2, dead: false, ref: 'near' },
    { pos: { x: 0, z: -0.8 }, team: 1, dead: false, ref: 'ally' },
    { pos: { x: 0, z: -0.6 }, team: 2, dead: true, ref: 'corpse' },
  ];
  ok('picks the nearest enemy', pickTarget(attacker, list, { range: 3, arc: 0.8, yaw: 0, team: 1 })?.ref === 'near');
  ok('ignores teammates', pickTarget(attacker, list, { range: 3, arc: 0.8, yaw: 0, team: 1 })?.ref !== 'ally');
  ok('ignores corpses', pickTarget(attacker, list, { range: 3, arc: 0.8, yaw: 0, team: 1 })?.ref !== 'corpse');
}

console.log('\n[stats + loot + vn]');
{
  const s = new Stats({ str: 10, hp: 100 });
  ok('base stats', s.get('str') === 10);
  s.modifier({ stat: 'str', value: 5 });
  ok('modifier add', s.get('str') === 15);
  s.modifier({ stat: 'str', value: 0.5, mode: 'mul' });
  ok('modifier mul after add', s.get('str') === 22.5, s.get('str'));
  ok('cache unchanged on add', s.get('str') === 22.5);
  ok('removeBySource', s.modifier({ stat: 'str', value: 100, source: 'buff' }) && s.removeBySource('buff') === 1);
  ok('all() returns an object', typeof s.all().hp === 'number');

  ok('xpForLevel increases', xpForLevel(2) > xpForLevel(1) && xpForLevel(5) > xpForLevel(4));
  const pr = new Progression({ level: 1, xp: 0 });
  ok('gains 1 level', pr.addXp(xpForLevel(1)) === 1 && pr.level === 2);
  ok('leftover xp is kept', pr.addXp(50) === 0 && pr.xp === 50);
  ok('jumps several levels', pr.addXp(xpForLevel(2) + xpForLevel(3) + 10) === 2 && pr.level === 4, pr.level);

  const se = new StatusEffects();
  se.add({ id: 'burn', duration: 1, dot: 10 });
  const t1 = se.tick(0.5);
  ok('dot over time', Math.abs(t1.damage - 5) < 1e-6, t1.damage);
  ok('not expired yet', t1.expired.length === 0 && se.has('burn'));
  se.add({ id: 'burn', duration: 1, dot: 10 });
  ok('stacks on the same id', se.list.find((e) => e.id === 'burn').stacks === 2);
  const t2 = se.tick(1.1);
  ok('expired', t2.expired.includes('burn') && !se.has('burn'));

  const buff = new StatusEffects();
  buff.add({ id: 'rage', duration: 5, stat: 'str', value: 4 });
  ok('modifiers from buffs', buff.modifiers()[0].stat === 'str' && buff.modifiers()[0].value === 4);
  ok('remove by id', buff.remove('rage') === true && buff.list.length === 0);

  ok('rarity common', rarityOf(0).id === 'common');
  ok('rarity legendary', rarityOf(0.999).id === 'legendary');
  ok('rarity increases', ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(rarityOf(0.4).id) <= ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(rarityOf(0.8).id));

  const table = new LootTable([
    { id: 'ammo', weight: 50, min: 2, max: 5 },
    { id: 'gold', weight: 50, min: 1, max: 3, chance: 0.5 },
  ]);
  const drops = table.roll(new Rng(4), { rolls: 50 });
  ok('roll count', drops.length > 0 && drops.length <= 50);
  ok('drop has the right id + count', drops.every((d) => ['ammo', 'gold'].includes(d.id) && d.count >= 1));
  ok('roll is reproducible', JSON.stringify(table.roll(new Rng(9), { rolls: 10 })) === JSON.stringify(table.roll(new Rng(9), { rolls: 10 })));

  const crate = CRATE_LOOT.roll(new Rng('city'), { rolls: 20 });
  ok('crate table has rarity', crate.every((d) => d.rarity && d.rarity.id));

  const tw = new Typewriter('Hello there', { speed: 10 });
  ok('typewriter starts empty', tw.visible === 0 && !tw.done);
  tw.update(0.25);
  ok('typewriter 2 characters', tw.visible === 2 && tw.render() === 'He', tw.render());
  tw.skip();
  ok('skip finishes', tw.done && tw.render() === 'Hello there');

  const pages = paginate('A'.repeat(600), 220);
  ok('paginates', pages.length >= 3 && pages[0].length <= 220, pages.length);
  ok('short page is unchanged', paginate('short', 100).length === 1);

  const node = normalizeNode({ id: 'n1', speaker: 'GUIDE', expression: 'bad', text: 'hi', choices: undefined });
  ok('normalizeNode', node.expression === 'neutral' && Array.isArray(node.choices) && node.auto > 0);
}

console.log('\n[procgen + weather + replay]');
{
  const noise = makeNoise('city');
  const same = makeNoise('city');
  ok('noise is deterministic', noise.noise2D(3.2, 7.8) === same.noise2D(3.2, 7.8));
  ok('noise within [0,1]', (() => {
    for (let i = 0; i < 50; i++) {
      const v = noise.noise2D(i * 0.37, i * 0.91);
      if (v < 0 || v > 1) return false;
    }
    return true;
  })());
  ok('noise differs with another seed', makeNoise(1).noise2D(1.5, 2.5) !== makeNoise(2).noise2D(1.5, 2.5));
  const f = noise.fbm(2.5, 3.5, { octaves: 3 });
  ok('fbm within [0,1]', f >= 0 && f <= 1, f);

  const pts = scatter(new Rng(5), { count: 12, width: 50, height: 50, minDist: 6 });
  ok('scatter point count ≤ count', pts.length <= 12 && pts.length > 4, pts.length);
  ok('scatter respects the distance', (() => {
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < 6) return false;
    return true;
  })());
  ok('scatter is reproducible', JSON.stringify(scatter(new Rng(5), { count: 5 })) === JSON.stringify(scatter(new Rng(5), { count: 5 })));

  const level = generateRooms(new Rng(9), { count: 6, width: 90, height: 90 });
  ok('has rooms', level.rooms.length > 0 && level.rooms.length <= 6);
  ok('rooms do not overlap', (() => {
    const rs = level.rooms;
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i];
        const b = rs[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) return false;
      }
    return true;
  })());
  ok('rooms are in bounds', level.rooms.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 90 && r.y + r.h <= 90));
  ok('corridors connect the rooms', level.corridors.length === Math.max(0, (level.rooms.length - 1) * 2));

  ok('autotileMask 4 directions', autotileMask({ n: true, e: false, s: true, w: false }) === 5);
  ok('autotileMask empty', autotileMask({}) === 0);

  const noon = dayCycle(0.25);
  ok('noon is brightest', noon.sunIntensity > dayCycle(0.75).sunIntensity);
  ok('night is dark', dayCycle(0.75).ambient < dayCycle(0.25).ambient);
  ok('the cycle wraps', Math.abs(dayCycle(0).sunIntensity - dayCycle(1).sunIntensity) < 1e-6);
  ok('dayCycle has a phase', typeof dayCycle(0.4).phase === 'string');
  ok('blendWeather interpolates', blendWeather({ a: 0, b: 'x' }, { a: 10, b: 'y' }, 0.5).a === 5);

  const rec = new Recorder({ tickMs: 50, seed: 3 });
  rec.record(0, { mx: 1, mz: 0, yaw: 0 });
  rec.record(0.06, { mx: 0, mz: 1, yaw: Math.PI / 2 });
  rec.record(0.12, { mx: -1, mz: 0, yaw: Math.PI });
  ok('recorder 3 frame', rec.frames.length === 3);
  ok('packInput rounds', packInput({ mx: 0.333, mz: -0.5, yaw: Math.PI }) [2] === 180);
  ok('unpackInput reverses it', Math.abs(unpackInput(packInput({ mx: 0.5, mz: -0.25, yaw: 0 })).mz + 0.25) < 1e-9);
  ok('duration', rec.durationMs === 100, rec.durationMs);

  const json = JSON.parse(JSON.stringify(rec.toJSON({ game: 'arena' })));
  const pb = new Playback(json);
  ok('playback frame 0', pb.at(0).mx === 1);
  ok('playback advances', pb.at(60).mz === 1);
  ok('playback end', pb.at(200).mx === -1);
  ok('playback done', pb.done === true);
  const rec2 = Recorder.fromJSON(json);
  ok('fromJSON keeps seed + frames', rec2.seed === 3 && rec2.frames.length === 3);
}

console.log('\n[equipment + autotile + terrain]');
{
  const inv = new Inventory(4);
  inv.add({ id: 'sword', name: 'Sword', stats: { str: 3 } }, 1);
  inv.add({ id: 'armor', name: 'Armor', stats: { def: 4 } }, 1);
  ok('equip requires the item in the bag', inv.equip('nope') === false);
  ok('equip sword', inv.equip('sword', 'weapon') === true);
  ok('equipped map', inv.equipped().weapon === 'sword');
  ok('bonus stacks', inv.bonus().str === 3);
  inv.equip('armor', 'armor');
  ok('bonus from several items', inv.bonus().def === 4 && inv.bonus().str === 3);
  ok('unequip returns the item', inv.unequip('weapon')?.id === 'sword' && !inv.equipped().weapon);
  ok('max stack', (() => { const i2 = new Inventory(2); i2.add({ id: 'x' }, 500); return i2.count('x') === 99; })());
  ok('clear removes equipment', (() => { inv.clear(); return inv.equipment.size === 0 && inv.entries().length === 0; })());

  const data = [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
  ];
  const map = new Tilemap({ cols: 4, rows: 4, tile: 1, data, solids: [1] });
  ok('mask top-left corner', map.neighborMask(1, 0) === 6, map.neighborMask(1, 0)); // e + s = 2 + 4
  ok('mask middle', map.neighborMask(1, 1) === 3, map.neighborMask(1, 1)); // n + e = 1 + 2
  ok('applyAutotile changes the sprite', map.applyAutotile({ family: 1, base: 4 }) === 4);
  ok('variant is within the strip', map.data.flat().filter((v) => v >= 4).every((v) => v <= 19));

  const field = { width: 4, height: 4, heightAt: (x, y) => (x + y) * 0.4 };
  const terrain = new Terrain({ heightfield: field, size: 20, segments: 6 });
  ok('terrain has a mesh + colours', !!terrain.mesh && !!terrain.mesh.geometry.attributes.color);
  ok('terrain heights differ', terrain.bounds.max > terrain.bounds.min, `${terrain.bounds.min}..${terrain.bounds.max}`);
  ok('terrain sample', terrain.sample(0, 0) >= 0);
  ok('terrainLod', terrainLod([16, 32]).length === 2);
  terrain.dispose();
}

console.log('\n[timestep + save migrate]');
{
  const a = advance(0, 1 / 60, 1 / 60, 5);
  ok('1 frame at 60fps → 1 step', a.steps === 1 && Math.abs(a.acc) < 1e-9);

  const b = advance(0, 1 / 30, 1 / 60, 5);
  ok('1 frame at 30fps → 2 steps', b.steps === 2, b.steps);

  const c = advance(0, 0.5, 1 / 60, 5);
  ok('backlog is dropped', c.steps === 5 && c.dropped > 0 && c.acc === 0, `${c.steps}/${c.dropped}`);

  let acc = 0;
  let total = 0;
  for (let i = 0; i < 120; i++) {
    const r = advance(acc, 1 / 60, 1 / 60, 5);
    acc = r.acc;
    total += r.steps;
  }
  ok('120 frames → 120 steps', total === 120, total);

  ok('fixed 0 → variable', advance(0, 0.016, 0, 5).steps === 0);
  ok('resolveFixed 60', Math.abs(resolveFixed(60) - 1 / 60) < 1e-9);
  ok('resolveFixed 0.5 is kept', resolveFixed(0.5) === 0.5);
  ok('resolveFixed garbage → 0', resolveFixed('x') === 0 && resolveFixed(-1) === 0);

  const old = { coins: 5, name: 'an' };
  const to2 = migrateData(old, 1, 2, { 1: (d) => ({ ...d, coins: d.coins * 100 }) });
  ok('migrate 1→2', to2.ok && to2.data.coins === 500 && to2.data.name === 'an');

  const to3 = migrateData(old, 1, 3, {
    1: (d) => ({ ...d, coins: d.coins * 100 }),
    2: (d) => ({ ...d, level: 1 }),
  });
  ok('migrate chain 1→3', to3.ok && to3.version === 3 && to3.data.level === 1 && to3.data.coins === 500);

  const missing = migrateData(old, 1, 3, { 1: (d) => d });
  ok('missing step → clear error', missing.ok === false && missing.reason === 'migrate-missing' && missing.at === 2);
  ok('from = to → unchanged', migrateData(old, 2, 2, {}).data === old);

  // SaveSlot with a memory adapter (Node has webcrypto)
  const store = new Map();
  const adapter = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };

  const v1 = new SaveSlot({ gameId: 'rpg', adapter });
  await v1.write({ coins: 5 });
  const r1 = await v1.read();
  ok('save v1 roundtrip', r1.data.coins === 5 && r1.tampered === false && !r1.migrated);

  const v2 = new SaveSlot({ gameId: 'rpg', adapter, version: 2, migrate: { 1: (d) => ({ ...d, coins: d.coins * 100 }) } });
  const r2 = await v2.read();
  ok('reads an old save → migrates', r2.data.coins === 500 && r2.migrated === true && r2.from === 1);
  ok('migrate does not report tampered', r2.tampered === false);

  await v2.write({ coins: 7 });
  const r3 = await new SaveSlot({ gameId: 'rpg', adapter, version: 1 }).read();
  ok('newer save → reason version-newer', r3.reason === 'version-newer');

  // edit the content → detected
  const env = JSON.parse(store.get('rise.save.v1.rpg'));
  env.data.coins = 999999;
  store.set('rise.save.v1.rpg', JSON.stringify(env));
  const r4 = await v2.read();
  ok('edited save → tampered', r4.tampered === true && r4.reason === 'signature');
}

console.log('\n[assets + music]');
{
  ok('classify texture', classify('a/b.png') === 'texture' && classify('x.jpg?w=2') === 'texture');
  ok('classify audio', classify('hit.ogg') === 'audio');
  ok('classify gltf', classify('crate.glb') === 'gltf');
  ok('classify text', classify('level.json') === 'text');
  ok('unknown classify → binary', classify('blob.bin') === 'binary');

  const list = normalizeList(['a.png', { url: 'b.ogg' }], '/assets/');
  ok('normalizeList base', list[0].url === '/assets/a.png' && list[1].url === '/assets/b.ogg');
  ok('normalizeList type', list[0].type === 'texture' && list[1].type === 'audio');

  ok('progress 0', progressOf(0, 4) === 0);
  ok('progress half', progressOf(2, 4) === 0.5);
  ok('progress complete', progressOf(4, 4) === 1);
  ok('progress empty = 1', progressOf(0, 0) === 1);
  ok('progress by weight', Math.abs(progressOf(1, 3, [6, 1, 1]) - 0.75) < 1e-9, progressOf(1, 3, [6, 1, 1]));

  const c = chordFreqs(110, [0, 12]);
  ok('chord root', Math.abs(c[0] - 110) < 1e-6 && Math.abs(c[1] - 220) < 1e-6);
  ok('seventh chord', Math.abs(chordFreqs(100, [7])[0] - 149.83) < 0.2);

  const [out0, in0] = crossfade(0);
  const [out1, in1] = crossfade(1);
  ok('crossfade start', Math.abs(out0 - 1) < 1e-9 && Math.abs(in0) < 1e-9);
  ok('crossfade end', Math.abs(out1) < 1e-9 && Math.abs(in1 - 1) < 1e-9);
  ok('crossfade equal power', Math.abs(out0 ** 2 + in0 ** 2 - 1) < 1e-9);

  ok('duck on', duckGain(true, 0.35, 1) === 0.35);
  ok('duck off', duckGain(false, 0.35, 1) === 1);
  ok('duck interpolates', duckGain(true, 0.35, 0.5) < 1 && duckGain(true, 0.35, 0.5) > 0.35);

  ok('valid mood', moodOf('tense').root === MOODS.tense.root);
  ok('unknown mood → calm', moodOf('xyz').root === MOODS.calm.root);
  ok('mood has 4 notes', Object.values(MOODS).every((m) => m.notes.length === 4));
}

console.log('\n[diagnostics + hash]');
{
  const r = okResult(42);
  ok('ok/unwrap', isOk(r) && unwrap(r) === 42);
  const e = failResult('asset.missing', 'file not found');
  ok('fail code', e.ok === false && e.code === 'asset.missing');
  ok('unwrap throw', (() => { try { unwrap(e); return false; } catch { return true; } })());
  ok('formats a valid code', formatDiagnostic({ code: 'save.version-newer', message: 'old' }).includes('save.version-newer'));
  ok('formats a garbage code → app.unknown', formatDiagnostic({ code: 'X', message: 'm' }).startsWith('app.unknown'));
  ok('merge drops duplicates', mergeDiagnostics([e, { ...e }, failResult('b.c', 'x')]).length === 2);

  ok('stable key order', stableStringify({ b: 1, a: 2 }) === stableStringify({ a: 2, b: 1 }));
  ok('stable nested', stableStringify({ a: [{ z: 1, y: 2 }] }) === '{"a":[{"y":2,"z":1}]}');
  ok('number with 12 digits', stableStringify({ n: 0.1 + 0.2 }) === stableStringify({ n: 0.3 }));
  ok('drops undefined', stableStringify({ a: undefined, b: 1 }) === '{"b":1}');
  ok('hash is stable', hashValue({ a: 1, b: 2 }) === hashValue({ b: 2, a: 1 }));
  ok('hash differs with the data', hashValue({ a: 1 }) !== hashValue({ a: 2 }));
  ok('known fnv1a value', fnv1a('a') === 0xe40c292c);
  ok('shortHash 8', shortHash('x').length === 8);

  const h = await sha256Hex('abc');
  if (h) ok('sha256 abc', h === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  else ok('sha256 without crypto → skipped', true);
}

console.log('\n[bakes budget]');
{
  let t = 0;
  const now = () => t;
  const q = new BakeQueue({ budgetMs: 8, urgentMs: 12, maxJobs: 3 });
  let committed = null;

  function* work(n) {
    for (let i = 0; i < n; i++) {
      t += 5;
      yield i;
    }
    return 'done';
  }

  q.add({ owner: 'world', work: work(3), commit: (v) => (committed = v) });
  const r1 = q.run(now);
  ok('stops at the budget', r1.units === 2, r1.units);
  ok('not committed yet', committed === null && q.jobs.length === 1);

  t = 0;
  const r2 = q.run(now);
  ok('resumes and commits', r2.done === 1 && committed === 'done' && q.jobs.length === 0);

  t = 0;
  const q2 = new BakeQueue({ budgetMs: 8, urgentMs: 12 });
  q2.add({ work: work(10), urgent: true });
  const ru = q2.run(now);
  ok('urgent uses 12ms', ru.units === 3, ru.units);

  t = 0;
  const q3 = new BakeQueue({ maxJobs: 2 });
  q3.add({ work: work(1) });
  q3.add({ work: work(1) });
  ok('maxJobs limits', q3.add({ work: work(1) }) === null && q3.stats().dropped === 1);

  t = 0;
  const q4 = new BakeQueue();
  q4.add({ id: 'a', owner: 'x', work: work(2) });
  ok('cancel by id', q4.cancel('a') === true && q4.jobs.length === 0);

  t = 0;
  const q5 = new BakeQueue();
  q5.add({ owner: 'a', work: work(2) });
  q5.add({ owner: 'b', work: work(2) });
  const d = q5.drain(now);
  ok('drain finishes all work', d.pending === 0 && d.done === 2, JSON.stringify(d));
}

console.log('\n[instancing + anchor]');
{
  const m = new THREE.Matrix4().makeScale(-1, 1, 1);
  ok('negative det when mirrored', determinant3(m) < 0);
  ok('classify mirror', classifyTransform(m).mirrored === true);
  ok('classify regular', classifyTransform(new THREE.Matrix4()).mirrored === false);

  const items = [
    { id: 'a', matrix: new THREE.Matrix4() },
    { id: 'b', matrix: m },
    { id: 'c', matrix: new THREE.Matrix4().makeScale(0, 0, 0) },
  ];
  const groups = groupInstances(items);
  ok('drops degenerate + 2 batches', groups.length === 2 && groups.every((g) => g.items.length === 1), groups.length);
  ok('flipIndices', flipIndices([0, 1, 2, 3, 4, 5]).join() === '0,2,1,3,5,4');

  const parent = new THREE.Matrix4().makeTranslation(10, 0, 0);
  const anchor = new THREE.Matrix4().makeTranslation(0, 2, 0);
  const child = new THREE.Matrix4().makeTranslation(0, 0, 5);
  const world = composeAnchor(parent, anchor, child);
  const p = new THREE.Vector3().setFromMatrixPosition(world);
  ok('anchor compose', p.x === 10 && p.y === 2 && p.z === 5, `${p.x},${p.y},${p.z}`);
}

console.log('\n[gltf manifest]');
{
  ok('role matches a segment', roleMatches('kit.port.north', 'kit.port') && !roleMatches('rooftop', 'roof'));

  const man = {
    version: 1,
    frame: { units: 'm', forward: '+X', up: '+Y', right: '+Z' },
    budget: { triangles: { LOD0: 1000, LOD1: 300 }, draws: 3 },
    colliders: [
      { role: 'collider.box', shape: { kind: 'box', size: [2, 2, 2] }, transform: { translation: [0, 1, 0] } },
      { role: 'collider.capsule', shape: { kind: 'capsule', radius: 0.5, height: 2 }, transform: {} },
      { role: 'collider.hull', shape: { kind: 'hull', vertices: [-1, 0, -1, 1, 0, -1, 0, 0, 1] }, transform: {} },
    ],
    anchors: [{ name: 'grip', transform: { translation: [0, 1, 0] } }],
    ports: [{ name: 'north' }],
    lod: { screenCoverage: [0.4, 0.12] },
  };

  ok('valid manifest', validateManifest(man).ok === true);
  ok('missing manifest → fail', validateManifest(null).code === 'asset.manifest-missing');
  const bad = JSON.parse(JSON.stringify(man));
  bad.colliders[1].shape.height = 0.5;
  ok('bad capsule → fail', validateManifest(bad).ok === false && validateManifest(bad).code === 'asset.manifest-invalid');

  const cs = collidersOf(man);
  ok('colliders have every role', cs.length === 3 && cs[0].role === 'collider.box');
  const box = shapeBounds(cs[0].shape, cs[0].transform);
  ok('box bounds', box.min[1] === 0 && box.max[1] === 2);
  const cap = shapeBounds(cs[1].shape, cs[1].transform);
  ok('capsule bounds', cap.min[1] === 0 && cap.max[1] === 2 && cap.min[0] === -0.5);
  const hull = shapeBounds(cs[2].shape, cs[2].transform);
  ok('hull bounds', hull.min[0] === -1 && hull.max[2] === 1);

  ok('lod picks 0', lodIndexFor(0.8, [0.4, 0.12]) === 0);
  ok('lod picks 1', lodIndexFor(0.2, [0.4, 0.12]) === 1);
  ok('lod picks 2', lodIndexFor(0.05, [0.4, 0.12]) === 2);

  ok('budget pass', budgetCheck(man.budget, { triangles: { LOD0: 900, LOD1: 200 }, draws: 2 }).status === 'pass');
  ok('budget fail', budgetCheck(man.budget, { triangles: { LOD0: 1200 }, draws: 5 }).status === 'fail');
}

console.log('\n[assets cache]');
{
  const c = new ByteCache({ budget: 100 });
  c.put('a', 'aaaa', { size: 60, at: 0 });
  c.put('b', 'bbbb', { size: 60, at: 1 });
  ok('report total bytes', c.report().totalBytes === 120);

  const dry = c.clean(100, { dryRun: true });
  ok('dryRun deletes nothing', dry.removed.length === 1 && c.size === 2 && dry.remaining === 120);

  const real = c.clean(100);
  ok('clean evicts LRU', real.removed[0] === 'a' && c.size === 1 && c.bytes === 60);

  c.retain('b', true);
  c.put('c', 'cc', { size: 70, at: 2 });
  const keep = c.clean(50);
  ok('retained is not evicted', keep.removed.includes('c') && c.has('b') && keep.budgetMet === false);

  c.put('d', 'dd', { size: 10, at: 3 });
  ok('get touch LRU', c.get('d', 9) === 'dd');
  ok('clear keeps retained', c.clear() === 1 && c.has('b'));
}

console.log('\n[terrain heightmap]');
{
  const heights = new Float32Array([0, 10, 20, 30]);
  const buf = encodeHeightmap(heights, { scale: 0.01 });
  const back = decodeHeightmap(buf, { width: 2, height: 2, scale: 0.01 });
  ok('encode/decode roundtrip', [...back].join() === '0,10,20,30', [...back].join());

  const field = heightfieldFrom({ heights: Float32Array.from([0, 10, 20, 30]), width: 2, height: 2 });
  ok('bilinear midpoint', Math.abs(field.heightAt(0.5, 0.5) - 15) < 1e-6, field.heightAt(0.5, 0.5));
  ok('clamps at the edge', field.heightAt(-5, -5) === 0);
  const n = field.normalAt(0.5, 0.5);
  ok('unit normal', Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-6);

  ok('chunk 2x2', chunkRanges(65, 33, 32).length === 6, chunkRanges(65, 33, 32).length);
  ok('lod by distance', lodIndexForDistance(10) === 0 && lodIndexForDistance(200) === 1 && lodIndexForDistance(400) === 2);
}

console.log('\n[sprite sheet + atlas]');
{
  const sheet = parseSheet(
    {
      frames: [
        { filename: 'a', frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 100 },
        { filename: 'b', frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 100 },
      ],
      meta: { size: { w: 32, h: 16 }, frameTags: [{ name: 'walk', from: 0, to: 1 }] },
    },
    {}
  );
  ok('sheet frames', sheet.frames.length === 2 && sheet.frames[1].x === 16);
  ok('sheet clip fps', sheet.clips[0].name === 'walk' && sheet.clips[0].fps === 10, sheet.clips[0].fps);
  ok('uv flips v', Math.abs(uvFor({ x: 0, y: 0, w: 16, h: 16 }, 32, 16)[1] - 0) < 1e-9 && Math.abs(uvFor({ x: 0, y: 0, w: 16, h: 16 }, 32, 16)[3] - 1) < 1e-9);
  ok('clipTimeline', clipTimeline(sheet, 'walk').length === 2);

  const images = Array.from({ length: 10 }, (_, i) => ({ key: `i${i}`, width: 100, height: 100, rgba: new Uint8Array(100 * 100 * 4).fill(i) }));
  const pages = packAtlas(images, { maxSize: 512, padding: 2 });
  ok('atlas splits into pages', pages.length >= 1 && pages[0].placements.length === 10, pages.length + '/' + pages[0].placements.length);
  ok('atlas has no overlap or overflow', validatePages(pages).length === 0, validatePages(pages)[0]);
  ok('atlas is deterministic', JSON.stringify(packAtlas(images, { maxSize: 512, padding: 2 })) === JSON.stringify(pages));
  const composed = composePages(images, pages);
  ok('compose keeps pixels', composed[0].rgba.length === pages[0].width * pages[0].height * 4);
}

console.log('\n[gltf info + lod + surface + sheet animator]');
{
  const buf = readFileSync(new URL('../public/models/crate.glb', import.meta.url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const info = glbInfo(ab);
  ok('glbInfo reads the crate', info && info.meshes === 1 && info.version === '2.0', JSON.stringify(info));
  ok('crate has no meshopt', needsMeshopt(info) === false);
  ok('detects meshopt', needsMeshopt({ extensionsUsed: ['EXT_meshopt_compression'] }) === true);
  ok('detects ktx2', needsKtx2({ extensionsRequired: ['KHR_texture_basisu'] }) === true);
  ok('detects quantized', isQuantized({ extensionsUsed: ['KHR_mesh_quantization'] }) === true);

  ok('ktx2 not needed → ok', ktx2Plan({ extensionsUsed: [] }).needed === false);
  ok('ktx2 missing transcoder → clear failure', ktx2Plan({ extensionsUsed: ['KHR_texture_basisu'] }).ok === false && ktx2Plan({ extensionsUsed: ['KHR_texture_basisu'] }).reason.includes('transcoderPath'));
  ok('ktx2 missing renderer → clear failure', ktx2Plan({ extensionsUsed: ['KHR_texture_basisu'] }, { transcoderPath: '/basis/' }).reason.includes('renderer'));
  ok('ktx2 complete → ok', ktx2Plan({ extensionsUsed: ['KHR_texture_basisu'] }, { transcoderPath: '/basis/', renderer: {} }).ok === true);

  const lv = [{ object: { visible: true }, minCoverage: 0.6 }, { object: { visible: true }, minCoverage: 0.25 }, { object: { visible: true }, minCoverage: 0.05 }];
  const lod = new LodGroup(lv, { hysteresis: 0 });
  ok('lod 0 when near', lod.apply(0.9) === 0 && lv[0].object.visible && !lv[1].object.visible);
  ok('lod 1 at mid range', lod.apply(0.3) === 1 && !lv[0].object.visible && lv[1].object.visible);
  ok('lod 2 when far', lod.apply(0.01) === 2 && lv[2].object.visible && !lv[1].object.visible);

  const plane = new THREE.PlaneGeometry(1, 1, 2, 2);
  const w = edgeWeights(plane, { thresholdDeg: 35 });
  const pos = plane.attributes.position;
  let center = -1;
  let corner = -1;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getY(i)) < 1e-6) center = i;
    if (pos.getX(i) > 0.49 && pos.getY(i) > 0.49) corner = i;
  }
  ok('edge: face centre = 0', w[center] < 0.01, w[center]);
  ok('edge: open border = 1', w[corner] > 0.99, w[corner]);

  const mat = new THREE.MeshStandardMaterial();
  applySurfaceWear(mat, { strength: 0.8 });
  const fake = { vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <dithering_fragment>' };
  mat.onBeforeCompile(fake);
  ok('wear: vertex attribute', fake.vertexShader.includes('attribute float _edge'));
  ok('wear: fragment uses vEdge', fake.fragmentShader.includes('vEdge') && fake.fragmentShader.includes('0.800'));
  ok('wear: separate cache key', mat.customProgramCacheKey() === 'rise-wear-0.8');

  const sheet2 = parseSheet({
    frames: [
      { filename: 'a', frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 100 },
      { filename: 'b', frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 100 },
    ],
    meta: { size: { w: 32, h: 16 }, frameTags: [{ name: 'walk', from: 0, to: 1 }] },
  });
  const anim = SpriteAnimator.fromSheet(sheet2, 'walk');
  ok('animator from a sheet', anim.frames.length === 2 && anim.fps === 10);
  anim.update(0.15);
  ok('animator runs', anim.index === 1, anim.index);
}

console.log('\n[version + deprecate]');
{
  ok('VERSION semver alpha', /^\d+\.\d+\.\d+-alpha\.\d+$/.test(VERSION), VERSION);
  ok('API_VERSION is a number', Number.isInteger(API_VERSION) && API_VERSION >= 1);
  const info = apiInfo();
  ok('apiInfo matches', info.version === VERSION && info.apiVersion === API_VERSION);

  const warns = [];
  const orig = console.warn;
  console.warn = (m) => warns.push(String(m));
  deprecate('oldThing', 'newThing', { since: '0.1.0-alpha.1' });
  deprecate('oldThing', 'newThing');
  console.warn = orig;
  ok('deprecate warns once', warns.length === 1 && warns[0].includes('oldThing') && warns[0].includes('newThing'), warns.length);
}

console.log('\n[env + xr support + security]');
{
  ok('hasWebGL2 without document', hasWebGL2(null) === false);
  ok('hasWebGL2 context null', hasWebGL2({ createElement: () => ({ getContext: () => null }) }) === false);
  ok('isTouchDevice maxTouchPoints', isTouchDevice({ maxTouchPoints: 3, userAgent: 'x' }) === true);
  ok('isTouchDevice UA mobile', isTouchDevice({ maxTouchPoints: 0, userAgent: 'iPhone' }) === true);
  ok('isTouchDevice desktop', isTouchDevice({ maxTouchPoints: 0, userAgent: 'Windows NT' }) === false);
  ok('reduced motion', prefersReducedMotion({ matchMedia: () => ({ matches: true }) }) === true);
  const info = envInfo({ document: null, navigator: { maxTouchPoints: 0, userAgent: 'Windows', language: 'vi' }, devicePixelRatio: 2 });
  ok('envInfo', info.webgl2 === false && info.touch === false && info.dpr === 2);

  ok('pickMode AR', pickMode({ ar: true, vr: true }) === 'immersive-ar');
  ok('pickMode VR', pickMode({ ar: false, vr: true }) === 'immersive-vr');
  ok('pickMode none available', pickMode({}) === null);
  const f = featuresFor('immersive-ar');
  ok('AR features include hit-test', f.optionalFeatures.includes('hit-test') && f.optionalFeatures.includes('local-floor'));
  const support = await detectSupport({ xr: { isSessionSupported: async (m) => m === 'immersive-vr' } });
  ok('detectSupport', support.hasXR && support.vr && !support.ar);

  ok('clampDamage', clampDamage(9999) === 50 && clampDamage(-5) === 1 && clampDamage('x') === 10);
  ok('clampRange', clampRange(999) === 8 && clampRange(0) === 1);
  ok('sanitizeName strips HTML', !sanitizeName('<img src=x onerror=1>').includes('<'));
  ok('sanitizeName empty → fallback', sanitizeName('   ') === 'player');
  ok('sanitizeChat truncates to 200', sanitizeChat('a'.repeat(500)).length === 200);
  ok('validRoom', validRoom('arena-1') && !validRoom('a/b') && !validRoom(''));
  ok('normalizeRoomName', normalizeRoomName('a/b') === 'lobby' && normalizeRoomName('ok') === 'ok');
  const p = clampPosition(99999, -99999);
  ok('clampPosition', p.x === 4000 && p.z === -4000);
  const bucket = {};
  ok('takeToken first 2', takeToken(bucket, 0, 2) && takeToken(bucket, 10, 2));
  ok('takeToken blocks', takeToken(bucket, 20, 2) === false);
  ok('takeToken new window', takeToken(bucket, 1200, 2) === true);
  ok('safeJsonParse', safeJsonParse('{"a":1}').value.a === 1 && safeJsonParse('{').ok === false);

  const session = {};
  ok('first seq accepted', acceptSeq(session, 5) === true && session.lastSeq === 5);
  ok('repeated seq dropped', acceptSeq(session, 5) === false);
  ok('old seq dropped', acceptSeq(session, 4) === false);
  ok('new seq accepted', acceptSeq(session, 6) === true);
  ok('no seq still accepted', acceptSeq({}, undefined) === true);

  const s2 = {};
  ok('first hit', canHit(s2, 1000, 120) === true);
  ok('hit too soon is blocked', canHit(s2, 1050, 120) === false);
  ok('hit after cooldown', canHit(s2, 1200, 120) === true);

  ok('timeOk inside the window', timeOk(1000, 1200, 5000) === true);
  ok('timeOk far off', timeOk(0, 999999, 5000) === false);
  ok('clockOffset', clockOffset(1000, 1500) === 500);
}

console.log('\n[weapons + combat authority + detection + auth]');
{
  ok('weaponOf default', weaponOf('nope').id === 'rifle' && weaponOf('melee').range === 2.6);

  const wall = { min: { x: 2, z: -1 }, max: { x: 4, z: 1 } };
  ok('segment crosses a wall', segmentBlocked({ x: 0, z: 0 }, { x: 6, z: 0 }, wall) === true);
  ok('segment avoids the wall', segmentBlocked({ x: 0, z: 5 }, { x: 6, z: 5 }, wall) === false);

  const targets = [
    { id: 1, pos: { x: 0, z: -5 } },
    { id: 2, pos: { x: 0, z: -20 } },
    { id: 3, pos: { x: 0, z: 5 } },
    { id: 4, pos: { x: 20, z: 0 } },
  ];
  const shot = resolveShot({ origin: { x: 0, z: 0 }, dir: { x: 0, z: -1 }, targets, weapon: 'rifle' });
  ok('shot hits the nearest', shot.hit && shot.target.id === 1, shot.target?.id);

  const blocked = resolveShot({
    origin: { x: 0, z: 0 },
    dir: { x: 0, z: -1 },
    targets: [{ id: 1, pos: { x: 0, z: -5 } }],
    weapon: 'rifle',
    obstacles: [{ min: { x: -1, z: -3 }, max: { x: 1, z: -1 } }],
  });
  ok('wall blocks the hit', blocked.hit === false && blocked.blocked === true);

  ok('out of range', resolveShot({ origin: { x: 0, z: 0 }, dir: { x: 0, z: -1 }, targets: [{ id: 1, pos: { x: 0, z: -100 } }] }).hit === false);
  ok('behind', resolveShot({ origin: { x: 0, z: 0 }, dir: { x: 0, z: -1 }, targets: [{ id: 1, pos: { x: 0, z: 5 } }] }).hit === false);

  const st = new WeaponState('rifle', 0);
  ok('shot 1 fires', st.fire(0) === true && st.ammo === 29);
  ok('blocks a shot at 50ms', st.fire(50) === false);
  ok('fires again at 100ms', st.fire(100) === true && st.ammo === 28);
  st.ammo = 1;
  st.fire(200);
  ok('out of ammo', st.fire(300) === false && st.ammo === 0);
  ok('reload starts', st.reload(400) === true && st.reloading);
  ok('reload not finished', st.canFire(500) === false);
  st.tick(400 + 1900);
  ok('reload done, magazine full', st.ammo === 30 && st.canFire(400 + 2000) === true);

  const melee = new WeaponState('melee', 0);
  melee.fire(0);
  ok('melee has infinite ammo', melee.ammo === Infinity);

  const macro = new ShotPattern();
  for (let i = 0; i < 15; i++) macro.record({ t: i * 100, hit: i % 2 === 0 });
  ok('macro flag', macro.flags().includes('macro'), macro.stdMs().toFixed(2));

  const human = new ShotPattern();
  [0, 137, 260, 420, 533, 711, 842, 1010, 1188, 1302, 1499, 1620].forEach((t, i) => human.record({ t, hit: i % 3 === 0 }));
  ok('no macro flag', !human.flags().includes('macro'));

  const sniper = new ShotPattern();
  for (let i = 0; i < 25; i++) sniper.record({ t: i * 400, hit: i < 23 });
  ok('accuracy flag', sniper.flags().includes('high-accuracy'));

  const token = await signToken('secret', 'an', { ttlSec: 3600, now: 0 });
  const v = await verifyToken('secret', token, { now: 1000 });
  ok('valid token', v.ok && v.player === 'an' && v.exp > 0);
  ok('expired token', (await verifyToken('secret', token, { now: 4000 * 1000 })).ok === false);
  ok('token with the wrong secret', (await verifyToken('other', token, { now: 1000 })).ok === false);
  const tampered = token.slice(0, -2) + '00';
  ok('token with an edited sig', (await verifyToken('secret', tampered, { now: 1000 })).ok === false);
}

console.log('\n[collision + map + economy]');
{
  const col = new CollisionMap(ARENA_MAP);
  ok('map has collision', col.size >= 10, col.size);
  ok('map registry', GAME_MAPS.arena === ARENA_MAP);

  // border walls stop movement out of the map
  const out = col.resolveMove({ x: 28, z: 0 }, { x: 31, z: 0 }, 0.35);
  ok('border wall blocks', out.blocked && out.x < 30, out);
  ok('centre of the yard is walkable', col.resolveMove({ x: 0, z: 0 }, { x: 2, z: 0 }, 0.35).blocked === false);
  ok('standing inside a pillar is blocked', col.circleBlocked(14, 14, 0.2) === true);

  // crates block bullets but grass does not
  ok('crate blocks bullets', col.segmentBlocked({ x: 0, z: 0 }, { x: -4, z: -9 }) === true);
  ok('clear path does not block', col.segmentBlocked({ x: 0, z: 0 }, { x: 0, z: -9 }) === false);
  ok('grass does not block bullets', col.segmentBlocked({ x: -16, z: 5 }, { x: -16, z: 25 }) === false);

  // seeded rng is deterministic
  const r1 = seededRng(42);
  const r2 = seededRng(42);
  const s1 = [r1(), r1()];
  const s2 = [r2(), r2()];
  ok('rng is deterministic', s1[0] === s2[0] && s1[1] === s2[1] && s1[0] !== s1[1], s1);

  const lootA = rollLoot('crate', 'p1:crate-1');
  const lootB = rollLoot('crate', 'p1:crate-1');
  const lootC = rollLoot('crate', 'p2:crate-1');
  ok('loot with the same seed matches', JSON.stringify(lootA) === JSON.stringify(lootB), lootA);
  ok('loot differs for another player', JSON.stringify(lootA) !== JSON.stringify(lootC) || lootA.length !== lootC.length);
  ok('valid loot', lootA.every((d) => LOOT_TABLE.crate.some((r) => r.id === d.id) && d.qty >= 1));
  ok('unknown loot table is empty', rollLoot('nope', 'x').length === 0);

  const w = new Wallet({ balance: 100 });
  ok('grant adds money', w.apply({ key: 'a', op: 'grant', amount: 50 }).balance === 150);
  ok('grant with a repeated key adds nothing', w.apply({ key: 'a', op: 'grant', amount: 50 }).balance === 150);
  ok('spend subtracts money', w.apply({ key: 'b', op: 'spend', amount: 30 }).balance === 120);
  ok('spend over the balance', w.apply({ key: 'c', op: 'spend', amount: 999 }).ok === false && w.balance === 120);
  ok('negative spend is blocked', w.apply({ key: 'd', op: 'spend', amount: -5 }).ok === false);

  const drops = rollLoot('boss', 'p9:boss-1');
  const before = JSON.stringify([...w.items]);
  const first = w.applyLoot('loot:1', drops);
  const second = w.applyLoot('loot:1', drops);
  ok('loot applied once', first.applied === true && second.duplicate === true);
  ok('loot unchanged the 2nd time', JSON.stringify([...w.items]) !== before && w.itemCount(drops[0].id) === drops[0].qty);
  ok('item spend', w.apply({ key: 'e', op: 'spend', item: drops[0].id, qty: 1 }).ok === true);
  ok('item spend short', w.apply({ key: 'f', op: 'spend', item: 'ghost', qty: 1 }).ok === false);

  const roundTrip = Wallet.fromJSON(w.toJSON());
  ok('wallet serializes', roundTrip.balance === w.balance && roundTrip.itemCount(drops[0].id) === w.itemCount(drops[0].id));

  const bounded = new Wallet({ maxKeys: 3 });
  for (let i = 0; i < 6; i++) bounded.apply({ key: `k${i}`, amount: 1 });
  ok('idempotency key has a limit', bounded.size === 3, bounded.size);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
