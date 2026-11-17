/**
 * Fixed-step accumulator for deterministic simulation.
 * Pure; testable in Node.
 *
 *   let acc = 0;
 *   const { steps, acc: next } = advance(acc, dt, 1 / 60, 5);
 */
export function advance(acc, dt, fixed, maxSteps = 5) {
  if (!(fixed > 0)) return { steps: 0, acc: 0, dropped: 0 };

  let next = acc + Math.max(0, dt);
  let steps = 0;
  while (next >= fixed && steps < maxSteps) {
    steps++;
    next -= fixed;
  }

  // backlog too large (the tab just came back) → drop it to avoid a spiral of death
  let dropped = 0;
  if (next >= fixed) {
    dropped = Math.floor(next / fixed);
    next = 0;
  }

  return { steps, acc: next, dropped };
}

/** Simulation steps per second from config (`fixed: 60` or `fixed: 1/60`). */
export function resolveFixed(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // 60 → 1/60 s; 0.016 → kept as is
  return n > 1 ? 1 / Math.min(240, n) : n;
}
