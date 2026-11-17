/**
 * Server session guard: monotonic seq, action cooldown, clock drift.
 * Pure, testable in Node.
 */
export function acceptSeq(session, seq) {
  const n = Number(seq);
  if (!Number.isFinite(n) || n < 0) return true; // old clients do not send seq
  if (session.lastSeq != null && n <= session.lastSeq) return false;
  session.lastSeq = n;
  return true;
}

export function canHit(session, now, cooldownMs = 120) {
  if (session.lastHitAt && now - session.lastHitAt < cooldownMs) return false;
  session.lastHitAt = now;
  return true;
}

/** Accepts client time within ±windowMs of the server. */
export function timeOk(clientTime, serverNow, windowMs = 5000) {
  const t = Number(clientTime);
  if (!Number.isFinite(t)) return true;
  return Math.abs(t - serverNow) <= windowMs;
}

export function clockOffset(clientTime, serverNow) {
  const t = Number(clientTime);
  if (!Number.isFinite(t)) return 0;
  return serverNow - t;
}
