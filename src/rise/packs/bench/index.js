import './bench.css';
import { summarizeFrames, buildReport, formatReport } from './stats.js';
import { exportJson } from './export.js';
export { summarizeFrames, buildReport, formatReport };

/**
 * Bench pack: measures real frame rate on the player's GPU.
 *
 *   app.use(benchPlugin);                    // measures for 10 s, then shows a report
 *   app.use(benchPlugin, { seconds: 20 });   // measures for 20 s
 *   F2 show/hide · F3 run again · F4 download JSON
 */
export function benchPlugin(app, { seconds = 10, warmup = 1.5 } = {}) {
  const offs = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    offs.push(() => t.removeEventListener(type, fn, o));
  };
  const runOffs = () => {
    while (offs.length) {
      try {
        offs.pop()();
      } catch {}
    }
  };
  const el = document.createElement('div');
  el.className = 'bench';
  el.innerHTML = `
    <div class="bench-head">BENCH <span class="bench-state">…</span></div>
    <pre class="bench-body">starting</pre>
    <div class="bench-foot">F2 hide · F3 rerun · F4 JSON</div>
  `;
  app.hud.root.appendChild(el);

  const stateEl = el.querySelector('.bench-state');
  const bodyEl = el.querySelector('.bench-body');

  const frames = [];
  let elapsed = 0;
  let running = true;
  let report = null;

  const reset = () => {
    frames.length = 0;
    elapsed = 0;
    report = null;
    running = true;
    stateEl.textContent = `measuring ${seconds}s`;
    bodyEl.textContent = 'warmup…';
  };

  const finish = () => {
    running = false;
    const stats = summarizeFrames(frames);
    report = buildReport({
      stats,
      info: app.renderer?.info,
      game: app.game?.id || '',
      size: { width: app.renderer?.domElement?.width ?? 0, height: app.renderer?.domElement?.height ?? 0 },
      dpr: app.renderer?.getPixelRatio?.() ?? 1,
    });

    bodyEl.textContent = formatReport(report);
    stateEl.textContent = report.fps >= 58 ? 'OK' : report.fps >= 45 ? 'SLOW' : 'POOR';
    stateEl.dataset.verdict = report.fps >= 58 ? 'ok' : report.fps >= 45 ? 'warn' : 'bad';

    console.log('[bench]', report);
    app.events.emit('bench:done', report);
  };

  offs.push(app.events.on('frame', (dt) => {
    if (!running) return;
    elapsed += dt;
    if (elapsed < warmup) return;

    frames.push(dt * 1000);
    const spent = elapsed - warmup;
    if (spent < seconds) {
      stateEl.textContent = `${spent.toFixed(1)}/${seconds}s`;
      return;
    }
    finish();
  }));

  on(window, 'keydown', (e) => {
    if (e.code === 'F2') {
      e.preventDefault();
      el.classList.toggle('off');
    } else if (e.code === 'F3') {
      e.preventDefault();
      reset();
    } else if (e.code === 'F4' && report) {
      e.preventDefault();
      exportJson(`rise-bench-${report.game || 'game'}-${Date.now()}.json`, report);
    }
  });

  const api = {
    get report() {
      return report;
    },
    rerun: reset,
    hide: () => el.classList.add('off'),
    dispose() {
      runOffs();
      el.remove();
      if (app.bench === api) app.bench = null;
    },
  };

  app.bench = api;
  reset();
  return api;
}
