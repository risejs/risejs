/** Object pool and pure particle math (no three, no DOM), testable in Node. */
export class Pool {
  constructor(factory, { size = 0 } = {}) {
    this.factory = factory;
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < size; i++) this.free.push(factory());
  }

  acquire() {
    const obj = this.free.pop() ?? this.factory();
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.active.delete(obj)) return false;
    this.free.push(obj);
    return true;
  }

  releaseAll() {
    for (const o of this.active) this.free.push(o);
    this.active.clear();
  }

  get stats() {
    return { free: this.free.length, active: this.active.size, total: this.free.length + this.active.size };
  }
}

/** Particle state: each particle is a flat object so the pool can reuse it. */
export function resetParticle(p, { x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0, life = 1, size = 0.1, color = 0xffffff, gravity = 0, drag = 0 } = {}) {
  p.x = x;
  p.y = y;
  p.z = z;
  p.vx = vx;
  p.vy = vy;
  p.vz = vz;
  p.life = life;
  p.maxLife = life;
  p.size = size;
  p.color = color;
  p.gravity = gravity;
  p.drag = drag;
  p.alive = true;
  return p;
}

/** Steps one particle; returns false when its life is over. */
export function stepParticle(p, dt) {
  if (!p.alive) return false;
  p.life -= dt;
  if (p.life <= 0) {
    p.alive = false;
    return false;
  }
  p.vy -= p.gravity * dt;
  const damp = 1 - Math.min(0.95, p.drag * dt);
  p.vx *= damp;
  p.vz *= damp;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  return true;
}

/** Bursts particles evenly over a sphere (for explosions and impacts). */
export function burst(rng, n, { speed = 3, up = 1, spread = 1 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rng.float() * Math.PI * 2;
    const u = rng.range(-spread, 1);
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const sp = speed * rng.range(0.5, 1);
    out.push({ vx: Math.cos(a) * r * sp, vy: Math.abs(u) * speed * up, vz: Math.sin(a) * r * sp });
  }
  return out;
}
