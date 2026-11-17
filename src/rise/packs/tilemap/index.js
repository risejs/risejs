import * as THREE from 'three';
import { SpriteBatch, atlasUV } from '../sprite2d/index.js';
import { autotileMask } from '../procgen/core.js';

export { autotileMask };

/** 4-direction bitmask → variant index (16 consecutive tiles in the atlas). */
export function autotileVariant(mask, base = 0) {
  return base + (mask & 15);
}

/**
 * 2D tilemap: builds a SpriteBatch per chunk and merges collision along rows.
 *
 *   const map = new Tilemap({ texture, cols:8, rows:8, tile:1, data, solids:[1] });
 *   const { group, colliders, update } = map.build({ scene });
 *   update(cameraX, halfWidth);   // shows/hides chunks by camera position
 */
export class Tilemap {
  constructor({ texture, cols = 1, rows = 1, tile = 1, data, solids = [] }) {
    this.texture = texture;
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    this.data = data;
    this.solids = new Set(solids);
    this.height = data.length;
    this.width = data[0]?.length ?? 0;
  }

  build({ chunk = 32, z = 0 } = {}) {
    const group = new THREE.Group();
    const batches = [];
    const tile = this.tile;

    for (let c0 = 0; c0 < this.width; c0 += chunk) {
      for (let r0 = 0; r0 < this.height; r0 += chunk) {
        const c1 = Math.min(this.width, c0 + chunk);
        const r1 = Math.min(this.height, r0 + chunk);

        let count = 0;
        for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) if ((this.data[r][c] ?? -1) >= 0) count++;
        if (!count) continue;

        const batch = new SpriteBatch({ texture: this.texture, capacity: count });
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            const id = this.data[r][c] ?? -1;
            if (id < 0) continue;
            batch.add({
              x: c * tile + tile / 2,
              y: (this.height - r - 1) * tile + tile / 2,
              w: tile,
              h: tile,
              uv: atlasUV(id, this.cols, this.rows),
              z,
            });
          }
        }
        group.add(batch.mesh);
        batches.push({ batch, minX: c0 * tile, maxX: c1 * tile });
      }
    }

    return {
      group,
      batches,
      colliders: this.colliders(),
      update: (camX, halfWidth) => this.update(batches, camX, halfWidth),
    };
  }

  /** Whether a tile belongs to the same "family" (base id); used for autotiling. */
  sameFamily(c, r, family, variants) {
    if (r < 0 || r >= this.height || c < 0 || c >= this.width) return false;
    const id = this.data[r][c];
    return variants ? variants.has(id) : id === family;
  }

  /** 4-direction mask of cell (c,r) against `family` (or a set of variants). */
  neighborMask(c, r, { family = null, variants = null } = {}) {
    const self = this.data[r]?.[c];
    const fam = family ?? self;
    return autotileMask({
      n: this.sameFamily(c, r - 1, fam, variants),
      e: this.sameFamily(c + 1, r, fam, variants),
      s: this.sameFamily(c, r + 1, fam, variants),
      w: this.sameFamily(c - 1, r, fam, variants),
    });
  }

  /** Switches every tile of `family` to the 16-tile variant strip starting at `base`. */
  applyAutotile({ family, base = 0, variants = null } = {}) {
    const fam = family ?? 1;
    let changed = 0;
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const id = this.data[r][c];
        if (variants ? !variants.has(id) : id !== fam) continue;
        const mask = this.neighborMask(c, r, { family: fam, variants });
        this.data[r][c] = autotileVariant(mask, base);
        changed++;
      }
    }
    return changed;
  }

  /** Merges adjacent tiles along a row → fewer Box3. */
  colliders() {
    const out = [];
    const tile = this.tile;
    for (let r = 0; r < this.height; r++) {
      let run = -1;
      for (let c = 0; c <= this.width; c++) {
        const solid = c < this.width && this.solids.has(this.data[r][c]);
        if (solid && run < 0) run = c;
        if (!solid && run >= 0) {
          const y = (this.height - r - 1) * tile;
          out.push(
            new THREE.Box3(
              new THREE.Vector3(run * tile, y, -1),
              new THREE.Vector3(c * tile, y + tile, 1)
            )
          );
          run = -1;
        }
      }
    }
    return out;
  }

  update(batches, camX, halfWidth) {
    for (const b of batches) {
      b.batch.mesh.visible = b.maxX >= camX - halfWidth && b.minX <= camX + halfWidth;
    }
  }
}
