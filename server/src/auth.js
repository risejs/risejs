/**
 * Expiring HMAC token: `v1.<player>.<exp>.<sig>`.
 * sig = HMAC-SHA256(secret, `${player}.${exp}`), exp in seconds.
 */
const enc = new TextEncoder();

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signToken(secret, player, { ttlSec = 86400, now = Date.now() } = {}) {
  const exp = Math.floor(now / 1000) + Math.max(60, ttlSec);
  const payload = `${encodeURIComponent(player)}.${exp}`;
  const sig = await hmac(secret, payload);
  return `v1.${payload}.${sig}`;
}

export async function verifyToken(secret, token, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || !token.startsWith('v1.')) return { ok: false, reason: 'format' };
  const rest = token.slice(3);
  const lastDot = rest.lastIndexOf('.');
  if (lastDot < 0) return { ok: false, reason: 'format' };

  const payload = rest.slice(0, lastDot);
  const sig = rest.slice(lastDot + 1);
  const [playerPart, expPart] = payload.split('.');
  const exp = Number(expPart);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'format' };
  if (exp * 1000 <= now) return { ok: false, reason: 'expired' };

  const expected = await hmac(secret, payload);
  if (sig !== expected) return { ok: false, reason: 'signature' };

  return { ok: true, player: decodeURIComponent(playerPart), exp };
}
