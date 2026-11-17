/**
 * Surface layer: environment interaction (grass / water / stone) defined by regions of space,
 * NOT attached to objects, so it stays correct when objects move.
 *
 * Returns a 0..1 weight per type; anywhere outside every region is street.
 */

export const SURFACE = { STREET: 'street', STONE: 'stone', GRASS: 'grass', WATER: 'water' };

export class SurfaceMap {
  constructor() {
    this.regions = [];
  }

  /** Rectangular region: centre coordinates + size. */
  rect(type, cx, cz, w, d) {
    this.regions.push({ type, kind: 'rect', cx, cz, w, d });
    return this;
  }

  /** Circular region (a pond). */
  circle(type, cx, cz, r) {
    this.regions.push({ type, kind: 'circle', cx, cz, r });
    return this;
  }

  /** Query at a point: returns the dominant type + weights. */
  at(x, z) {
    let water = 0;
    let grass = 0;
    let stone = 0;

    for (const r of this.regions) {
      let inside = false;
      if (r.kind === 'rect') {
        inside = Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2;
      } else {
        inside = (x - r.cx) ** 2 + (z - r.cz) ** 2 <= r.r ** 2;
      }
      if (!inside) continue;
      if (r.type === SURFACE.WATER) water = 1;
      else if (r.type === SURFACE.GRASS) grass = 1;
      else if (r.type === SURFACE.STONE) stone = 1;
    }

    const type = water ? SURFACE.WATER : grass ? SURFACE.GRASS : stone ? SURFACE.STONE : SURFACE.STREET;
    return { type, water, grass, stone };
  }
}
