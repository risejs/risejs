/**
 * Boots every sample game in Node (fake DOM + fake renderer): build() must not throw and a few frames must run.
 *   node --import ./scripts/css-stub-register.mjs scripts/test-games.mjs
 * Catches "the game does not start" bugs (e.g. build() reading app.player before it exists) that pure logic tests miss.
 * Does not replace the real-browser smoke tests (npm run test:e2e).
 */
import { readdirSync, existsSync } from 'node:fs';
import { installDom, fakeRenderer, El } from './dom-stub.mjs';

// --- minimal stubs for the browser APIs the sample games use (not what is under test) ---
// A proxy that swallows everything: any call, read or write works and returns itself. Used for the 2D canvas and Web Audio.
function sink() {
  const fn = function () {};
  const p = new Proxy(fn, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k === 'data') return new Uint8ClampedArray(4);
      if (k === 'width' || k === 'height' || k === 'currentTime' || k === 'sampleRate' || k === 'length') return 1;
      if (k === 'state') return 'running';
      if (!(k in t)) t[k] = sink();
      return t[k];
    },
    set: (t, k, v) => ((t[k] = v), true),
    apply: () => sink(),
    construct: () => sink(),
  });
  return p;
}
El.prototype.getContext = function (kind) {
  return kind === '2d' ? sink() : null;
};
El.prototype.insertAdjacentHTML ??= function () {};
if (!('dataset' in El.prototype)) {
  Object.defineProperty(El.prototype, 'dataset', {
    get() {
      return (this._dataset ??= {});
    },
  });
}
El.prototype.toDataURL ??= () => 'data:,';
function browserStubs() {
  window.AudioContext = function () {
    return sink();
  };
  globalThis.Image ??= class {
    set src(_v) {}
  };
}

const only = process.argv.slice(2);
const ids = readdirSync(new URL('../src/games/', import.meta.url)).filter((d) =>
  existsSync(new URL(`../src/games/${d}/index.js`, import.meta.url))
);

let pass = 0;
let fail = 0;
const errors = [];
const origError = console.error;

for (const id of ids) {
  if (only.length && !only.includes(id)) continue;
  installDom();
  browserStubs();
  const logged = [];
  console.error = (...a) => logged.push(a.map((x) => x?.stack || String(x)).join(' '));
  let app = null;
  try {
    const { createApp } = await import('../src/rise/app.js');
    const game = (await import(`../src/games/${id}/index.js`)).default;
    const r = fakeRenderer();
    app = await createApp({ game, renderer: r });
    app.start();
    for (let i = 0; i < 5; i++) r.loop?.(performance.now() + i * 16);
    if (logged.length) throw new Error('console.error:\n      ' + logged.join('\n      '));
    app.destroy();
    app.destroy();
    pass++;
    console.log(`  ✓ ${id}: build + 5 frame + destroy`);
  } catch (err) {
    fail++;
    const msg = String(err?.stack || err).split('\n').slice(0, 4).join('\n    ');
    errors.push(id);
    console.log(`  ✗ ${id}\n    ${msg}`);
    try { app?.destroy(); } catch {}
  } finally {
    console.error = origError;
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
