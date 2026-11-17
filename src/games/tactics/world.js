import * as THREE from 'three';

/**
 * Tactics world on a 13×13 grid (3 m per cell), with walls and a target cell.
 */
export function buildTactics() {
  const root = new THREE.Group();
  const colliders = [];
  const CELL = 3;
  const N = 6;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.95 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3a4550 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4e545c, roughness: 0.8 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
  const goalMat = new THREE.MeshStandardMaterial({
    color: 0x1c2a1c,
    emissive: 0x39ff88,
    emissiveIntensity: 0.6,
    roughness: 0.6,
  });

  const size = (N * 2 + 1) * CELL;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size + 6, size + 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // grid
  const pts = [];
  for (let i = -N; i <= N + 1; i++) {
    const x = (i - 0.5) * CELL;
    pts.push(x, 0.02, (-N - 0.5) * CELL, x, 0.02, (N + 0.5) * CELL);
    pts.push((-N - 0.5) * CELL, 0.02, x, (N + 0.5) * CELL, 0.02, x);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  root.add(new THREE.LineSegments(geo, lineMat));

  const addBox = (w, h, d, cx, cz, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    root.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  };

  // border walls
  addBox(size + 2, 3, 1, 0, (-N - 1) * CELL + 1.5, wallMat);
  addBox(size + 2, 3, 1, 0, (N + 1) * CELL - 1.5, wallMat);
  addBox(1, 3, size + 2, (-N - 1) * CELL + 1.5, 0, wallMat);
  addBox(1, 3, size + 2, (N + 1) * CELL - 1.5, 0, wallMat);

  // per-cell obstacles
  const walls = [
    [-3, -2],
    [-2, -2],
    [1, -3],
    [2, 2],
    [3, 2],
    [-1, 3],
    [0, 4],
    [4, -1],
  ];
  for (const [i, j] of walls) {
    addBox(CELL * 0.9, 2.4, CELL * 0.9, i * CELL, j * CELL, j % 2 ? crateMat : wallMat);
  }

  // target cell
  const goal = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.85, CELL * 0.85), goalMat);
  goal.rotation.x = -Math.PI / 2;
  goal.position.set(5 * CELL, 0.03, -5 * CELL);
  root.add(goal);

  return { root, colliders, cell: CELL, goal: { i: 5, j: -5 }, bounds: { min: [-N, -N], max: [N, N] } };
}
