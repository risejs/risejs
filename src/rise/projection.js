import * as THREE from 'three';

const _v = new THREE.Vector3();

/** Projects a 3D point to screen pixels. Shared by nameplate/vfx/combat. */
export function projectToScreen(camera, pos, width, height, out = {}) {
  const v = _v.copy(pos).project(camera);
  out.x = (v.x * 0.5 + 0.5) * width;
  out.y = (-v.y * 0.5 + 0.5) * height;
  out.visible = v.z > -1 && v.z < 1;
  return out;
}
