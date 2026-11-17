import { createApp } from './rise/index.js';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

/*
 * Demo shell (not part of the package). The framework does not read the URL; this shell reads it and passes values to createApp.
 *  - `?game=<id>`: picks a sample game. Demo navigation only; the id must match an existing module.
 *  - Every other parameter (lang, seed, bench, weather, replay, dev, debug, shot, nopause, fixed…) exists ONLY under
 *    `npm run dev`. Production builds ignore them entirely, so players cannot interfere through the URL.
 */
const query = new URLSearchParams(location.search);
const dev = import.meta.env.DEV ? Object.fromEntries(query) : {};

const devConfig = {};
if ('shot' in dev) {
  devConfig.render = { preserveDrawingBuffer: true };
  devConfig.time = { ...devConfig.time, still: true };
}
if ('nopause' in dev) devConfig.time = { ...devConfig.time, autoPause: false };
if (dev.fixed) devConfig.time = { ...devConfig.time, fixed: Number(dev.fixed) };

createApp({
  modules: import.meta.glob('./games/*/index.js'),
  gameId: query.get('game') || 'city',
  locale: dev.lang || null,
  seed: dev.seed || null,
  config: devConfig,
  options: dev,
})
  .then(async (app) => {
    await app.start();
    const opt = app.options;

    // bench=1|10|20: measures real fps, lazy pack (dev only)
    if (opt.bench) {
      const seconds = Math.max(3, Math.min(60, Number(opt.bench) || 10));
      const { benchPlugin } = await import('./rise/packs/bench/index.js');
      app.use(benchPlugin, { seconds });
    }

    // weather=rain|snow · replay · dev · debug: all lazy, dev only
    if (opt.weather) {
      const { weatherPlugin } = await import('./rise/packs/weather/index.js');
      app.use(weatherPlugin);
      app.weather.set(opt.weather);
    }

    if ('replay' in opt) {
      const { replayPlugin } = await import('./rise/packs/replay/index.js');
      app.use(replayPlugin);
      app.replay.start();
    }

    if ('dev' in opt) {
      const { consolePlugin } = await import('./rise/packs/console/index.js');
      app.use(consolePlugin);
    }

    if ('debug' in opt) {
      const { debugPlugin } = await import('./rise/packs/debug/index.js');
      app.use(debugPlugin);
    }

    return app;
  })
  .catch((err) => {
    console.error(err);
    const box = document.createElement('div');
    box.id = 'fatal';
    box.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:99;padding:12px 16px;font:12px/1.5 ui-monospace,monospace;' +
      'color:#ffb4a8;background:rgba(40,8,4,.92);white-space:pre-wrap;max-height:45%;overflow:auto';
    box.textContent = 'Rise could not start:\n\n' + (err?.stack || err);
    document.body.appendChild(box);
  });
