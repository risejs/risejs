/**
 * CPU benchmark for the hot paths (no browser needed).
 * Run: node scripts/bench-core.mjs [--json]
 */
import * as THREE from 'three';
import { performance } from 'node:perf_hooks';
import { SpatialHash } from '../src/rise/spatial.js';
import { NpcAgent } from '../src/rise/packs/npc/index.js';
import { NavGrid } from '../src/rise/packs/navmesh/index.js';
import { encodeSnapshot, decodeSnapshot } from '../src/shared/snapshot.js';
import { ByteCache } from '../src/rise/packs/assets/cache.js';
import { packAtlas, validatePages } from '../src/rise/packs/atlas/index.js';
import { hashValue, stableStringify } from '../src/rise/packs/contracts/hash.js';

const rows = [];
function bench(name, fn, { unit = 'ops', repeat = 3 } = {}) {
  // warmup
  fn();
  const times = [];
  let ops = 1;
  for (let i = 0; i < repeat; i++) {
    const t0 = performance.now();
    ops = fn() || 1;
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const ms = times[Math.floor(times.length / 2)];
  rows.push({ name, ms: +ms.toFixed(2), ops, perSec: Math.round((ops / ms) * 1000) });
}

// 1. hash
bench('hashValue (object 6 field)', () => {
  let n = 0;
  for (let i = 0; i < 20000; i++) {
    hashValue({ id: i, x: i * 0.5, z: i * 0.25, yaw: 1.2, hp: 100, tag: 'npc' });
    n++;
  }
  return n;
});

bench('stableStringify (nested)', () => {
  let n = 0;
  for (let i = 0; i < 10000; i++) {
    stableStringify({ b: [1, 2, i], a: { z: i, y: 'x' } });
    n++;
  }
  return n;
});

// 2. spatial hash
bench('SpatialHash: 5k insert + 1k query', () => {
  const hash = new SpatialHash(16);
  const boxes = [];
  for (let i = 0; i < 5000; i++) {
    const x = (i % 100) * 4;
    const z = Math.floor(i / 100) * 4;
    const b = new THREE.Box3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 2, 2, z + 2));
    boxes.push(b);
    hash.insert(b);
  }
  const q = new THREE.Box3();
  const out = [];
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    const x = (i * 7) % 400;
    const z = (i * 13) % 200;
    q.min.set(x, 0, z);
    q.max.set(x + 6, 2, z + 6);
    hash.query(q, out);
    total += out.length;
  }
  return 1000;
});

// 3. NPC (the NPCs are created outside the measured loop)
const agents = [];
for (let i = 0; i < 300; i++) {
  agents.push(new NpcAgent({ path: [[i % 30, 0, i % 20], [(i % 30) + 5, 0, i % 20]], speed: 1.4 }));
}
const player = { pos: new THREE.Vector3(10, 0, 10) };
let npcTick = 0;
bench('NpcAgent: 300 agent × 600 tick', () => {
  for (let t = 0; t < 600; t++) {
    npcTick++;
    player.pos.x = 10 + Math.sin((npcTick + t) * 0.05) * 8;
    for (const a of agents) a.update(1 / 60, { player });
  }
  return agents.length * 600;
});

// 4. navmesh
bench('NavGrid 96×96: 50 path', () => {
  const nav = new NavGrid({ cell: 2, minX: -96, maxX: 96, minZ: -96, maxZ: 96 });
  for (let z = 0; z < nav.rows; z += 3) for (let x = 10; x < 12; x++) nav.block(x, z);
  let n = 0;
  for (let i = 0; i < 50; i++) {
    const path = nav.findPath({ x: -80, z: -80 }, { x: 80, z: 80 });
    n += path.length ? 1 : 0;
  }
  return n;
});

// 5. snapshot
bench('snapshot encode+decode 64 player', () => {
  const players = Array.from({ length: 64 }, (_, i) => ({ nid: i + 1, x: i * 2, z: i * 3, yaw: i * 0.1, seq: i }));
  let n = 0;
  for (let i = 0; i < 1000; i++) {
    const buf = encodeSnapshot({ self: 1, tick: i, players });
    const out = decodeSnapshot(buf);
    n += out.players.length;
  }
  return n;
});

// 6. cache
bench('ByteCache: 10k put + 10k get + clean', () => {
  const c = new ByteCache({ budget: 5 * 1024 * 1024 });
  const payload = new Uint8Array(1024);
  let n = 0;
  for (let i = 0; i < 10000; i++) {
    c.put(`k${i}`, payload, { size: 1024, at: i });
    if (c.get(`k${i}`, i + 1)) n++;
  }
  c.clean(5 * 1024 * 1024);
  return n;
});

// 7. atlas
bench('Atlas: 100 images 64×64', () => {
  const images = Array.from({ length: 100 }, (_, i) => ({ key: `i${i}`, width: 64, height: 64 }));
  const pages = packAtlas(images, { maxSize: 2048, padding: 2 });
  const errors = validatePages(pages);
  if (errors.length) throw new Error(errors[0]);
  return images.length;
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ date: new Date().toISOString(), node: process.version, rows }, null, 2));
} else {
  console.log('\nRise CPU benchmark · Node ' + process.version + '\n');
  console.log('| Case | ms (median) | ops | ops/ms | Notes |');
  console.log('|---|---:|---:|---:|---|');
  for (const r of rows) console.log(`| ${r.name} | ${r.ms ?? '—'} | ${r.ops} | ${r.perSec ?? '—'} | ${r.note || ''} |`);
  const total = rows.reduce((n, r) => n + (r.ms || 0), 0).toFixed(1);
  console.log(`\ntotal: ${total} ms`);
}
