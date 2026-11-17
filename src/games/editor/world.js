import * as THREE from 'three';

/** Empty yard + a 1 m grid for placing objects. */
export function buildEditorWorld() {
  const root = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const grid = new THREE.GridHelper(120, 120, 0x4a5560, 0x323a42);
  grid.position.y = 0.01;
  root.add(grid);

  // a few landmark blocks for orientation
  const marker = new THREE.MeshStandardMaterial({ color: 0x3d444c, roughness: 0.8 });
  for (const [x, z] of [
    [-20, -20],
    [20, -20],
    [20, 20],
    [-20, 20],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), marker);
    m.position.set(x, 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }

  return { root, colliders: [] };
}
