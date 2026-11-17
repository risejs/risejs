import * as THREE from 'three';

/**
 * OBB rotated around the Y axis (enough for walls, crates and barriers).
 * Provides:
 *  - intersectsAabb(box)  — 2D SAT (XZ) plus a Y check
 *  - intersectRay(ray, out) — transforms the ray to local space, then uses slabs
 *  - aabb — world bounding box for the broadphase
 */
export class Obb {
  constructor(center, half, rotationY = 0) {
    this.isObb = true;
    this.center = new THREE.Vector3(center[0], center[1], center[2]);
    this.half = new THREE.Vector3(half[0], half[1], half[2]);
    this.rotationY = rotationY;

    const c = Math.cos(rotationY);
    const s = Math.sin(rotationY);
    this.ux = new THREE.Vector3(c, 0, -s);
    this.uz = new THREE.Vector3(s, 0, c);

    const ex = Math.abs(this.ux.x) * this.half.x + Math.abs(this.uz.x) * this.half.z;
    const ez = Math.abs(this.ux.z) * this.half.x + Math.abs(this.uz.z) * this.half.z;
    this.aabb = new THREE.Box3(
      new THREE.Vector3(this.center.x - ex, this.center.y - this.half.y, this.center.z - ez),
      new THREE.Vector3(this.center.x + ex, this.center.y + this.half.y, this.center.z + ez)
    );
  }

  intersectsAabb(box) {
    if (box.max.y < this.center.y - this.half.y || box.min.y > this.center.y + this.half.y) return false;

    const bcx = (box.min.x + box.max.x) / 2;
    const bcz = (box.min.z + box.max.z) / 2;
    const bhx = (box.max.x - box.min.x) / 2;
    const bhz = (box.max.z - box.min.z) / 2;

    const axes = [
      this.ux,
      this.uz,
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
    ];

    const dx = bcx - this.center.x;
    const dz = bcz - this.center.z;

    for (const a of axes) {
      const dist = Math.abs(dx * a.x + dz * a.z);
      const rBox = bhx * Math.abs(a.x) + bhz * Math.abs(a.z);
      const rObb =
        this.half.x * Math.abs(this.ux.dot(a)) + this.half.z * Math.abs(this.uz.dot(a));
      if (dist > rBox + rObb) return false;
    }
    return true;
  }

  intersectRay(ray, out = new THREE.Vector3()) {
    const px = ray.origin.x - this.center.x;
    const py = ray.origin.y - this.center.y;
    const pz = ray.origin.z - this.center.z;

    const lx = px * this.ux.x + pz * this.ux.z;
    const lz = px * this.uz.x + pz * this.uz.z;

    const dx = ray.direction.x * this.ux.x + ray.direction.z * this.ux.z;
    const dy = ray.direction.y;
    const dz = ray.direction.x * this.uz.x + ray.direction.z * this.uz.z;

    let tmin = -Infinity;
    let tmax = Infinity;

    const slab = (p, d, h) => {
      if (Math.abs(d) < 1e-8) return p >= -h && p <= h;
      let t1 = (-h - p) / d;
      let t2 = (h - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      return tmin <= tmax;
    };

    if (!slab(lx, dx, this.half.x)) return null;
    if (!slab(py, dy, this.half.y)) return null;
    if (!slab(lz, dz, this.half.z)) return null;
    if (tmax < 0) return null;

    const t = tmin >= 0 ? tmin : tmax;
    return out.copy(ray.direction).multiplyScalar(t).add(ray.origin);
  }
}
