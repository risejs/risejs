/** Pure combat logic: health, armour, i-frames and melee arc checks. */
export class Health {
  constructor({ hp = 100, armor = 0, max = null } = {}) {
    this.max = max ?? hp;
    this.hp = hp;
    this.armor = armor;
    this.invulnerable = 0;
    this.dead = false;
  }

  get ratio() {
    return this.max > 0 ? Math.max(0, Math.min(1, this.hp / this.max)) : 0;
  }

  /** Returns { applied, dead, blocked } */
  damage(amount, { ignoreArmor = false, ignoreIFrame = false } = {}) {
    if (this.dead) return { applied: 0, dead: true, blocked: 'dead' };
    if (this.invulnerable > 0 && !ignoreIFrame) return { applied: 0, dead: false, blocked: 'iframe' };

    const afterArmor = ignoreArmor ? amount : Math.max(1, amount - this.armor);
    const applied = Math.max(0, Math.min(this.hp, afterArmor));
    this.hp -= applied;
    if (this.hp <= 0) this.dead = true;
    return { applied, dead: this.dead, blocked: null };
  }

  heal(amount) {
    if (this.dead) return 0;
    const before = this.hp;
    this.hp = Math.min(this.max, this.hp + Math.max(0, amount));
    return this.hp - before;
  }

  setInvulnerable(seconds) {
    this.invulnerable = Math.max(0, seconds);
    return this;
  }

  tick(dt) {
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);
  }

  revive(hp = this.max) {
    this.dead = false;
    this.hp = Math.min(this.max, Math.max(1, hp));
    return this;
  }
}

/** Whether the target is inside the arc in front of the attacker. */
export function inMeleeArc(from, to, { range = 2.4, arc = 0.7, yaw = 0 } = {}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;
  if (dist < 0.001) return true;

  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const dot = (dx / dist) * fx + (dz / dist) * fz;
  return dot >= 1 - arc;
}

/** Same team does not fight (team 0 is neutral and hostile to everyone). */
export function hostile(a = 0, b = 0) {
  return a === 0 || b === 0 || a !== b;
}

/** Picks the nearest target inside the arc. */
export function pickTarget(attacker, list, { range = 2.4, arc = 0.7, yaw = 0, team = 0 } = {}) {
  let best = null;
  let bestDist = Infinity;
  for (const t of list) {
    if (!t || t === attacker || t.dead) continue;
    if (!hostile(team, t.team ?? 0)) continue;
    const dist = Math.hypot(t.pos.x - attacker.pos.x, t.pos.z - attacker.pos.z);
    if (dist > range || dist >= bestDist) continue;
    if (!inMeleeArc(attacker.pos, t.pos, { range, arc, yaw })) continue;
    best = t;
    bestDist = dist;
  }
  return best;
}
