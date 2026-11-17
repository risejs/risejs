import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SurfaceMap, SURFACE } from '../../rise/world/surface.js';
import { Obb } from '../../rise/packs/physics/obb.js';

export const CHUNK = 64;
const GRID = 3; // 3x3 chunk = 192 m
const SEED = 20261114;

/* ---------- shared materials (1 material = 1 draw call per chunk) ---------- */

const MAT = {
  asphalt: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.92, metalness: 0.08 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x4e545c, roughness: 0.82 }),
  concreteAlt: new THREE.MeshStandardMaterial({ color: 0x3e444b, roughness: 0.88 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x140f0a,
    emissive: 0xffb877,
    emissiveIntensity: 0.55,
    roughness: 0.5,
  }),
  metal: new THREE.MeshStandardMaterial({ color: 0x4b525a, roughness: 0.5, metalness: 0.75 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.7, metalness: 0.05 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x1d3220, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x16333d,
    roughness: 0.4,
    metalness: 0.25,
    transparent: true,
    opacity: 0.9,
  }),
  silhouette: new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 1 }),
  far: new THREE.MeshBasicMaterial({ color: 0x343a42, fog: true }),
  // lamp glow: soft gradient texture, additive, 1 draw call per chunk
  pool: new THREE.MeshBasicMaterial({
    map: makeGlowTexture(),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
};

/* ---------- instanced grass ---------- */

const bladeGeo = new THREE.PlaneGeometry(0.06, 0.5);
bladeGeo.translate(0, 0.25, 0);

const bladeMat = new THREE.MeshStandardMaterial({
  color: 0x2c4a28,
  roughness: 1,
  side: THREE.DoubleSide,
});
bladeMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  shader.vertexShader =
    'uniform float uTime;\n' +
    shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float phase = instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.8;
       transformed.x += sin(uTime * 1.7 + phase) * 0.16 * max(0.0, position.y);
       transformed.z += cos(uTime * 1.3 + phase) * 0.08 * max(0.0, position.y);`
    );
  bladeMat.userData.shader = shader;
};

/* ---------- utilities ---------- */

/** Soft radial gradient for the lamp glow (drawn on a canvas, no file needed). */
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,196,130,0.95)');
  g.addColorStop(0.35, 'rgba(255,150,80,0.32)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

function boxGeo(w, h, d, x, y, z, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  _e.set(0, rotY, 0);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

/**
 * Builds the city chunk by chunk. Each chunk:
 *  - merges geometry by material → a few draw calls
 *  - has 2 LOD levels (full / rough massing) plus fog to hide the distance
 *  - has its own Box3 colliders, computed from the geometry data (no mesh scan)
 */
export function buildCity() {
  const root = new THREE.Group();
  const surface = new SurfaceMap();
  const colliders = [];
  const chunks = [];
  const grassMeshes = [];

  // --- surface regions (defined before buildings are placed) ---
  const parks = [
    { cx: -32, cz: 32, w: 30, d: 30 },
    { cx: 96, cz: 32, w: 34, d: 30 },
  ];
  const pond = { cx: 0, cz: -34, r: 12 };
  const plaza = { cx: 14, cz: 16, w: 18, d: 14 };

  for (const p of parks) surface.rect(SURFACE.GRASS, p.cx, p.cz, p.w, p.d);
  for (const p of parks) surface.circle(SURFACE.GRASS, p.cx, p.cz, Math.min(p.w, p.d) / 2);
  surface.circle(SURFACE.WATER, pond.cx, pond.cz, pond.r);
  surface.rect(SURFACE.STONE, plaza.cx, plaza.cz, plaza.w, plaza.d);

  const worldToChunk = (x, z) => [Math.floor((x + CHUNK) / CHUNK), Math.floor((z + CHUNK) / CHUNK)];

  for (let ci = 0; ci < GRID; ci++) {
    for (let cj = 0; cj < GRID; cj++) {
      const ox = (ci - 1) * CHUNK;
      const oz = (cj - 1) * CHUNK;
      const rnd = rng(SEED + ci * 977 + cj * 131);

      const buckets = new Map(); // material -> geometry[]
      const massGeos = []; // building masses only, used for the far LOD
      const add = (geo, mat) => {
        if (!buckets.has(mat)) buckets.set(mat, []);
        buckets.get(mat).push(geo);
      };

      // road base + pavement border
      add(boxGeo(CHUNK, 0.4, CHUNK, 0, -0.2, 0), MAT.asphalt);
      add(boxGeo(CHUNK, 0.5, 3, 0, -0.05, -CHUNK / 2 + 1.5), MAT.sidewalk);
      add(boxGeo(CHUNK, 0.5, 3, 0, -0.05, CHUNK / 2 - 1.5), MAT.sidewalk);
      add(boxGeo(3, 0.5, CHUNK - 6, -CHUNK / 2 + 1.5, -0.05, 0), MAT.sidewalk);
      add(boxGeo(3, 0.5, CHUNK - 6, CHUNK / 2 - 1.5, -0.05, 0), MAT.sidewalk);

      // --- buildings: 4 lots, pick 2 ---
      const lots = [
        [-16, -16],
        [16, -16],
        [-16, 16],
        [16, 16],
      ];
      const picks = rnd() > 0.5 ? [0, 3] : [1, 2];

      for (const li of picks) {
        const [lx, lz] = lots[li];
        const bx = ox + lx;
        const bz = oz + lz;
        const s = surface.at(bx, bz);

        if (s.type !== SURFACE.STREET) {
          // lot falls inside the park / pond / plaza → skip
          continue;
        }

        const w = 14 + rnd() * 8;
        const d = 14 + rnd() * 8;
        const h = 9 + Math.floor(rnd() * 5) * 4;
        const mat = rnd() > 0.5 ? MAT.concrete : MAT.concreteAlt;

        add(boxGeo(w, h, d, lx, h / 2, lz), mat);
        massGeos.push(boxGeo(w, h, d, lx, h / 2, lz));

        // glowing window strips: 1 thin box per face, every 2 floors
        for (let fy = 4; fy < h - 2; fy += 4) {
          add(boxGeo(w * 0.62, 0.8, 0.12, lx, fy, lz + d / 2 + 0.02), MAT.glass);
          add(boxGeo(w * 0.62, 0.8, 0.12, lx, fy, lz - d / 2 - 0.02), MAT.glass);
          add(boxGeo(0.12, 0.8, d * 0.56, lx + w / 2 + 0.02, fy, lz), MAT.glass);
          add(boxGeo(0.12, 0.8, d * 0.56, lx - w / 2 - 0.02, fy, lz), MAT.glass);
        }

        // rooftop utility block
        add(boxGeo(w * 0.3, 2.2, d * 0.3, lx + w * 0.15, h + 1.1, lz - d * 0.15), MAT.metal);

        colliders.push(
          new THREE.Box3(
            new THREE.Vector3(bx - w / 2, 0, bz - d / 2),
            new THREE.Vector3(bx + w / 2, h + 2.4, bz + d / 2)
          )
        );
      }

      // --- lamp posts ---
      for (let i = 0; i < 3; i++) {
        const x = (rnd() - 0.5) * 46;
        const z = (rnd() - 0.5) * 46;
        if (surface.at(ox + x, oz + z).type !== SURFACE.STREET) continue;
        add(boxGeo(0.22, 6.2, 0.22, x, 3.1, z), MAT.metal);
        add(boxGeo(0.6, 0.16, 0.6, x, 6.3, z), MAT.glass);

        const pool = new THREE.PlaneGeometry(9, 9);
        pool.rotateX(-Math.PI / 2);
        pool.translate(x, 0.06, z);
        add(pool, MAT.pool);
      }

      // --- crates / cover blocks ---
      for (let i = 0; i < 2; i++) {
        const x = (rnd() - 0.5) * 44;
        const z = (rnd() - 0.5) * 44;
        if (surface.at(ox + x, oz + z).type !== SURFACE.STREET) continue;
        const w = 1.4 + rnd();
        add(boxGeo(w, 1.2, w * 0.8, x, 0.6, z), MAT.concreteAlt);
        colliders.push(
          new THREE.Box3(
            new THREE.Vector3(ox + x - w / 2, 0, oz + z - (w * 0.8) / 2),
            new THREE.Vector3(ox + x + w / 2, 1.2, oz + z + (w * 0.8) / 2)
          )
        );
      }

      // --- merge by material ---
      const full = new THREE.Group();
      for (const [mat, geos] of buckets) {
        if (!geos.length) continue;
        const merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        full.add(mesh);
      }

      // --- 2 LOD levels: full / massing ---
      // The far level keeps the EXACT building masses (same silhouette) and only drops windows, lamps and crates.
      // The far level used to be one large box covering the chunk, so buildings "vanished" on approach.
      const chunkGroup = new THREE.Group();
      chunkGroup.position.set(ox, 0, oz);
      chunkGroup.name = `chunk-${ci}-${cj}`;

      const fullGroup = new THREE.Group();
      for (const [mat, geos] of buckets) {
        if (!geos.length) continue;
        const merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        fullGroup.add(mesh);
      }

      const massGroup = new THREE.Group();
      massGroup.visible = false;

      const massGround = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK, CHUNK), MAT.asphalt);
      massGround.rotation.x = -Math.PI / 2;
      massGround.position.y = 0.01;
      massGround.receiveShadow = true;
      massGroup.add(massGround);

      if (massGeos.length) {
        const mergedMass = mergeGeometries(massGeos, false);
        massGeos.forEach((g) => g.dispose());
        if (mergedMass) {
          const massMesh = new THREE.Mesh(mergedMass, MAT.concrete);
          massMesh.castShadow = true;
          massMesh.receiveShadow = true;
          massGroup.add(massMesh);
        }
      }

      // LOD3: flat silhouette, no lights or shadows, reuses the massing geometry
      const farGroup = new THREE.Group();
      farGroup.visible = false;
      const massMeshRef = massGroup.children.find((m) => m.isMesh && m.geometry !== massGround.geometry);
      if (massMeshRef) {
        const farMesh = new THREE.Mesh(massMeshRef.geometry, MAT.far);
        farMesh.castShadow = false;
        farMesh.receiveShadow = false;
        farGroup.add(farMesh);
      }

      chunkGroup.add(fullGroup, massGroup, farGroup);
      root.add(chunkGroup);

      chunks.push({
        group: chunkGroup,
        full: fullGroup,
        mass: massGroup,
        far: farGroup,
        fullMeshes: [...fullGroup.children],
        streamed: false,
        ox,
        oz,
        ci,
        cj,
        level: 'full',
      });

      // --- special surfaces in the chunk ---
      for (const p of parks) {
        const [pci, pcj] = worldToChunk(p.cx, p.cz);
        if (pci !== ci || pcj !== cj) continue;
        const lx = p.cx - ox;
        const lz = p.cz - oz;
        const g = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), MAT.grass);
        g.rotation.x = -Math.PI / 2;
        g.position.set(lx, 0.03, lz);
        g.receiveShadow = true;
        chunkGroup.add(g);

        // instanced grass: 1 draw call for the whole lawn
        const count = 7000;
        const inst = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const pos = new THREE.Vector3();
        const scl = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
          const x = (Math.random() - 0.5) * p.w * 0.96;
          const z = (Math.random() - 0.5) * p.d * 0.96;
          pos.set(lx + x, 0.03, lz + z);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
          const k = 0.75 + Math.random() * 0.6;
          scl.set(1, k, 1);
          m.compose(pos, q, scl);
          inst.setMatrixAt(i, m);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = false;
        inst.receiveShadow = false;
        inst.frustumCulled = true;
        chunkGroup.add(inst);
        grassMeshes.push(inst);
      }

      // --- water ---
      const [wci, wcj] = worldToChunk(pond.cx, pond.cz);
      if (wci === ci && wcj === cj) {
        const lx = pond.cx - ox;
        const lz = pond.cz - oz;
        const shore = new THREE.Mesh(new THREE.CircleGeometry(pond.r + 1.6, 40), MAT.stone);
        shore.rotation.x = -Math.PI / 2;
        shore.position.set(lx, 0.02, lz);
        chunkGroup.add(shore);

        const water = new THREE.Mesh(new THREE.CircleGeometry(pond.r, 40), MAT.water);
        water.rotation.x = -Math.PI / 2;
        water.position.set(lx, 0.06, lz);
        chunkGroup.add(water);
      }

      // --- stone plaza ---
      const [sci, scj] = worldToChunk(plaza.cx, plaza.cz);
      if (sci === ci && scj === cj) {
        const stone = new THREE.Mesh(new THREE.PlaneGeometry(plaza.w, plaza.d), MAT.stone);
        stone.rotation.x = -Math.PI / 2;
        stone.position.set(plaza.cx - ox, 0.035, plaza.cz - oz);
        stone.receiveShadow = true;
        chunkGroup.add(stone);
      }
    }
  }

  // Rotated barrier: exercises the OBB in real collision
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 0.5), MAT.steel);
  barrier.position.set(11, 1.1, 7);
  barrier.rotation.y = Math.PI / 5;
  barrier.castShadow = true;
  barrier.receiveShadow = true;
  root.add(barrier);
  colliders.push(new Obb([11, 1.1, 7], [4.5, 1.1, 0.25], Math.PI / 5));

  return {
    root,
    colliders,
    surface,
    chunks,
    stats: {
      chunks: chunks.length,
      colliders: colliders.length,
      grassPerPark: 7000,
      parks: parks.length,
    },
    /** Updates with time and the player position (LOD + grass off in far chunks). */
    update(t, playerPos) {
      if (bladeMat.userData.shader) bladeMat.userData.shader.uniforms.uTime.value = t;

      for (const ch of chunks) {
        const d = rectDistance(playerPos.x, playerPos.z, ch.ox, ch.oz, CHUNK);
        updateChunkLevel(ch, playerPos);
        streamChunk(ch, d);
      }

      for (const inst of grassMeshes) {
        const d = Math.hypot(inst.parent.position.x - playerPos.x, inst.parent.position.z - playerPos.z);
        const on = d < 110;
        if (inst.visible !== on) inst.visible = on;
      }
    },
  };
}

/* ---------- LOD: distance to the chunk rectangle + hysteresis against flicker ---------- */

const LOD_FAR = 96;
const LOD_NEAR = 78;
const FAR_OUT = 200;
const FAR_IN = 170;
const STREAM_OUT = 210;
const STREAM_IN = 170;

/** Releases the full-level geometry when very far away; reloads it on return. */
function streamChunk(ch, dist) {
  if (!ch.streamed && dist > STREAM_OUT) {
    for (const m of ch.fullMeshes) {
      ch.full.remove(m);
      m.geometry.dispose();
    }
    ch.streamed = true;
  } else if (ch.streamed && dist < STREAM_IN) {
    for (const m of ch.fullMeshes) ch.full.add(m);
    ch.streamed = false;
  }
}

function rectDistance(px, pz, ox, oz, size) {
  const dx = Math.max(ox - px, 0, px - (ox + size));
  const dz = Math.max(oz - pz, 0, pz - (oz + size));
  return Math.hypot(dx, dz);
}

function updateChunkLevel(ch, pos) {
  const d = rectDistance(pos.x, pos.z, ch.ox, ch.oz, CHUNK);

  if (ch.level === 'full' && d > LOD_FAR) setLevel(ch, 'mass');
  else if (ch.level === 'mass' && d < LOD_NEAR) setLevel(ch, 'full');
  else if (ch.level === 'mass' && d > FAR_OUT) setLevel(ch, 'far');
  else if (ch.level === 'far' && d < FAR_IN) setLevel(ch, 'mass');
}

function setLevel(ch, level) {
  ch.level = level;
  ch.full.visible = level === 'full';
  ch.mass.visible = level === 'mass';
  ch.far.visible = level === 'far';
}
