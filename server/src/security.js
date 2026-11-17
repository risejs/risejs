/**
 * Server-side limits and sanitising. Pure, testable in Node.
 * Principle: every number from the client is clamped; every string is truncated and stripped of control characters.
 */
export const LIMITS = {
  damage: 50,
  range: 8,
  name: 16,
  chat: 200,
  messageBytes: 4096,
  msgsPerSec: 120,
  room: /^[A-Za-z0-9_-]{1,40}$/,
  zone: 4000,
};

export function clampDamage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(LIMITS.damage, Math.round(n)));
}

export function clampRange(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(LIMITS.range, n));
}

/** Strips control characters and characters that could break HTML; truncates by code point. */
export function sanitizeName(value, fallback = 'player') {
  const name = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f<>"'`]/g, '')
    .trim()
    .slice(0, LIMITS.name);
  return name || fallback;
}

export function sanitizeChat(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .slice(0, LIMITS.chat);
}

export function validRoom(value) {
  return LIMITS.room.test(String(value || ''));
}

export function normalizeRoomName(value, fallback = 'lobby') {
  return validRoom(value) ? String(value) : fallback;
}

/** Clamps coordinates to the valid area. */
export function clampPosition(x, z, limit = LIMITS.zone) {
  const cx = Number.isFinite(Number(x)) ? Number(x) : 0;
  const cz = Number.isFinite(Number(z)) ? Number(z) : 0;
  return {
    x: Math.max(-limit, Math.min(limit, cx)),
    z: Math.max(-limit, Math.min(limit, cz)),
  };
}

/**
 * Token bucket over a 1 second window. Returns false when exceeded.
 * `bucket = { count, start }` is stored on the session.
 */
export function takeToken(bucket, now, limit = LIMITS.msgsPerSec, windowMs = 1000) {
  if (bucket.start == null || now - bucket.start >= windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count++;
  return bucket.count <= limit;
}

export function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}
