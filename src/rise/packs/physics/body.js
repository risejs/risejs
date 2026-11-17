/**
 * Lightweight physics: falling and bouncing bodies plus a kinematic vehicle. Pure, no three.js.
 * For when a full physics engine is not needed (adds no dependency).
 */
export const GRAVITY = 17;

export class Body {
  constructor({ x = 0, y = 0, z = 0, radius = 0.3, restitution = 0.35, drag = 0.02 } = {}) {
    this.pos = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.radius = radius;
    this.restitution = restitution;
    this.drag = drag;
    this.onGround = false;
  }

  impulse(vx, vy, vz) {
    this.vel.x += vx;
    this.vel.y += vy;
    this.vel.z += vz;
    return this;
  }
}

/** Physics step; `groundY` is a function (x,z) → ground height. */
export function stepBody(body, dt, { gravity = GRAVITY, groundY = () => 0 } = {}) {
  body.vel.y -= gravity * dt;
  const damp = 1 - Math.min(0.9, body.drag * 60 * dt);
  body.vel.x *= damp;
  body.vel.z *= damp;

  body.pos.x += body.vel.x * dt;
  body.pos.y += body.vel.y * dt;
  body.pos.z += body.vel.z * dt;

  const floor = groundY(body.pos.x, body.pos.z) + body.radius;
  body.onGround = false;
  if (body.pos.y <= floor) {
    body.pos.y = floor;
    if (Math.abs(body.vel.y) < 1.2) body.vel.y = 0;
    else body.vel.y = -body.vel.y * body.restitution;
    body.onGround = body.vel.y === 0;
  }
  return body;
}

/** Kinematic vehicle: throttle/brake and steering, no tire simulation. */
export class Vehicle {
  constructor({ x = 0, z = 0, heading = 0, maxSpeed = 18, accel = 9, brake = 16, steer = 1.6 } = {}) {
    this.pos = { x, z };
    this.heading = heading;
    this.speed = 0;
    this.maxSpeed = maxSpeed;
    this.accel = accel;
    this.brake = brake;
    this.steer = steer;
  }

  update(dt, { throttle = 0, steer = 0, brake = 0 } = {}) {
    if (brake > 0) {
      const d = this.brake * brake * dt;
      this.speed = Math.abs(this.speed) <= d ? 0 : this.speed - Math.sign(this.speed) * d;
    } else {
      this.speed += throttle * this.accel * dt;
      this.speed = Math.max(-this.maxSpeed * 0.4, Math.min(this.maxSpeed, this.speed));
    }

    // the faster it goes, the less it steers
    const grip = 1 - Math.min(0.7, Math.abs(this.speed) / (this.maxSpeed * 2));
    this.heading += steer * this.steer * grip * dt * Math.sign(this.speed || 1);

    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    return this;
  }
}
