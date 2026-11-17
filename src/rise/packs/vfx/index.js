import * as THREE from 'three';
import './vfx.css';
import { projectToScreen } from '../../projection.js';
import { Pool, resetParticle, stepParticle, burst } from './core.js';
import { Rng } from '../../rng.js';
export { Pool, resetParticle, stepParticle, burst };

const VERT = `
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = color;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = dot(d, d);
  if (r > 0.25) discard;
  float edge = smoothstep(0.25, 0.05, r);
  gl_FragColor = vec4(vColor, vAlpha * edge);
}`;

/** Particle system in 1 draw call (THREE.Points + a small shader). */
export class Particles {
  constructor(scene, { capacity = 256, color = 0xffb347, size = 0.18 } = {}) {
    this.capacity = capacity;
    this.pool = new Pool(() => ({}), { size: capacity });
    this.items = [];

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    const mat = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);

    this.defaultColor = new THREE.Color(color);
    this.defaultSize = size;
    this.dirty = true;
  }

  spawn({ x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0, life = 0.6, size = null, color = null, gravity = 9, drag = 1.6 } = {}) {
    if (this.items.length >= this.capacity) return null;
    const p = this.pool.acquire();
    resetParticle(p, { x, y, z, vx, vy, vz, life, size: size ?? this.defaultSize, color: color ?? this.defaultColor.getHex(), gravity, drag });
    p.c = new THREE.Color(p.color);
    this.items.push(p);
    return p;
  }

  burst(pos, { count = 14, speed = 3.2, color = null, life = 0.55, gravity = 10, rng = null } = {}) {
    const r = rng || new Rng(Date.now() & 0xffff);
    for (const dir of burst(r, count, { speed })) {
      this.spawn({ x: pos.x, y: pos.y, z: pos.z, ...dir, life: life * r.range(0.7, 1.2), color, gravity });
    }
  }

  update(dt) {
    let n = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      if (!stepParticle(p, dt)) {
        this.items.splice(i, 1);
        this.pool.release(p);
      }
    }

    for (const p of this.items) {
      const k = Math.max(0, p.life / p.maxLife);
      this.positions[n * 3] = p.x;
      this.positions[n * 3 + 1] = p.y;
      this.positions[n * 3 + 2] = p.z;
      this.colors[n * 3] = p.c.r;
      this.colors[n * 3 + 1] = p.c.g;
      this.colors[n * 3 + 2] = p.c.b;
      this.sizes[n] = p.size * (0.4 + k * 0.6);
      this.alphas[n] = k;
      n++;
    }

    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    return n;
  }

  clear() {
    for (const p of this.items) this.pool.release(p);
    this.items.length = 0;
    this.points.geometry.setDrawRange(0, 0);
  }

  get count() {
    return this.items.length;
  }

  dispose() {
    this.clear();
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/** Damage numbers / floating text in the DOM (0 draw calls). */
export class FloatText {
  constructor(app, { max = 24 } = {}) {
    this.app = app;
    this.max = max;
    this.items = [];
    const root = document.createElement('div');
    root.className = 'vfx-floats';
    app.hud.root.appendChild(root);
    this.root = root;
    this.v = new THREE.Vector3();
    this.screen = {};

    this._off = app.events.on('frame', (dt) => this.update(dt));
  }

  dispose() {
    this._off?.();
    this._off = null;
    for (const it of this.items) it.el.remove();
    this.items.length = 0;
    this.root.remove();
  }

  spawn(pos, text, { crit = false, color = null, life = 1.1, rise = 34 } = {}) {
    if (this.items.length >= this.max) {
      const oldest = this.items.shift();
      oldest.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'vfx-float' + (crit ? ' crit' : '');
    if (color) el.style.color = color;
    el.textContent = text;
    this.root.appendChild(el);

    const item = { el, x: pos.x, y: pos.y, z: pos.z, t: 0, life, rise, jitter: (this.app.rng?.range(-8, 8) ?? 0) };
    this.items.push(item);
    return item;
  }

  update(dt) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        it.el.remove();
        this.items.splice(i, 1);
        continue;
      }

      this.v.set(it.x, it.y + k * 0.5, it.z);
      projectToScreen(this.app.camera, this.v, w, h, this.screen);
      const y = this.screen.y - it.rise * k;
      it.el.style.transform = `translate(-50%,-50%) translate(${this.screen.x + it.jitter * k}px, ${y}px) scale(${1 + (1 - k) * 0.15})`;
      it.el.style.opacity = String(1 - k * k);
      it.el.style.display = this.screen.visible ? 'block' : 'none';
    }
  }
}

/** Flashes a material when it takes a hit. */
export class HitFlash {
  constructor() {
    this.items = [];
  }

  /** Restores the previous emissive value for every running flash. */
  dispose() {
    for (const it of this.items) {
      for (const { m, hex, i: intensity } of it.mats) {
        m.emissive?.setHex(hex);
        m.emissiveIntensity = intensity;
      }
    }
    this.items.length = 0;
  }

  flash(mesh, { color = 0xff6b4a, duration = 0.18, intensity = 1.2 } = {}) {
    const mats = [];
    mesh?.traverse?.((o) => {
      if (!o.isMesh || !o.material) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (!('emissive' in m)) continue;
        mats.push({ m, hex: m.emissive?.getHex?.() ?? 0, i: m.emissiveIntensity ?? 1 });
        m.emissive?.setHex(color);
        m.emissiveIntensity = intensity;
      }
    });
    if (mats.length) this.items.push({ mats, t: duration, duration });
    return mats.length > 0;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t -= dt;
      if (it.t > 0) continue;
      for (const { m, hex, i: intensity } of it.mats) {
        m.emissive?.setHex(hex);
        m.emissiveIntensity = intensity;
      }
      this.items.splice(i, 1);
    }
  }
}

/**
 * VFX pack: particles, damage numbers, hit flash.
 *
 *   app.use(vfxPlugin);
 *   app.vfx.burst(pos, { count: 18 });
 *   app.vfx.damage(pos, 27, { crit: true });
 *   app.vfx.hitFlash(mesh);
 */
export function vfxPlugin(app, { capacity = 256 } = {}) {
  const particles = new Particles(app.scene, { capacity });
  const floats = new FloatText(app);
  const flash = new HitFlash();

  const off = app.events.on('frame', (dt) => {
    particles.update(dt);
    flash.update(dt);
  });

  const api = {
    particles,
    spawn: (o) => particles.spawn(o),
    burst: (pos, o) => particles.burst(pos, { ...o, rng: app.rng }),
    damage: (pos, amount, o) => floats.spawn({ x: pos.x, y: (pos.y ?? 0) + 1.9, z: pos.z }, String(Math.round(amount)), o),
    text: (pos, text, o) => floats.spawn(pos, text, o),
    hitFlash: (mesh, o) => flash.flash(mesh, o),
    get activeParticles() {
      return particles.count;
    },
    dispose() {
      off();
      floats.dispose();
      flash.dispose();
      particles.dispose();
      if (app.vfx === api) app.vfx = null;
    },
  };

  app.vfx = api;
  return api;
}
