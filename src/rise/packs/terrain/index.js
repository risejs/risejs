import * as THREE from 'three';

/**
 * Terrain mesh built from a heightfield: a grid colored by height and slope.
 *
 *   const terrain = new Terrain({ heightfield, size: 200, segments: 96 });
 *   scene.add(terrain.mesh);
 *   terrain.mesh.position.set(0, 0, 0);
 */
export class Terrain {
  constructor({ heightfield, size = 200, segments = 96, colors = null, flat = false } = {}) {
    this.field = heightfield;
    this.size = size;
    this.segments = segments;

    const seg = Math.max(1, Math.floor(segments));
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colorAttr = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    const palette = colors || {
      low: 0x3d4a34,
      mid: 0x5a4b33,
      high: 0x6d5f4a,
      peak: 0x8a8577,
    };

    let min = Infinity;
    let max = -Infinity;
    const heights = new Float32Array(pos.count);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = flat ? 0 : this.sample(x, z);
      heights[i] = y;
      pos.setY(i, y);
      min = Math.min(min, y);
      max = Math.max(max, y);
    }

    const span = Math.max(0.001, max - min);
    for (let i = 0; i < pos.count; i++) {
      const t = (heights[i] - min) / span;
      if (t < 0.35) c.setHex(palette.low).lerp(new THREE.Color(palette.mid), t / 0.35);
      else if (t < 0.7) c.setHex(palette.mid).lerp(new THREE.Color(palette.high), (t - 0.35) / 0.35);
      else c.setHex(palette.high).lerp(new THREE.Color(palette.peak), (t - 0.7) / 0.3);
      colorAttr[i * 3] = c.r;
      colorAttr[i * 3 + 1] = c.g;
      colorAttr[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
    this.bounds = { min, max };
  }

  sample(x, z) {
    const f = this.field;
    if (!f) return 0;
    const half = this.size / 2;
    const wx = ((x + half) / this.size) * (f.width ?? 1);
    const wz = ((z + half) / this.size) * (f.height ?? 1);
    if (typeof f.heightAt === 'function') return f.heightAt(wx, wz);
    if (typeof f.at === 'function') return f.at(wx, wz);
    return 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export {
  decodeHeightmap,
  encodeHeightmap,
  heightfieldFrom,
  chunkRanges,
  lodIndexForDistance,
  chunkStats,
} from './heightmap.js';

/** Grid resolutions from low to high, used for terrain LOD. */
export function terrainLod(levels = [32, 64, 96]) {
  return levels.map((segments, i) => ({ segments, at: i === 0 ? 0 : levels[i - 1] }));
}
