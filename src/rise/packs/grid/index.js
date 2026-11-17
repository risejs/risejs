import * as THREE from 'three';

/**
 * Grid pack: cell-by-cell movement for tactics and turn-based games.
 *
 *   app.use(gridPlugin, { cell: 3, stepTime: 0.18, repeat: 0.24, min: [-6,-6], max: [6,6] });
 *   app.grid.cell        // { i, j }
 *   app.grid.moveTo(3, -2)
 *
 * Every valid step emits `grid:step`; a game can treat that as one turn.
 */
export class GridMover {
  constructor(app, { cell = 3, stepTime = 0.18, repeat = 0.24, min = [-6, -6], max = [6, 6] } = {}) {
    this.app = app;
    this.cellSize = cell;
    this.stepTime = stepTime;
    this.repeatTime = repeat;
    this.min = min;
    this.max = max;

    const p = app.player;
    this.i = Math.round(p.pos.x / cell);
    this.j = Math.round(p.pos.z / cell);
    this.from = p.pos.clone();
    this.to = this._center(this.i, this.j);
    this.t = 1;
    this.repeatAcc = 0;
    this.blockedCount = 0;

    p.vel.set(0, 0, 0);
    p.pos.copy(this.to);
  }

  _center(i, j) {
    return new THREE.Vector3(i * this.cellSize, 0, j * this.cellSize);
  }

  get cell() {
    return { i: this.i, j: this.j };
  }

  _free(i, j) {
    if (i < this.min[0] || i > this.max[0] || j < this.min[1] || j > this.max[1]) return false;
    const c = this._center(i, j);
    const box = new THREE.Box3(
      new THREE.Vector3(c.x - 0.55, 0.05, c.z - 0.55),
      new THREE.Vector3(c.x + 0.55, 1.8, c.z + 0.55)
    );
    for (const col of this.app.world.colliders) {
      const c = col.aabb || col;
      if (col.isObb ? col.intersectsAabb(box) : c.intersectsBox(box)) return false;
    }
    return true;
  }

  move(dx, dz) {
    if (this.t < 1) return false;
    const ni = this.i + dx;
    const nj = this.j + dz;
    if (!this._free(ni, nj)) {
      this.blockedCount++;
      this.app.events.emit('grid:blocked', { i: ni, j: nj });
      return false;
    }
    this.i = ni;
    this.j = nj;
    this.from = this.app.player.pos.clone();
    this.to = this._center(ni, nj);
    this.t = 0;
    this.app.events.emit('grid:step', { i: ni, j: nj });
    return true;
  }

  moveTo(i, j) {
    if (i === this.i && j === this.j) return true;
    if (!this._free(i, j)) return false;
    this.i = i;
    this.j = j;
    this.from = this.app.player.pos.clone();
    this.to = this._center(i, j);
    this.t = 0;
    return true;
  }

  update(dt) {
    const p = this.app.player;
    const input = this.app.input;

    // lerp progress between two cells
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.stepTime);
      p.pos.lerpVectors(this.from, this.to, this.t);
    }

    if (!this.app.state.is('playing')) return;

    const wantX = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    const wantZ = (input.down('back') ? 1 : 0) - (input.down('forward') ? 1 : 0);

    if (input.justPressed('forward')) return this.move(0, -1);
    if (input.justPressed('back')) return this.move(0, 1);
    if (input.justPressed('left')) return this.move(-1, 0);
    if (input.justPressed('right')) return this.move(1, 0);

    // holding a key repeats at the repeat interval
    if (wantX || wantZ) {
      this.repeatAcc += dt;
      if (this.repeatAcc >= this.repeatTime) {
        this.repeatAcc = 0;
        this.move(Math.sign(wantX), Math.sign(wantZ));
      }
    } else {
      this.repeatAcc = this.repeatTime;
    }

    p.vel.set(0, 0, 0);
  }
}

export function gridPlugin(app, options = {}) {
  const grid = new GridMover(app, options);
  app.grid = grid;
  const off = app.events.on('frame', (dt) => grid.update(dt));
  app.log?.('grid pack ready');
  return () => {
    off();
    if (app.grid === grid) app.grid = null;
  };
}
