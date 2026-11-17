/** Pure frame statistics (no DOM), used by the bench pack and by Node tests. */
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

/**
 * @param {number[]} frameMs  duration of each frame (ms)
 * @returns {{frames:number,fps:number,p50:number,p95:number,worst1:number,jank:number}}
 */
export function summarizeFrames(frameMs = []) {
  const clean = frameMs.filter((v) => Number.isFinite(v) && v > 0);
  if (!clean.length) return { frames: 0, fps: 0, p50: 0, p95: 0, worst1: 0, jank: 0 };

  const sorted = [...clean].sort((a, b) => a - b);
  const total = clean.reduce((n, v) => n + v, 0);
  const avg = total / clean.length;

  // 1% low: average of the worst 1% of frames
  const worstCount = Math.max(1, Math.round(clean.length * 0.01));
  const worst = sorted.slice(-worstCount);

  return {
    frames: clean.length,
    fps: 1000 / avg,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    worst1: worst.reduce((n, v) => n + v, 0) / worst.length,
    jank: clean.filter((v) => v > 33.4).length / clean.length,
  };
}

/** Merges frame figures and renderer.info into a flat report. */
export function buildReport({ stats, info = {}, game = '', size = null, dpr = 1 } = {}) {
  const render = info.render || {};
  const memory = info.memory || {};
  return {
    game,
    fps: round(stats?.fps),
    p50: round(stats?.p50),
    p95: round(stats?.p95),
    worst1: round(stats?.worst1),
    jankPct: round((stats?.jank ?? 0) * 100),
    frames: stats?.frames ?? 0,
    drawCalls: render.calls ?? 0,
    triangles: render.triangles ?? 0,
    geometries: memory.geometries ?? 0,
    textures: memory.textures ?? 0,
    width: size?.width ?? 0,
    height: size?.height ?? 0,
    dpr: round(dpr, 2),
    at: new Date().toISOString(),
  };
}

function round(v, digits = 1) {
  if (!Number.isFinite(v)) return 0;
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

export function formatReport(r) {
  return [
    `${r.game || 'game'} — ${r.width}×${r.height} @${r.dpr}x`,
    `fps ${r.fps} (p50 ${r.p50} ms · p95 ${r.p95} ms · 1% low ${r.worst1} ms)`,
    `jank ${r.jankPct}% · ${r.frames} frame`,
    `draw call ${r.drawCalls} · triangle ${r.triangles}`,
    `geometry ${r.geometries} · texture ${r.textures}`,
  ].join('\n');
}
