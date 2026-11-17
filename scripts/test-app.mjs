/**
 * createApp lifecycle tests in Node (fake DOM + fake renderer, no WebGL):
 *   node --import ./scripts/css-stub-register.mjs scripts/test-app.mjs
 */
import * as THREE from 'three';
import { installDom, fakeRenderer, El } from './dom-stub.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    console.log(`  ✗ ${name}\n    ${err?.stack || err}`);
  }
}
function assert(cond, msg = 'assert') {
  if (!cond) throw new Error(msg);
}

/** DOM like index.html: #app > #view, #ui, #boot > #boot-msg */
function indexDom() {
  const dom = installDom();
  const d = dom.document;
  const mk = (tag, id, parent) => {
    const el = d.createElement(tag);
    el.id = id;
    return parent.appendChild(el);
  };
  const root = mk('div', 'app', d.body);
  const view = mk('canvas', 'view', root);
  const ui = mk('div', 'ui', root);
  const boot = mk('div', 'boot', root);
  mk('div', 'boot-msg', boot);
  return { ...dom, root, view, ui };
}

const { createApp } = await import('../src/rise/app.js');
const { definePlugin } = await import('../src/rise/plugin.js');
const { resolveConfig, validateConfig } = await import('../src/rise/config.js');

const baseGame = (extra = {}) => ({ id: 'test', title: 'Test', build() {}, ...extra });
const frames = (r, n) => {
  for (let i = 0; i < n; i++) r.loop?.(performance.now());
};

console.log('app lifecycle');

await test('boots with an injected renderer (skips the WebGL2 check) and the index.html DOM', async () => {
  const { view } = indexDom();
  const r = fakeRenderer();
  const app = await createApp({ game: baseGame(), renderer: r });
  assert(app.renderer === r, 'renderer inject');
  assert(r.count.compile === 1 && r.count.setSize >= 1, 'compile + resize');
  assert(app.input && app.input.canvas === view, 'Input is attached to the existing #view');
  app.start();
  assert(app.running && typeof r.loop === 'function', 'start sets the animation loop');
  frames(r, 5);
  assert(r.count.render === 5, `render 5 frame (got ${r.count.render})`);
  app.destroy();
});

await test('a renderer factory receives (canvas, cfg)', async () => {
  const { view } = indexDom();
  let got = null;
  const app = await createApp({
    game: baseGame(),
    renderer: (canvas, cfg) => {
      got = { canvas, cfg };
      return fakeRenderer();
    },
  });
  assert(got.canvas === view && got.cfg && typeof got.cfg.fov === 'number', 'factory args');
  app.destroy();
});

await test('footsteps: player on the ground with speed > 1.2 does not throw and calls app.audio.play("step")', async () => {
  indexDom();
  const r = fakeRenderer();
  const app = await createApp({ game: baseGame(), renderer: r, config: { player: { controller: 'none' } } });
  const played = [];
  app.audio.play = (name) => played.push(name);
  app.start();
  for (let i = 0; i < 6; i++) {
    app.player.onGround = true;
    app.player.vel.set(3, 0, 0);
    r.loop();
  }
  assert(played.filter((n) => n === 'step').length === 6, `step played ${played.length}`);
  app.destroy();
});

await test('footsteps through the real Input (fps controller, input.auto) do not throw', async () => {
  indexDom();
  const r = fakeRenderer();
  const app = await createApp({ game: baseGame(), renderer: r });
  let steps = 0;
  app.audio.play = (n) => n === 'step' && steps++;
  app.input.auto = { mx: 0, mz: 1 };
  app.start();
  for (let i = 0; i < 12; i++) {
    await new Promise((res) => setTimeout(res, 16));
    r.loop();
  }
  const speed = Math.hypot(app.player.vel.x, app.player.vel.z);
  assert(speed > 1.2, `player accelerates (speed ${speed.toFixed(2)})`);
  assert(steps > 0, 'footstep sound was played');
  app.destroy();
});

await test('plugins installed through the RETURNED app expose their fields on that same app; app.plugins is an array of names', async () => {
  indexDom();
  const app = await createApp({ game: baseGame(), renderer: fakeRenderer() });
  const ret = app.use(function inventoryPlugin(a) {
    a.inventory = { items: [] };
  });
  assert(ret === app, 'use() returns the app');
  assert(app.inventory && Array.isArray(app.inventory.items), 'app.inventory exists on the returned app');
  assert(app.audio && app.save, 'default audio/save plugins exist on the app');
  assert(app.plugins.join(',') === 'audio,save,inventoryPlugin', `plugins = ${app.plugins}`);
  app.destroy();
});

await test('setCamera is reflected on the returned app', async () => {
  indexDom();
  const r = fakeRenderer();
  const app = await createApp({ game: baseGame(), renderer: r });
  let used = null;
  r.render = (_s, cam) => (used = cam);
  const cam = new THREE.PerspectiveCamera();
  assert(app.setCamera(cam) === cam && app.camera === cam, 'app.camera changed');
  app.start();
  frames(r, 1);
  assert(used === cam, 'the frame renders with the new camera');
  app.destroy();
});

await test('installing a named plugin twice warns once and skips; anonymous functions are not blocked', async () => {
  indexDom();
  const app = await createApp({ game: baseGame(), renderer: fakeRenderer() });
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  let n = 0;
  const p = definePlugin('dup', () => {
    n++;
  });
  app.use(p).use(p).use(p);
  let anon = 0;
  app.use({ install: () => anon++ });
  app.use({ install: () => anon++ });
  console.warn = orig;
  assert(n === 1, `install ran ${n} times`);
  assert(warns.length === 1 && warns[0].includes('dup'), `warned ${warns.length} times`);
  assert(anon === 2, 'anonymous plugin installed twice');
  app.destroy();
});

await test('destroy: disposes plugins in REVERSE install order (function / object.dispose / definePlugin dispose)', async () => {
  indexDom();
  const order = [];
  const app = await createApp({
    game: baseGame({ destroy: () => order.push('game') }),
    renderer: fakeRenderer(),
  });
  app.use(function a() {
    return () => order.push('a');
  });
  app.use(definePlugin('b', () => {}, () => order.push('b')));
  app.use({ name: 'c', install: () => ({ dispose: () => order.push('c') }) });
  app.use({
    name: 'boom',
    install: () => () => {
      throw new Error('boom');
    },
  });
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  app.destroy();
  console.error = orig;
  assert(order.join(',') === 'game,c,b,a', `order = ${order}`);
  assert(errs.some((e) => e.includes('boom')), 'dispose errors are caught and logged');
});

await test('destroy: window/document/canvas listeners balance, core-created nodes are removed, the emitter is cleared', async () => {
  const { window, document, view, ui } = indexDom();
  const before = new Set(document.all());
  const r = fakeRenderer();
  const app = await createApp({ game: baseGame(), renderer: r });
  app.start();
  frames(r, 2);
  assert(window.adds > 0 && document.adds > 0 && view.adds > 0, 'listeners were attached');
  assert(document.all().length > before.size, 'the core created nodes (fade/debug)');
  let destroyEvt = 0;
  app.events.on('app:destroy', () => destroyEvt++);
  app.destroy();
  assert(window.adds === window.removes && window.live === 0, `window ${window.adds}/${window.removes}`);
  assert(document.adds === document.removes && document.live === 0, `document ${document.adds}/${document.removes}`);
  assert(view.adds === view.removes && view.live === 0, `canvas ${view.adds}/${view.removes}`);
  assert(document.all().every((n) => before.has(n)), 'no core-created nodes remain');
  assert(ui.children.length === 0 && ui.innerHTML === '', 'HUD and fade were removed from #ui');
  assert(destroyEvt === 1, 'emit app:destroy');
  assert(app.events.map.size === 0, 'the emitter was cleared');
  assert(r.loop === null && r.count.dispose === 1, 'the loop stopped and renderer.dispose was called');
  assert(app.running === false && app.destroyed === true, 'state');
});

await test('destroy twice is safe; start() after destroy is a no-op; use() after destroy is ignored', async () => {
  indexDom();
  const r = fakeRenderer();
  const app = await createApp({ game: baseGame(), renderer: r });
  app.destroy();
  app.destroy();
  assert(r.count.dispose === 1, 'renderer disposed exactly once');
  assert(app.start() === app && !app.running && r.loop === null, 'start no-op');
  let ran = false;
  app.use(() => (ran = true));
  assert(!ran, 'use after destroy does not install');
});

await test('no DOM present → creates canvas + ui in the body, destroy removes them', async () => {
  const { window, document } = installDom();
  const app = await createApp({ game: baseGame(), renderer: fakeRenderer() });
  const canvas = app.input.canvas;
  assert(canvas.tagName === 'CANVAS' && canvas.parentNode === document.body && canvas.id === 'view', 'canvas auto-created');
  assert(document.getElementById('ui') === app.hud.root, 'ui auto-created');
  app.destroy();
  assert(document.body.children.length === 0, `body still has ${document.body.children.length} nodes`);
  assert(window.live === 0 && document.live === 0 && canvas.live === 0, 'all listeners removed');
});

await test('mount / canvas / uiRoot injection: creates inside mount, leaves the body alone', async () => {
  const { document } = installDom();
  const mount = document.body.appendChild(new El('div', document));
  const app = await createApp({ game: baseGame(), renderer: fakeRenderer(), mount });
  assert(app.input.canvas.parentNode === mount && app.hud.root.parentNode === mount, 'created inside mount');
  assert(document.body.children.length === 1, 'body only contains mount');
  app.destroy();
  assert(mount.children.length === 0, 'mount is clean after destroy');

  const canvas = new El('canvas', document);
  const uiRoot = new El('div', document);
  const app2 = await createApp({ game: baseGame(), renderer: fakeRenderer(), canvas, uiRoot });
  assert(app2.input.canvas === canvas && app2.hud.root === uiRoot, 'uses the canvas/uiRoot that were passed in');
  app2.destroy();
  assert(canvas.live === 0 && uiRoot.children.length === 0, 'removes canvas listeners and the DOM inside uiRoot');
});

await test('window.__rise… globals only with config.debug.globals; destroy removes them', async () => {
  const { window } = indexDom();
  const a = await createApp({ game: baseGame(), renderer: fakeRenderer() });
  assert(!('__rise' in window) && !('__scene' in window), 'no globals attached by default');
  a.destroy();
  const b = await createApp({ game: baseGame(), renderer: fakeRenderer(), config: { debug: { globals: true } } });
  assert(window.__rise === b && window.__player === b.player && window.__city === b.world, 'attached when enabled');
  const cam = new THREE.PerspectiveCamera();
  b.setCamera(cam);
  assert(window.__camera === cam, '__camera follows setCamera');
  b.destroy();
  assert(!('__rise' in window) && !('__camera' in window), 'destroy removes the globals');
  assert(validateConfig(resolveConfig({ debug: { globals: true } })).length === 0, 'debug.globals is a valid key');
});

await test('loadLevel without buildEntity / game.onLevel / app.prefabs → clear error', async () => {
  indexDom();
  const app = await createApp({ game: baseGame(), renderer: fakeRenderer() });
  let msg = '';
  try {
    await app.loadLevel('/levels/x.json', { fade: false });
  } catch (err) {
    msg = err.message;
  }
  assert(msg.includes('loadLevel') && msg.includes('prefabs'), `msg = ${msg}`);
  app.destroy();
});

await test('visibilitychange hiding the tab → app.setState("paused") (no api.* left)', async () => {
  const { document } = indexDom();
  const app = await createApp({ game: baseGame(), renderer: fakeRenderer() });
  document.visibilityState = 'hidden';
  document.dispatch('visibilitychange');
  assert(app.state.is('paused'), 'paused');
  app.destroy();
});

await test('maxFps limits the frames drawn; idleFps applies while paused', async () => {
  indexDom();
  const r = fakeRenderer();
  const app = await createApp({ game: baseGame({ config: { time: { maxFps: 30, idleFps: 10 } } }), renderer: r });
  app.start();
  r.loop(0); // the first frame is always drawn
  const base = r.count.render;
  // 1 second at 120 Hz
  for (let i = 1; i <= 120; i++) r.loop(i * (1000 / 120));
  const drawn = r.count.render - base;
  assert(drawn >= 28 && drawn <= 31, `maxFps 30 → draws ~30 frames/second, actual ${drawn}`);

  app.setState('paused');
  const b2 = r.count.render;
  for (let i = 1; i <= 120; i++) r.loop(1000 + i * (1000 / 120));
  const idle = r.count.render - b2;
  assert(idle >= 9 && idle <= 11, `paused → ~10 frames/second, actual ${idle}`);

  // change at runtime: remove the limit
  app.setState('playing');
  app.config.time.maxFps = 0;
  const b3 = r.count.render;
  for (let i = 1; i <= 60; i++) r.loop(2000 + i * (1000 / 120));
  assert(r.count.render - b3 === 60, 'maxFps 0 → no frames skipped');
  app.destroy();
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
