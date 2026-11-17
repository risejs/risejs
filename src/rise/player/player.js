import * as THREE from 'three';
import { SpatialHash } from '../spatial.js';
import { CameraRig } from '../camera/rig.js';

/**
 * Player: first/third-person movement, crouching, swimming, AABB collision.
 * All parameters are read from config.player; the framework hard-codes none.
 */
export class Player {
  constructor({ camera, input, colliders, config, surfaceAt, heightAt, character, events }) {
    this.camera = camera;
    this.input = input;
    this.colliders = colliders || [];
    this.cfg = config;
    this.surfaceAt = surfaceAt || null;
    this.heightAt = heightAt || null;
    this.character = character;
    this.events = events;

    const s = config.spawn || [0, 0, 6];
    this.pos = new THREE.Vector3(s[0], s[1] ?? 0, s[2]);
    this.vel = new THREE.Vector3();
    this.yaw = config.yaw ?? 0;
    this.pitch = 0;

    this.rig = new CameraRig(camera, config.view || {});
    this.mode = this.rig.mode;
    this.onGround = true;
    this.swimming = false;
    this.crouched = false;
    this.surface = 'street';
    this.bob = 0;
    this.height = config.height;
    this.radius = config.radius;

    this._box = new THREE.Box3();
    this._ray = new THREE.Ray();
    this._hit = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._viewToggleLock = false;
    this.spatial = new SpatialHash(16).rebuild(this.colliders);
    this._hits = [];

    if (this.character) this.character.setVisible(this.rig.mode !== 'fp');
  }

  /* ---------------- collision ---------------- */

  _blocked(x, y, z, height = this.height) {
    this._box.min.set(x - this.radius, y + 0.05, z - this.radius);
    this._box.max.set(x + this.radius, y + height, z + this.radius);
    const near = this.spatial.query(this._box, this._hits);
    for (const c of near) {
      if (c.isObb ? c.intersectsAabb(this._box) : c.intersectsBox(this._box)) return true;
    }
    return false;
  }

  /** Call after adding or removing objects so the broadphase updates. */
  rebuildColliders() {
    this.spatial.rebuild(this.colliders);
  }

  _resolvePenetration() {
    for (let pass = 0; pass < 3; pass++) {
      this._box.min.set(this.pos.x - this.radius, this.pos.y + 0.05, this.pos.z - this.radius);
      this._box.max.set(this.pos.x + this.radius, this.pos.y + this.height, this.pos.z + this.radius);

      let best = null;
      const near = this.spatial.query(this._box, this._hits);
      for (const item of near) {
        const c = item.aabb || item;
        if (!(item.isObb ? item.intersectsAabb(this._box) : c.intersectsBox(this._box))) continue;
        const options = [
          { axis: 'x', v: c.max.x - this._box.min.x + 0.001 },
          { axis: 'x', v: c.min.x - this._box.max.x - 0.001 },
          { axis: 'z', v: c.max.z - this._box.min.z + 0.001 },
          { axis: 'z', v: c.min.z - this._box.max.z - 0.001 },
        ];
        for (const o of options) if (!best || Math.abs(o.v) < Math.abs(best.v)) best = o;
      }
      if (!best || Math.abs(best.v) > 3) return;
      if (best.axis === 'x') this.pos.x += best.v;
      else this.pos.z += best.v;
      if (!this._blocked(this.pos.x, this.pos.y, this.pos.z)) return;
    }
  }

  _unstickSpawn() {
    for (let i = 0; i < 40 && this._blocked(this.pos.x, this.pos.y, this.pos.z); i++) this.pos.z += 0.5;
  }

  /* ---------------- input ---------------- */

  _look() {
    const { dx, dy } = this.input.look;
    if (!dx && !dy) return;
    const s = this.cfg.sensitivity ?? 0.0022;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  _handleCrouch() {
    const c = this.cfg.crouch;
    if (!c || c.enabled === false) return;

    if (c.mode === 'toggle' && this.input.justPressed('crouch')) this._crouchToggled = !this._crouchToggled;
    const want = c.mode === 'toggle' ? !!this._crouchToggled : this.input.down('crouch');
    if (want === this.crouched) return;

    if (!want) {
      // standing up: check the ceiling
      if (this._blocked(this.pos.x, this.pos.y, this.pos.z, this.cfg.height)) return;
    }
    this.crouched = want;
    this.height = want ? c.height : this.cfg.height;
    this.events?.emit('player:crouch', { crouched: want });
  }

  toggleView() {
    this.rig.next();
    this.mode = this.rig.mode;
    this.character?.setVisible(this.mode !== 'fp');
    this.events?.emit('player:view', { mode: this.mode });
    return this.mode;
  }

  /* ---------------- update ---------------- */

  update(dt) {
    const cfg = this.cfg;
    const input = this.input;

    this._look();
    if (input.justPressed('view')) this.toggleView();
    this._handleCrouch();

    const surf = this.surfaceAt ? this.surfaceAt(this.pos.x, this.pos.z) : null;
    this.surface = surf ? surf.type : 'street';
    this.swimming = !!surf && surf.water > 0.5 && cfg.swim?.enabled !== false;

    const forward = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
    const strafe = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);

    let speed;
    if (this.swimming) speed = input.down('run') ? cfg.swim.runSpeed : cfg.swim.speed;
    else if (this.crouched) speed = cfg.crouch.speed;
    else speed = input.down('run') ? cfg.run : cfg.walk;

    if (!this.swimming) {
      if (this.surface === 'grass') speed *= 0.86;
      else if (this.surface === 'stone') speed *= 1.02;
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = (-sin * forward + cos * strafe) * speed;
    let dz = (-cos * forward - sin * strafe) * speed;
    const len = Math.hypot(dx, dz);
    if (len > speed) {
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;
    }

    const accel = this.swimming ? 6 : this.onGround ? 14 : 4;
    this.vel.x += (dx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (dz - this.vel.z) * Math.min(1, accel * dt);

    if (this.swimming) {
      this.vel.y = 0;
    } else {
      if (input.down('jump') && this.onGround && !this.crouched) {
        this.vel.y = cfg.jump;
        this.onGround = false;
        this.events?.emit('player:jump');
      }
      this.vel.y -= (cfg.gravity ?? 17) * dt;
    }

    const travel = Math.hypot(this.vel.x, this.vel.z) * dt;
    const steps = Math.min(12, Math.max(1, Math.ceil(travel / 0.1)));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      const nx = this.pos.x + this.vel.x * step;
      if (!this._blocked(nx, this.pos.y, this.pos.z)) this.pos.x = nx;
      else this.vel.x = 0;

      const nz = this.pos.z + this.vel.z * step;
      if (!this._blocked(this.pos.x, this.pos.y, nz)) this.pos.z = nz;
      else this.vel.z = 0;
    }
    this._resolvePenetration();

    if (this.swimming) {
      this.pos.y += (cfg.swim.depth - this.pos.y) * Math.min(1, dt * 4);
      this.onGround = false;
    } else {
      this.pos.y += this.vel.y * dt;
      const groundY = this.heightAt ? this.heightAt(this.pos.x, this.pos.z) : 0;
      if (this.pos.y <= groundY) {
        this.pos.y = groundY;
        this.vel.y = 0;
        this.onGround = true;
      }
    }

    const planar = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * planar * 1.9;

    if (this.character) {
      this.character.group.position.copy(this.pos);
      const heading = planar > 0.25 ? Math.atan2(this.vel.x, this.vel.z) : this.yaw + Math.PI;
      this.character.update(dt, planar, heading, this.swimming, this.crouched);
    }

    this.rig.update({
      pos: this.pos,
      yaw: this.yaw,
      pitch: this.pitch,
      crouched: this.crouched,
      swimming: this.swimming,
      colliders: this.colliders,
      crouchEye: cfg.crouch.eye,
      standEye: cfg.eye,
      tpHeight: cfg.view.height,
    });
    this.mode = this.rig.mode;
  }

}
