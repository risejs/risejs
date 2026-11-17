import * as THREE from 'three';

/**
 * Multi-genre camera rig; it does not assume a first-person game.
 *
 * Modes:
 *  - 'fp'       first person
 *  - 'tp'       third person, with a boom that avoids clipping through walls
 *  - 'topdown'  top-down, rotates with yaw
 *  - 'iso'      fixed isometric (45°/35°)
 *  - 'fixed'    fixed camera that always looks at the target
 *
 * Config: config.player.view = { mode, cycle, distance, height, topdown: { height, distance, fov }, fixed: { position } }
 */
export class CameraRig {
  constructor(camera, cfg = {}) {
    this.camera = camera;
    this.cfg = cfg;
    this.mode = cfg.mode || 'fp';

    this._target = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._ray = new THREE.Ray();
    this._hit = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._baseFov = camera.fov;
  }

  setMode(mode) {
    this.mode = mode;
    this.camera.fov = this.mode === 'topdown' ? this.cfg.topdown?.fov ?? 55 : this._baseFov;
    this.camera.updateProjectionMatrix();
  }

  next() {
    const cycle = this.cfg.cycle || ['fp', 'tp'];
    const i = cycle.indexOf(this.mode);
    this.setMode(cycle[(i + 1) % cycle.length]);
    return this.mode;
  }

  update({ pos, yaw, pitch, crouched, swimming, colliders, crouchEye, standEye, tpHeight }) {
    const c = this.cfg;

    switch (this.mode) {
      case 'topdown': {
        const h = c.topdown?.height ?? 28;
        const d = c.topdown?.distance ?? 10;
        this._target.set(pos.x, pos.y, pos.z);
        this._camPos.set(pos.x + Math.sin(yaw) * d, pos.y + h, pos.z + Math.cos(yaw) * d);
        this.camera.position.copy(this._camPos);
        this.camera.lookAt(this._target);
        break;
      }

      case 'iso': {
        const d = c.distance ?? 22;
        const h = c.height ?? 18;
        this._target.set(pos.x, pos.y + 1, pos.z);
        this._camPos.set(pos.x + d * 0.7, pos.y + h, pos.z + d * 0.7);
        this.camera.position.copy(this._camPos);
        this.camera.lookAt(this._target);
        break;
      }

      case 'fixed': {
        const p = c.fixed?.position || [0, 12, 20];
        this._target.set(pos.x, pos.y + 1, pos.z);
        this.camera.position.set(p[0], p[1], p[2]);
        this.camera.lookAt(this._target);
        break;
      }

      case 'tp': {
        const cp = Math.cos(pitch);
        this._dir.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
        this._target.set(pos.x, pos.y + (swimming ? 1.05 : crouched ? crouchEye : tpHeight), pos.z);

        let dist = c.distance ?? 3.6;
        this._ray.set(this._target, this._dir.clone().negate());
        for (const box of colliders) {
          const hit = box.isObb ? box.intersectRay(this._ray, this._hit) : this._ray.intersectBox(box, this._hit);
          if (hit) dist = Math.min(dist, hit.distanceTo(this._target));
        }
        dist = Math.max(0.6, dist - 0.25);

        this._camPos.copy(this._target).addScaledVector(this._dir, -dist);
        if (this._camPos.y < 0.45) this._camPos.y = 0.45;
        this.camera.position.copy(this._camPos);
        this.camera.lookAt(this._target);
        break;
      }

      case 'fp':
      default: {
        const eye = swimming ? -0.42 + 1.1 : pos.y + (crouched ? crouchEye : standEye);
        this.camera.position.set(pos.x, eye, pos.z);
        this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
        break;
      }
    }
  }
}
