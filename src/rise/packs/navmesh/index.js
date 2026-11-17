/**
 * Grid navmesh: 8-direction A* on a grid that avoids blocked cells.
 * Pure, no three.js, testable in Node.
 */
export class NavGrid {
  constructor({ cell = 1, minX = -50, maxX = 50, minZ = -50, maxZ = 50 } = {}) {
    this.cell = cell;
    this.minX = minX;
    this.minZ = minZ;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cell));
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / cell));
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  index(cx, cz) {
    return cz * this.cols + cx;
  }

  toCell(x, z) {
    return {
      cx: Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.minX) / this.cell))),
      cz: Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.minZ) / this.cell))),
    };
  }

  toWorld(cx, cz) {
    return { x: this.minX + (cx + 0.5) * this.cell, z: this.minZ + (cz + 0.5) * this.cell };
  }

  isBlocked(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return true;
    return this.blocked[this.index(cx, cz)] === 1;
  }

  block(cx, cz) {
    if (cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows) this.blocked[this.index(cx, cz)] = 1;
  }

  /** Marks the cells that intersect a Box3 (three.js Box3 or {min:{x,z}, max:{x,z}}). */
  blockBox(box) {
    const a = this.toCell(box.min.x, box.min.z);
    const b = this.toCell(box.max.x, box.max.z);
    for (let cz = a.cz; cz <= b.cz; cz++) for (let cx = a.cx; cx <= b.cx; cx++) this.block(cx, cz);
  }

  /** A*; returns an array of world points, or [] if the goal is unreachable. */
  findPath(from, to, { maxNodes = 4000 } = {}) {
    const start = this.toCell(from.x, from.z);
    const goal = this.toCell(to.x, to.z);
    if (this.isBlocked(goal.cx, goal.cz)) return [];
    if (start.cx === goal.cx && start.cz === goal.cz) return [this.toWorld(goal.cx, goal.cz)];

    const key = (cx, cz) => cz * this.cols + cx;
    const open = [{ cx: start.cx, cz: start.cz, g: 0, f: 0 }];
    const gScore = new Map([[key(start.cx, start.cz), 0]]);
    const came = new Map();
    const closed = new Set();

    const h = (cx, cz) => {
      const dx = Math.abs(cx - goal.cx);
      const dz = Math.abs(cz - goal.cz);
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };

    const dirs = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [-1, -1, Math.SQRT2],
    ];

    let expanded = 0;
    while (open.length && expanded < maxNodes) {
      let bestI = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bestI].f) bestI = i;
      const cur = open.splice(bestI, 1)[0];
      const ck = key(cur.cx, cur.cz);
      if (closed.has(ck)) continue;
      closed.add(ck);
      expanded++;

      if (cur.cx === goal.cx && cur.cz === goal.cz) {
        const path = [];
        let k = ck;
        while (k !== undefined) {
          const cx = k % this.cols;
          const cz = Math.floor(k / this.cols);
          path.push(this.toWorld(cx, cz));
          k = came.get(k);
        }
        return path.reverse();
      }

      for (const [dx, dz, cost] of dirs) {
        const nx = cur.cx + dx;
        const nz = cur.cz + dz;
        if (this.isBlocked(nx, nz)) continue;
        // do not cut diagonally across a blocked corner
        if (dx && dz && (this.isBlocked(cur.cx + dx, cur.cz) || this.isBlocked(cur.cx, cur.cz + dz))) continue;

        const nk = key(nx, nz);
        if (closed.has(nk)) continue;
        const g = cur.g + cost;
        if (g < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, g);
          came.set(nk, ck);
          open.push({ cx: nx, cz: nz, g, f: g + h(nx, nz) });
        }
      }
    }
    return [];
  }
}
