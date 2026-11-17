/**
 * Heightfield: terrain heights sampled bilinearly.
 * Used for sloped ground; objects still use AABB/OBB colliders.
 */
export class Heightfield {
  /**
   * @param {object} o
   * @param {number} o.size  side length of the area (m), centered at 0
   * @param {number} o.res   cells per side
   * @param {(x:number,z:number)=>number} o.height
   */
  constructor({ size = 200, res = 64, height = () => 0 } = {}) {
    this.size = size;
    this.res = res;
    this.step = size / res;
    this.heights = new Float32Array((res + 1) * (res + 1));

    for (let iz = 0; iz <= res; iz++) {
      for (let ix = 0; ix <= res; ix++) {
        const x = -size / 2 + ix * this.step;
        const z = -size / 2 + iz * this.step;
        this.heights[iz * (res + 1) + ix] = height(x, z);
      }
    }
  }

  _at(ix, iz) {
    const r = this.res + 1;
    const x = Math.max(0, Math.min(this.res, ix));
    const z = Math.max(0, Math.min(this.res, iz));
    return this.heights[z * r + x];
  }

  /** Height at a point, bilinearly interpolated; clamped to the edge outside the area. */
  heightAt(x, z) {
    const half = this.size / 2;
    const fx = (x + half) / this.step;
    const fz = (z + half) / this.step;

    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;

    const h00 = this._at(ix, iz);
    const h10 = this._at(ix + 1, iz);
    const h01 = this._at(ix, iz + 1);
    const h11 = this._at(ix + 1, iz + 1);

    const h0 = h00 + (h10 - h00) * tx;
    const h1 = h01 + (h11 - h01) * tx;
    return h0 + (h1 - h0) * tz;
  }

  /** Approximate normal (for tilting a character, if needed). */
  normalAt(x, z, eps = 0.5) {
    const hL = this.heightAt(x - eps, z);
    const hR = this.heightAt(x + eps, z);
    const hD = this.heightAt(x, z - eps);
    const hU = this.heightAt(x, z + eps);
    return { x: (hL - hR) / (2 * eps), y: 1, z: (hD - hU) / (2 * eps) };
  }
}
