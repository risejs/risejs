import * as THREE from 'three';

/**
 * 2D camera helper: zoom, decaying shake and pixel-perfect snapping.
 *
 *   const cam = new THREE.OrthographicCamera(...);
 *   const c2 = new Camera2D(cam, { height: 12, zoom: 1, pixelPerfect: true, ppu: 16 });
 *   c2.update(dt, playerX);
 *   c2.shake(0.35, 0.25);
 */
export class Camera2D {
  constructor(camera, { height = 12, zoom = 1, pixelPerfect = false, ppu = 16 } = {}) {
    this.camera = camera;
    this.height = height;
    this.zoom = zoom;
    this.pixelPerfect = pixelPerfect;
    this.ppu = ppu;

    this.shakeAmp = 0;
    this.shakeT = 0;
    this.shakeMax = 0.0001;

    this.resize(
      typeof window !== 'undefined' ? window.innerWidth : 1280,
      typeof window !== 'undefined' ? window.innerHeight : 720
    );
  }

  resize(w, h) {
    const aspect = w / Math.max(1, h);
    const view = this.height / this.zoom;
    const cam = this.camera;
    cam.left = (-view * aspect) / 2;
    cam.right = (view * aspect) / 2;
    cam.top = view / 2;
    cam.bottom = -view / 2;
    cam.updateProjectionMatrix();
  }

  setZoom(z) {
    this.zoom = Math.max(0.25, Math.min(8, z));
    this.resize(
      typeof window !== 'undefined' ? window.innerWidth : 1280,
      typeof window !== 'undefined' ? window.innerHeight : 720
    );
  }

  shake(amount = 0.35, duration = 0.25) {
    this.shakeAmp = amount;
    this.shakeT = duration;
    this.shakeMax = duration;
  }

  update(dt, x, y = null) {
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const k = this.shakeT / this.shakeMax;
      sx = (Math.random() * 2 - 1) * this.shakeAmp * k;
      sy = (Math.random() * 2 - 1) * this.shakeAmp * k;
    }

    let nx = x + sx;
    let ny = y == null ? this.camera.position.y : y + sy;

    if (this.pixelPerfect) {
      nx = Math.round(nx * this.ppu) / this.ppu;
      ny = Math.round(ny * this.ppu) / this.ppu;
    }

    this.camera.position.x = nx;
    if (y != null) this.camera.position.y = ny;
    return { x: nx, y: ny };
  }
}
