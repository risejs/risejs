import * as THREE from 'three';
import { Rng } from '../../rise/rng.js';
import { generateRooms } from '../../rise/packs/procgen/core.js';
import { NavGrid } from '../../rise/packs/navmesh/index.js';

/**
 * Generates a roguelike level: rooms + corridors from a seed, walls with colliders, and a navmesh.
 *
 *   const { root, colliders, nav, rooms, spawn, exit } = buildRogue({ seed: 'abc', rooms: 7 });
 */
export function buildRogue({ seed = 1, rooms: roomCount = 7, width = 96, height = 96, cell = 2 } = {}) {
  const rng = new Rng(seed);
  const layout = generateRooms(rng, { count: roomCount, width, height, min: 10, max: 20, margin: 3 });
  const root = new THREE.Group();
  root.name = 'rogue';

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const colliders = [];

  const ox = -width / 2;
  const oz = -height / 2;

  for (const r of layout.rooms) {
    const geo = new THREE.BoxGeometry(r.w, 0.4, r.h);
    const mesh = new THREE.Mesh(geo, floorMat);
    mesh.position.set(ox + r.cx, -0.2, oz + r.cy);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // corridors: narrow floor strips
  for (const c of layout.corridors) {
    const dx = c.x2 - c.x1;
    const dz = c.y2 - c.y1;
    const len = Math.abs(dx) + Math.abs(dz);
    if (len < 0.5) continue;
    const w = dx !== 0 ? Math.abs(dx) : 3;
    const h = dz !== 0 ? Math.abs(dz) : 3;
    const geo = new THREE.BoxGeometry(Math.max(3, w), 0.4, Math.max(3, h));
    const mesh = new THREE.Mesh(geo, floorMat);
    mesh.position.set(ox + (c.x1 + c.x2) / 2, -0.2, oz + (c.y1 + c.y2) / 2);
    root.add(mesh);
  }

  // walls around each room (4 sides), with gaps where a corridor connects
  for (const r of layout.rooms) {
    const cx = ox + r.cx;
    const cz = oz + r.cy;
    const edges = [
      { x: cx, z: cz - r.h / 2, w: r.w, d: 0.6 },
      { x: cx, z: cz + r.h / 2, w: r.w, d: 0.6 },
      { x: cx - r.w / 2, z: cz, w: 0.6, d: r.h },
      { x: cx + r.w / 2, z: cz, w: 0.6, d: r.h },
    ];

    for (const e of edges) {
      const geo = new THREE.BoxGeometry(e.w, 3, e.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(e.x, 1.5, e.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      colliders.push(new THREE.Box3().setFromObject(mesh));
    }
  }

  const nav = new NavGrid({
    cell,
    minX: -width / 2 - 4,
    maxX: width / 2 + 4,
    minZ: -height / 2 - 4,
    maxZ: height / 2 + 4,
  });
  for (const box of colliders) nav.blockBox(box);

  const start = layout.rooms[0];
  const end = layout.rooms[layout.rooms.length - 1];
  const spawnPoint = start ? new THREE.Vector3(ox + start.cx, 0, oz + start.cy) : new THREE.Vector3(0, 0, 0);
  const exitPoint = end ? new THREE.Vector3(ox + end.cx, 0, oz + end.cy) : new THREE.Vector3(0, 0, 8);

  return { root, colliders, nav, rooms: layout.rooms, spawn: spawnPoint, exit: exitPoint, layout };
}

/** Loot/enemy spawn points in a room, away from the centre (where the player stands). */
export function spotsInRooms(rooms, rng, { perRoom = 2, centerX = 0, centerZ = 0 } = {}) {
  const out = [];
  for (const r of rooms) {
    for (let i = 0; i < perRoom; i++) {
      const x = r.x + rng.range(1.5, r.w - 1.5);
      const z = r.y + rng.range(1.5, r.h - 1.5);
      out.push({ x: centerX + x - 48, z: centerZ + z - 48, room: r });
    }
  }
  return out;
}
