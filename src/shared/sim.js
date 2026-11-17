/**
 * Movement simulation shared by client and server (phase 2).
 * Deliberately minimal: no colliders on the server; the client still collides, the server only clamps speed.
 */
export const SPEED = 5.2;
export const MAX_STEP = 0.05;

export function stepPlayer(p, input, dt, speed = SPEED) {
  let mx = input.mx || 0;
  let mz = input.mz || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  p.x += mx * speed * dt;
  p.z += mz * speed * dt;
  if (input.yaw != null) p.yaw = input.yaw;
  return p;
}
