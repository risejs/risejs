import * as THREE from 'three';
import { SurfaceMap, SURFACE } from '../../rise/world/surface.js';
import { ARENA_MAP } from './map.js';

/**
 * Top-down arena: shows that the core does not depend on a first-person view.
 * Geometry comes from ARENA_MAP, the same data the server uses to block bullets and movement.
 */
export function buildArena() {
  const root = new THREE.Group();
  const colliders = [];
  const surface = new SurfaceMap();

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, roughness: 0.92 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.8 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.7 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x1d3220, roughness: 1 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  for (const def of ARENA_MAP.boxes) {
    const mat = def.kind === 'crate' ? crateMat : wallMat;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), mat);
    mesh.position.set(def.x, def.h / 2, def.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    root.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(mesh));
  }

  // surfaces: a lawn and a stone yard
  const grass = new THREE.Mesh(new THREE.CircleGeometry(9, 32), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(-16, 0.03, 16);
  grass.receiveShadow = true;
  root.add(grass);
  surface.circle(SURFACE.GRASS, -16, 16, 9);

  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), stoneMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(16, 0.03, -16);
  plaza.receiveShadow = true;
  root.add(plaza);
  surface.rect(SURFACE.STONE, 16, -16, 14, 14);

  return { root, colliders, surface, map: ARENA_MAP };
}
