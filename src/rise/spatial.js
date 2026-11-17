/**
 * Spatial hash for colliders: a broadphase instead of scanning the whole array.
 * Each box is inserted into every cell it covers; a query only looks at the relevant cells.
 */
export class SpatialHash {
  constructor(cell = 16) {
    this.cell = cell;
    this.map = new Map();
    this.items = new Set();
  }

  _key(ix, iz) {
    return `${ix},${iz}`;
  }

  _range(box) {
    return {
      x0: Math.floor(box.min.x / this.cell),
      x1: Math.floor(box.max.x / this.cell),
      z0: Math.floor(box.min.z / this.cell),
      z1: Math.floor(box.max.z / this.cell),
    };
  }

  insert(collider) {
    const box = collider.aabb || collider;
    const r = this._range(box);
    for (let ix = r.x0; ix <= r.x1; ix++) {
      for (let iz = r.z0; iz <= r.z1; iz++) {
        const k = this._key(ix, iz);
        let bucket = this.map.get(k);
        if (!bucket) this.map.set(k, (bucket = new Set()));
        bucket.add(collider);
      }
    }
    this.items.add(collider);
    return collider;
  }

  rebuild(boxes) {
    this.map.clear();
    this.items.clear();
    for (const b of boxes) this.insert(b);
    return this;
  }

  /** Returns the boxes/colliders that may intersect the query box (no exact test yet). */
  query(box, out = []) {
    out.length = 0;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    const r = this._range(box);
    for (let ix = r.x0; ix <= r.x1; ix++) {
      for (let iz = r.z0; iz <= r.z1; iz++) {
        const bucket = this.map.get(this._key(ix, iz));
        if (!bucket) continue;
        for (const b of bucket) {
          if (seen.has(b)) continue;
          seen.add(b);
          out.push(b);
        }
      }
    }
    return out;
  }

  get size() {
    return this.items.size;
  }
}
