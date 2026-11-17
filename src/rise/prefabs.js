import * as THREE from 'three';
import { Entity } from './world.js';

const materialCache = new Map();

/** Materials shared by colour + roughness, to avoid creating hundreds of identical ones. */
export function material(color = 0x555c64, { roughness = 0.85, metalness = 0.1, emissive = 0, emissiveIntensity = 1 } = {}) {
  const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}`;
  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity })
    );
  }
  return materialCache.get(key);
}

function place(mesh, [x, y, z], rotationY = 0) {
  mesh.position.set(x, y, z);
  if (rotationY) mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Box with an automatic collider. */
export function box({ size = [1, 1, 1], position = [0, 0, 0], color = 0x555c64, rotationY = 0, tags = [], data = {}, autoCollider = true, opts = {} }) {
  const mesh = place(new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, opts)), position, rotationY);
  return new Entity({ mesh, tags, autoCollider, data });
}

/** Cylinder (pillars, barrels). */
export function cylinder({ radius = 0.5, height = 1, position = [0, 0, 0], color = 0x555c64, segments = 14, tags = [], data = {}, autoCollider = true, opts = {} }) {
  const mesh = place(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material(color, opts)), position);
  return new Entity({ mesh, tags, autoCollider, data });
}

/** Decoration: no collider, casts no shadow (lights, decals, effects). */
export function decor(mesh, { tags = [], data = {} } = {}) {
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return new Entity({ mesh, tags, autoCollider: false, data });
}
