import * as THREE from 'three';

const MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x3a352e, roughness: 0.7, metalness: 0.18 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.55, metalness: 0.65 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.9, metalness: 0.25 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.8, metalness: 0.4 }),
  hot: new THREE.MeshStandardMaterial({
    color: 0x2a0f06,
    emissive: 0xff5a1e,
    emissiveIntensity: 2.4,
    roughness: 0.6,
  }),
};

const solids = [];

/** Adds a box with collision. size=[w,h,d]; pos is the centre of the base. */
function box(parent, mat, size, pos, opts = {}) {
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1] + size[1] / 2, pos[2]);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (opts.collide !== false) solids.push(mesh);
  return mesh;
}

function cylinder(parent, mat, rTop, rBottom, h, pos, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat);
  mesh.position.set(pos[0], pos[1] + h / 2, pos[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  solids.push(mesh);
  return mesh;
}

/**
 * Abandoned foundry: yard, main workshop, 3 silos, pipe rack, service walkway.
 * All geometry is generated in code; no models are loaded.
 */
export function buildFoundry() {
  solids.length = 0;
  const root = new THREE.Group();

  // Yard floor + glowing cracks
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420, 1, 1), MAT.concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const crackMat = new THREE.MeshStandardMaterial({
    color: 0x140a06,
    emissive: 0xff5a1e,
    emissiveIntensity: 1.15,
    roughness: 0.7,
  });
  for (let i = 0; i < 4; i++) {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 2 + Math.random() * 4), crackMat);
    crack.rotation.x = -Math.PI / 2;
    crack.position.set((Math.random() - 0.5) * 46, 0.012, -6 - Math.random() * 26);
    crack.rotation.z = Math.random() * Math.PI;
    root.add(crack);
  }

  // Main workshop: 4 columns + roof, open at both ends so the furnace is visible
  const hall = new THREE.Group();
  hall.position.set(0, 0, -18);
  for (const x of [-12, 12]) {
    for (const z of [-9, 9]) box(hall, MAT.steel, [1.1, 9, 1.1], [x, 0, z]);
  }
  box(hall, MAT.dark, [27, 0.5, 0.7], [0, 8.9, -9], { collide: false });
  for (let z = -6; z <= 9; z += 3) {
    box(hall, MAT.steel, [27, 0.32, 0.42], [0, 8.9, z], { collide: false });
  }
  // side walls, with collision (they used to have collide:false, so you could run through them)
  box(hall, MAT.rust, [0.6, 7, 20], [-13, 0, 0]);
  box(hall, MAT.rust, [0.6, 7, 20], [13, 0, 0]);
  root.add(hall);

  // Blast furnace: a large block + a glowing door
  box(root, MAT.dark, [10, 14, 10], [0, 0, -34]);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.2), MAT.hot);
  door.position.set(0, 3.4, -28.95);
  root.add(door);

  // Round silos
  for (const [x, z, r, h] of [
    [22, -26, 4.2, 17],
    [30, -14, 3.2, 12],
    [-22, -30, 3.8, 14],
  ]) {
    cylinder(root, MAT.steel, r, r, h, [x, 0, z]);
    cylinder(root, MAT.rust, r * 0.32, r * 1.02, 1.1, [x, h, z], 18);
  }

  // Horizontal pipe rack
  const pipeMat = MAT.rust;
  for (const y of [4.2, 5.1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 52, 12), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(-6, y, -12);
    pipe.castShadow = true;
    root.add(pipe);
  }

  // Service walkway with railings
  box(root, MAT.steel, [26, 0.4, 2.2], [0, 6.2, -6]);
  for (let x = -12; x <= 12; x += 3) {
    box(root, MAT.steel, [0.14, 1.1, 0.14], [x, 6.6, -5.1], { collide: false });
  }
  box(root, MAT.steel, [26, 0.12, 0.12], [0, 7.7, -5.1], { collide: false });

  // Scattered drums and crates (cover)
  const rng = mulberry32(20261114);
  for (let i = 0; i < 26; i++) {
    const x = (rng() - 0.5) * 70;
    const z = (rng() - 0.5) * 60 + 6;
    if (Math.abs(x) < 4 && Math.abs(z) < 8) continue;
    // keep the area around the spawn point (4.5, 9) clear so the player is not stuck inside a drum
    if (Math.hypot(x - 4.5, z - 9) < 4) continue;
    if (rng() > 0.55) {
      cylinder(root, rng() > 0.5 ? MAT.rust : MAT.steel, 0.5, 0.5, 1.4, [x, 0, z], 12);
    } else {
      box(root, MAT.dark, [1.6, 1.1 + rng(), 1.2], [x, 0, z]);
    }
  }

  // Lamp posts
  for (const [x, z] of [[-9, 4]]) {
    box(root, MAT.steel, [0.22, 6.4, 0.22], [x, 0, z], { collide: false });
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a120a, emissive: 0xffa04a, emissiveIntensity: 1.9 })
    );
    lamp.position.set(x, 6.5, z);
    root.add(lamp);
    const light = new THREE.PointLight(0xffa04a, 9, 22, 2);
    light.position.set(x, 6.2, z);
    root.add(light);
  }

  // Pipes running overhead: they frame the view and add depth
  for (const [y, r] of [
    [6.6, 0.42],
    [7.5, 0.22],
  ]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 44, 12), MAT.rust);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, y, 3.5);
    pipe.castShadow = true;
    root.add(pipe);
  }
  for (const x of [-14, 0, 14]) {
    box(root, MAT.steel, [0.3, 8, 0.3], [x, 0, 3.5], { collide: false });
  }

  // Barrier around the play area: concrete walls 6 m high and 1 m thick
  const R = 78;
  for (const [sx, sz, w, d] of [
    [0, -R, 2 * R + 2, 1],
    [0, R, 2 * R + 2, 1],
    [-R, 0, 1, 2 * R + 2],
    [R, 0, 1, 2 * R + 2],
  ]) {
    box(root, MAT.concrete, [w, 6, d], [sx, 0, sz]);
  }

  // Compute colliders AFTER the scene tree has world coordinates. Computed while the group is still
  // being built, Box3 uses local coordinates and is off by exactly the group position (walk-through-wall bug).
  root.updateMatrixWorld(true);
  const colliders = solids.map((mesh) => new THREE.Box3().setFromObject(mesh));

  return { root, colliders };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
