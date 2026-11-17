import * as THREE from 'three';
import { Triggers } from '../triggers/index.js';

/**
 * Sideview pack: 2.5D platformer with sideways movement, jumping, gravity and a side camera.
 *
 *   app.use(sidePlugin, { spawn: [0, 3], speed: 6, jump: 11, gravity: 30, cameraDist: 26 });
 *
 * The game must set `player.controller: 'none'` so the core does not run the first-person controller.
 */
export class SideController {
  constructor({
    spawn = [0, 3],
    speed = 6,
    jump = 11,
    gravity = 30,
    coyoteTime = 0.1,
    jumpBuffer = 0.12,
    halfWidth = 0.35,
    height = 1.7,
  } = {}) {
    this.x = spawn[0];
    this.y = spawn[1];
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.speed = speed;
    this.jump = jump;
    this.gravity = gravity;
    this.coyoteTime = coyoteTime;
    this.jumpBufferTime = jumpBuffer;
    this.sinceGround = 999;
    this.buffer = 0;
    this.halfWidth = halfWidth;
    this.height = height;
    this.climbing = false;
    this.climbSpeed = 3.2;
    this.box = new THREE.Box3();
  }

  _boxAt(x, y) {
    this.box.min.set(x - this.halfWidth, y, -0.5);
    this.box.max.set(x + this.halfWidth, y + this.height, 0.5);
    return this.box;
  }

  _blocked(x, y, colliders, oneWay = [], falling = false) {
    const b = this._boxAt(x, y);
    for (const c of colliders) {
      const box = c.aabb || c;
      if (box.intersectsBox(b)) return true;
    }
    if (falling) {
      for (const c of oneWay) {
        const box = c.aabb || c;
        if (!box.intersectsBox(b)) continue;
        // only block while the feet are above the platform surface
        if (this.y >= box.max.y - 0.06) return true;
      }
    }
    return false;
  }

  _slopeAt(x, slopes = []) {
    let best = null;
    for (const s of slopes) {
      if (x < s.x0 || x > s.x1) continue;
      const t = (x - s.x0) / (s.x1 - s.x0 || 1);
      const y = s.y0 + (s.y1 - s.y0) * t;
      if (best === null || y > best) best = y;
    }
    return best;
  }

  _ladderAt(x, y, ladders = []) {
    if (!ladders.length) return null;
    const b = this._boxAt(x, y);
    for (const l of ladders) {
      const box = l.aabb || l;
      if (box.intersectsBox(b)) return box;
    }
    return null;
  }

  update(dt, input, colliders = [], oneWay = [], slopes = [], platforms = [], ladders = []) {
    const left = input.down('left');
    const right = input.down('right');
    const dir = (right ? 1 : 0) - (left ? 1 : 0);

    const target = dir * this.speed;
    this.vx += (target - this.vx) * Math.min(1, dt * 18);
    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (dir) this.facing = dir;

    // ladders: climb with W/S while touching a ladder zone
    const onLadder = this._ladderAt(this.x, this.y, ladders);
    const climbUp = input.down('forward') ? 1 : 0;
    const climbDown = input.down('back') ? 1 : 0;

    if (onLadder && (climbUp || climbDown || this.climbing)) {
      this.climbing = true;
      this.vy = (climbUp - climbDown) * this.climbSpeed;
      this.onGround = false;
    } else if (this.climbing) {
      this.climbing = false;
    }

    // coyote time + jump buffer
    this.sinceGround = this.onGround ? 0 : this.sinceGround + dt;
    const pressed = input.justPressed ? input.justPressed('jump') : input.down('jump');
    if (pressed) this.buffer = this.jumpBufferTime;
    else this.buffer = Math.max(0, this.buffer - dt);

    if (this.buffer > 0 && (this.onGround || this.sinceGround <= this.coyoteTime)) {
      this.vy = this.jump;
      this.onGround = false;
      this.sinceGround = 999;
      this.buffer = 0;
      this.climbing = false;
    }

    if (!this.climbing) this.vy -= this.gravity * dt;

    // X axis
    const nx = this.x + this.vx * dt;
    if (!this._blocked(nx, this.y, colliders)) this.x = nx;
    else this.vx = 0;

    // Y axis
    const falling = this.vy < 0;
    const ny = this.y + this.vy * dt;
    if (!this._blocked(this.x, ny, colliders, oneWay, falling)) {
      this.y = ny;
      if (falling) this.onGround = false;
    } else {
      if (falling) this.onGround = true;
      this.vy = 0;
    }

    // slopes: stick to the slope surface while standing or just after landing
    const sy = this._slopeAt(this.x, slopes);
    if (!this.climbing && sy !== null) {
      if (this.onGround && Math.abs(sy - this.y) <= 0.8) {
        this.y = sy;
        this.vy = 0;
      } else if (this.vy <= 0 && this.y <= sy + 0.35 && this.y >= sy - 0.9) {
        this.y = sy;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // moving platforms: carry the player while standing on one
    this.standingOn = null;
    for (const p of platforms) {
      const b = p.box;
      if (!b) continue;
      const onTop =
        this.onGround &&
        this.x >= b.min.x - this.halfWidth - 0.05 &&
        this.x <= b.max.x + this.halfWidth + 0.05 &&
        this.y >= b.max.y - 0.12 &&
        this.y <= b.max.y + 0.12;
      if (!onTop) continue;
      this.x += (p.vx || 0) * dt;
      this.y += (p.vy || 0) * dt;
      this.standingOn = p;
    }

    if (this.y < -40) {
      this.y = 8;
      this.vy = 0;
    }

    return this;
  }
}

export function sidePlugin(app, options = {}) {
  const offs = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    offs.push(() => t.removeEventListener(type, fn, o));
  };
  const runOffs = () => {
    while (offs.length) {
      try {
        offs.pop()();
      } catch {}
    }
  };
  const ctrl = new SideController(options);
  app.side = ctrl;

  const player = app.player;
  const perspective = app.camera;
  const oldFov = perspective.fov;
  const useOrtho = options.ortho !== false;

  // A real orthographic camera for 2.5D
  const height = options.orthoHeight ?? 20;
  const aspect = window.innerWidth / window.innerHeight;
  const ortho = useOrtho ? new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 200) : null;
  const camera = ortho || perspective;

  if (ortho) {
    const resize = () => {
      const a = window.innerWidth / window.innerHeight;
      ortho.left = -height * a / 2;
      ortho.right = height * a / 2;
      ortho.top = height / 2;
      ortho.bottom = -height / 2;
      ortho.updateProjectionMatrix();
    };
    on(window, 'resize', resize);
    resize();
    app.setCamera(ortho);
  } else {
    perspective.fov = options.fov ?? 32;
    perspective.updateProjectionMatrix();
  }

  player.pos.set(ctrl.x, ctrl.y, 0);

  let camX = ctrl.x;
  let shakeT = 0;
  let shakeDur = 1;
  let shakeAmp = 0;
  const shake = (amount = 0.25, duration = 0.2) => {
    shakeAmp = amount;
    shakeT = duration;
    shakeDur = Math.max(0.001, duration);
  };
  const sideCamera = { shake };
  app.sideCamera = sideCamera;
  const platforms = options.platforms || [];
  const slopes = options.slopes || [];
  const ladders = options.ladders || [];
  const triggers = new Triggers(app.events);
  for (const t of options.triggers || []) triggers.add(t);
  app.triggers = triggers;
  const playerBox = new THREE.Box3();

  offs.push(app.events.on('frame', (dt) => {
    // moving platforms: update mesh, box and velocity
    const solids = app.world.colliders.slice();
    for (const p of platforms) {
      if (p.baseY != null) {
        p.t = (p.t || 0) + dt;
        const y = p.baseY + Math.sin(p.t * (p.speed ?? 1)) * (p.amp ?? 1);
        p.vy = dt > 0 ? (y - p.mesh.position.y) / dt : 0;
        p.mesh.position.y = y;
        p.mesh.updateMatrixWorld(true);
        p.box.setFromObject(p.mesh);
      }
      solids.push(p.box);
    }

    ctrl.update(dt, app.input, solids, app.sideLevel?.oneWay || [], slopes, platforms, ladders);

    playerBox.min.set(ctrl.x - ctrl.halfWidth, ctrl.y, -0.5);
    playerBox.max.set(ctrl.x + ctrl.halfWidth, ctrl.y + ctrl.height, 0.5);
    triggers.update(playerBox);

    player.pos.set(ctrl.x, ctrl.y, 0);

    if (app.character) {
      app.character.setVisible(true);
      app.character.group.position.set(ctrl.x, ctrl.y, 0);
      app.character.group.rotation.y = ctrl.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      app.character.update(dt, Math.abs(ctrl.vx), ctrl.facing > 0 ? Math.PI / 2 : -Math.PI / 2, false, false);
    }

    camX += (ctrl.x - camX) * Math.min(1, dt * 6);

    // deadzone: only follow once the offset exceeds the threshold
    const dead = options.deadzoneX ?? 3;
    const dx = ctrl.x - camX;
    if (Math.abs(dx) > dead) camX += dx - Math.sign(dx) * dead;

    const b = options.bounds;
    if (b) camX = Math.max(b.minX + 10, Math.min(b.maxX - 10, camX));
    const dist = options.cameraDist ?? 26;
    camera.position.set(camX, ctrl.y + 2.4, dist);
    camera.lookAt(camX, ctrl.y + 1.6, 0);

    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt);
      const k = shakeT / shakeDur;
      camera.position.x += (Math.random() * 2 - 1) * shakeAmp * k;
      camera.position.y += (Math.random() * 2 - 1) * shakeAmp * k;
    }
  }));

  ctrl.dispose = () => {
    runOffs();
    if (ortho) {
      if (app.camera === ortho) app.setCamera(perspective);
    } else {
      perspective.fov = oldFov;
      perspective.updateProjectionMatrix();
    }
    if (app.side === ctrl) app.side = null;
    if (app.sideCamera === sideCamera) app.sideCamera = null;
    if (app.triggers === triggers) app.triggers = null;
  };

  app.events.emit('side:ready', { controller: ctrl });
  return ctrl;
}
