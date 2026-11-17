/**
 * LOD group driven by screen coverage (follows glTF `MSFT_lod` + screenCoverage).
 * Does not depend on gltf: accepts any three object.
 */
export class LodGroup {
  /**
   * @param {{object: object, minCoverage: number}[]} levels level 0 first, coverage decreasing
   */
  constructor(levels = [], { hysteresis = 0.02 } = {}) {
    this.levels = [...levels].sort((a, b) => b.minCoverage - a.minCoverage);
    this.hysteresis = hysteresis;
    this.index = 0;
    this.apply(1);
  }

  /** Picks a level for a coverage of 0..1; returns the index. */
  apply(coverage) {
    let next = this.levels.length - 1;
    for (let i = 0; i < this.levels.length; i++) {
      if (coverage >= this.levels[i].minCoverage) {
        next = i;
        break;
      }
    }

    // hysteresis around the boundary to avoid flicker
    const current = this.levels[this.index];
    if (current && next !== this.index) {
      const diff = Math.abs(coverage - current.minCoverage);
      if (diff < this.hysteresis) next = this.index;
    }

    this.index = Math.max(0, Math.min(this.levels.length - 1, next));
    this.levels.forEach((lvl, i) => {
      if (lvl.object) lvl.object.visible = i === this.index;
    });
    return this.index;
  }

  get current() {
    return this.levels[this.index]?.object || null;
  }
}

/** Creates a LodGroup from a manifest: levels = [{ object, minCoverage }]. */
export function lodGroupFromManifest(manifest, objects = []) {
  const coverage = manifest?.lod?.screenCoverage || [];
  return new LodGroup(
    objects.map((object, i) => ({ object, minCoverage: coverage[i] ?? (i === 0 ? 1 : 0.001) }))
  );
}
