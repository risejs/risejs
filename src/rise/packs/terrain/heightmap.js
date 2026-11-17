/**
 * Binary int16 heightmap (cm) → sampler. Pure, testable in Node.
 * Format: the header lives outside the file (width/height/scale), declared in `terrain.json`.
 */
export function decodeHeightmap(buffer, { width, height, scale = 0.01, offset = 0 } = {}) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
  const count = width * height;
  if (!(width > 0 && height > 0)) throw new Error('[terrain] invalid width/height');
  if (bytes.byteLength < count * 2) throw new Error('[terrain] buffer is too short');

  const view = new DataView(bytes);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true) * scale + offset;
  return out;
}

export function encodeHeightmap(heights, { scale = 0.01, offset = 0 } = {}) {
  const out = new Int16Array(heights.length);
  for (let i = 0; i < heights.length; i++) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round((heights[i] - offset) / scale)));
  }
  return out.buffer;
}

/** Bilinear sampler; coordinates are in cells (0..width-1). */
export function heightfieldFrom({ buffer = null, heights = null, width, height, scale = 0.01, offset = 0 } = {}) {
  const data = heights || decodeHeightmap(buffer, { width, height, scale, offset });
  const at = (x, z) => data[Math.max(0, Math.min(height - 1, Math.round(z))) * width + Math.max(0, Math.min(width - 1, Math.round(x)))];

  function heightAt(x, z) {
    const cx = Math.max(0, Math.min(width - 1.001, x));
    const cz = Math.max(0, Math.min(height - 1.001, z));
    const x0 = Math.floor(cx);
    const z0 = Math.floor(cz);
    const fx = cx - x0;
    const fz = cz - z0;
    const x1 = Math.min(width - 1, x0 + 1);
    const z1 = Math.min(height - 1, z0 + 1);

    const h00 = data[z0 * width + x0];
    const h10 = data[z0 * width + x1];
    const h01 = data[z1 * width + x0];
    const h11 = data[z1 * width + x1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }

  function normalAt(x, z, strength = 1) {
    const e = 1;
    const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    const nx = -dx * strength;
    const nz = -dz * strength;
    const len = Math.hypot(nx, 1, nz) || 1;
    return { x: nx / len, y: 1 / len, z: nz / len };
  }

  return { width, height, heights: data, heightAt, normalAt, at };
}

/** Splits the grid into square chunks (in cells). */
export function chunkRanges(width, height, chunk = 32) {
  const out = [];
  for (let z = 0; z < height; z += chunk) {
    for (let x = 0; x < width; x += chunk) {
      out.push({ x, z, w: Math.min(chunk, width - x), h: Math.min(chunk, height - z) });
    }
  }
  return out;
}

/** Picks a LOD by distance; levels ascending (m). */
export function lodIndexForDistance(distance, levels = [0, 120, 320]) {
  let index = 0;
  for (let i = 0; i < levels.length; i++) if (distance >= levels[i]) index = i;
  return index;
}

/** Chunk metrics: area and estimated vertex count for a segments×segments grid. */
export function chunkStats(range, segments = 32) {
  const quads = segments * segments;
  return { cells: range.w * range.h, vertices: (segments + 1) ** 2, triangles: quads * 2 };
}
