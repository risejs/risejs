import * as THREE from 'three';
import { Camera2D } from '../camera2d/index.js';

/**
 * Sprite2D pack: 2D rendering with instanced quads (1 draw call per texture).
 *
 *   const batch = new SpriteBatch({ texture, capacity: 512 });
 *   batch.add({ x, y, w, h, flip });
 *   app.scene.add(batch.mesh);
 *
 * MVP limit: one texture per batch (no atlas yet). More textures means more batches.
 */
export class SpriteBatch {
  constructor({ texture = null, capacity = 256, color = 0xffffff, opacity = 1 } = {}) {
    this.capacity = capacity;
    this.count = 0;

    const geo = new THREE.PlaneGeometry(1, 1);
    const uvRect = new Float32Array(capacity * 4);
    for (let i = 0; i < capacity; i++) {
      uvRect[i * 4] = 0;
      uvRect[i * 4 + 1] = 0;
      uvRect[i * 4 + 2] = 1;
      uvRect[i * 4 + 3] = 1;
    }
    this.uvAttr = new THREE.InstancedBufferAttribute(uvRect, 4);
    this.uvAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('uvRect', this.uvAttr);

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // replace UVs with each instance's rect (atlas)
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute vec4 uvRect;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#ifdef USE_MAP
          vMapUv = uvRect.xy + uv * (uvRect.zw - uvRect.xy);
        #endif`
      );
    };
    mat.customProgramCacheKey = () => 'rise-sprite-uv';

    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  /** Adds a sprite; returns its index, or -1 when full. */
  add({ x = 0, y = 0, w = 1, h = 1, flip = false, rot = 0, z = 0, uv = [0, 0, 1, 1] }) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.setAt(i, { x, y, w, h, flip, rot, z, uv });
    this.mesh.count = this.count;
    return i;
  }

  setAt(i, { x, y, w, h, flip = false, rot = 0, z = 0, uv = [0, 0, 1, 1] }) {
    this._p.set(x, y, z);
    this._q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot);
    this._s.set(flip ? -w : w, h, 1);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;

    const a = this.uvAttr.array;
    a[i * 4] = uv[0];
    a[i * 4 + 1] = uv[1];
    a[i * 4 + 2] = uv[2];
    a[i * 4 + 3] = uv[3];
    this.uvAttr.needsUpdate = true;
  }

  /** Removes with swap-last, so it is O(1). */
  remove(i) {
    const last = this.count - 1;
    if (i < 0 || i >= this.count) return;
    if (i !== last) {
      this.mesh.getMatrixAt(last, this._m);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.count = last;
    this.mesh.count = last;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.mesh.count = 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/** UV rect for an atlas: index → [u0,v0,u1,v1] (origin bottom-left). */
export { parseSheet, uvFor, clipTimeline } from './sheet.js';

export function atlasUV(index, cols, rows) {
  const c = index % cols;
  const r = Math.floor(index / cols);
  const w = 1 / cols;
  const h = 1 / rows;
  return [c * w, 1 - (r + 1) * h, (c + 1) * w, 1 - r * h];
}

/** Parallax offset for a layer: factor 0 = static, 1 = follows the camera. */
export function parallaxOffset(camX, factor) {
  return camX * (1 - factor);
}

/**
 * Y-sort: keeps a list of sprites and flushes them in descending y order
 * (larger y = further away → drawn first; smaller y = closer → drawn later, on top).
 */
export class SortedSprites {
  constructor(batch) {
    this.batch = batch;
    this.items = [];
  }

  add(sprite) {
    this.items.push({ ...sprite });
    return this.items.length - 1;
  }

  update(i, patch) {
    if (this.items[i]) Object.assign(this.items[i], patch);
  }

  remove(i) {
    this.items.splice(i, 1);
  }

  flush() {
    this.batch.clear();
    const sorted = [...this.items].sort((a, b) => b.y - a.y);
    for (const s of sorted) this.batch.add(s);
    return sorted;
  }
}

/** Frame-strip animation: changes UVs over time. */
export class SpriteAnimator {
  constructor({ frames, fps = 8, loop = true } = {}) {
    this.frames = frames || [[0, 0, 1, 1]];
    this.fps = fps;
    this.loop = loop;
    this.t = 0;
    this.index = 0;
  }

  set(frames, fps = this.fps, loop = this.loop) {
    this.frames = frames;
    this.fps = fps;
    this.loop = loop;
    this.t = 0;
    this.index = 0;
  }

  /** Creates an animator from a sheet JSON (parseSheet). */
  static fromSheet(sheet, clipName = null) {
    const clip = (clipName && sheet.clips.find((c) => c.name === clipName)) || sheet.clips[0];
    if (!clip) throw new Error('[sprite2d] sheet has no clip');
    const byName = new Map(sheet.frames.map((f) => [f.name, f]));
    const frames = clip.frames.map((n) => byName.get(n)?.uv).filter(Boolean);
    return new SpriteAnimator({ frames, fps: clip.fps || 8, loop: clip.loop !== false });
  }

  update(dt) {
    this.t += dt;
    const n = this.frames.length;
    let i = Math.floor(this.t * this.fps);
    if (this.loop) i %= n;
    else i = Math.min(n - 1, i);
    this.index = i;
    return i;
  }

  get uv() {
    return this.frames[this.index];
  }
}


/**
 * Orthographic 2D camera attached to the app.
 *   app.use(sprite2dPlugin, { height: 12, follow: () => player.x });
 */
export function sprite2dPlugin(app, { height = 12, follow = null, bounds = null, zoom = 1, pixelPerfect = false, ppu = 16 } = {}) {
  const cam = new THREE.OrthographicCamera(-height / 2, height / 2, height / 2, -height / 2, -100, 100);
  const camera2d = new Camera2D(cam, { height, zoom, pixelPerfect, ppu });

  const resize = () => camera2d.resize(window.innerWidth, window.innerHeight);
  const prevCam = app.camera;
  window.addEventListener('resize', resize);
  resize();

  cam.position.set(0, height * 0.25, 20);
  cam.lookAt(0, height * 0.25, 0);

  app.setCamera(cam);

  const off = app.events.on('frame', (dt) => {
    if (!follow) return;
    const x = follow();
    camera2d.update(dt, x);
    if (bounds) {
      const half = (cam.right - cam.left) / 2;
      cam.position.x = Math.max(bounds.minX + half, Math.min(bounds.maxX - half, cam.position.x));
    }
    cam.lookAt(cam.position.x, height * 0.25, 0);
  });

  const api = {
    camera: cam,
    height,
    camera2d,
    shake: (a, t) => camera2d.shake(a, t),
    dispose() {
      window.removeEventListener('resize', resize);
      off();
      if (app.camera === cam) app.setCamera(prevCam);
      if (app.sprite2d === api) app.sprite2d = null;
    },
  };
  app.sprite2d = api;
  return api;
}
