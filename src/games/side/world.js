import * as THREE from 'three';

/**
 * 2.5D platformer level: floor, steps, layered background.
 */
export function buildSideLevel() {
  const root = new THREE.Group();
  const colliders = [];

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.95 });
  const platMat = new THREE.MeshStandardMaterial({ color: 0x4e545c, roughness: 0.8 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 1 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });

  const add = (w, h, d, x, y, z, mat, collide = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = collide;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (collide) {
      root.updateMatrixWorld(true);
      colliders.push(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
  };

  // long floor
  add(220, 2, 8, 20, -2, 0, groundMat);

  // steps / platforms
  const platforms = [
    [8, 1, 4, 4, 2],
    [10, 1, 4, 12, 4.2],
    [8, 1, 4, 22, 1.4],
    [6, 1, 4, 30, 3.6],
    [12, 1, 4, 40, 5.4],
    [8, 1, 4, 52, 2.2],
    [10, 1, 4, 62, 4.6],
    [14, 1, 4, 74, 6.6],
  ];
  for (const [w, , d, x, y] of platforms) add(w, 1, d, x, y, 0, platMat);

  // decorative blocks / low obstacles
  add(2, 2, 2, 16, 0, 0, accentMat);
  add(2, 2, 2, 35, 0, 0, accentMat);
  add(2, 2, 2, 70, 0, 0, accentMat);

  // layered background (no collision)
  for (let i = 0; i < 12; i++) {
    const x = -20 + i * 18;
    add(6, 30 + (i % 4) * 10, 2, x, -2, -14, backMat, false);
    add(4, 20 + (i % 3) * 8, 2, x + 8, -2, -26, backMat, false);
  }

  // goal
  const goal = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 6),
    new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  );
  goal.position.set(88, 3, 0);
  root.add(goal);

  // one-way platform: jump through from below, stand on top
  const oneWay = [];
  const owMat = new THREE.MeshStandardMaterial({
    color: 0x5a6b7a,
    roughness: 0.7,
    transparent: true,
    opacity: 0.85,
  });
  for (const [x, y, w] of [
    [18, 2.6, 6],
    [27, 4.6, 5],
    [46, 3.2, 6],
    [58, 5.2, 5],
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 4), owMat);
    mesh.position.set(x, y, 0);
    mesh.receiveShadow = true;
    root.add(mesh);
    root.updateMatrixWorld(true);
    oneWay.push(new THREE.Box3().setFromObject(mesh));
  }

  // slope: height 3 → 5.2 over x 94..102 (no collider; the controller follows it)
  const slopes = [{ x0: 94, x1: 102, y0: 3, y1: 5.2 }];
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.35, 4), platMat);
  ramp.position.set(98, 4.1, 0);
  ramp.rotation.z = Math.atan2(2.2, 8);
  ramp.receiveShadow = true;
  root.add(ramp);

  // moving platform (up and down)
  const movingMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 3), platMat);
  movingMesh.position.set(84, 4, 0);
  movingMesh.castShadow = true;
  movingMesh.receiveShadow = true;
  root.add(movingMesh);
  root.updateMatrixWorld(true);
  const movingBox = new THREE.Box3().setFromObject(movingMesh);
  const movingPlatforms = [{ mesh: movingMesh, box: movingBox, baseY: 4, amp: 1.2, speed: 1.1, vx: 0, vy: 0 }];

  // ladder (x=64, from the ground up to the platform at y=8)
  const ladderMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8 });
  const ladderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.2, 0.4), ladderMat);
  ladderMesh.position.set(64, 5.4, 0);
  root.add(ladderMesh);
  const ladders = [new THREE.Box3(new THREE.Vector3(63.4, 3, -0.5), new THREE.Vector3(64.6, 8, 0.5))];

  return { root, colliders, oneWay, slopes, platforms: movingPlatforms, ladders, goalX: 108 };
}
