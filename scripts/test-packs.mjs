/**
 * Teardown contract tests for the packs (Node, fake DOM + fake renderer, no WebGL):
 *   node --import ./scripts/css-stub-register.mjs scripts/test-packs.mjs
 *
 * For each pack: createApp → app.use(plugin) → a few frames → call the plugin dispose DIRECTLY (not through destroy)
 * → check window/document listeners, app.events listeners, timers, DOM nodes the pack attached, scene objects,
 * and that the app.<x> fields are back to their pre-install state → call dispose a second time (idempotent) → app.destroy() must not throw
 * and window/document listeners must be back at the level before createApp.
 */
import * as THREE from 'three';
import { installDom, fakeRenderer, El } from './dom-stub.mjs';

/* ---------------- small stubs used only by the pack tests ---------------- */

// live timers (to catch leaked setTimeout/setInterval)
const realTimers = { st: globalThis.setTimeout, ct: globalThis.clearTimeout, si: globalThis.setInterval, ci: globalThis.clearInterval };
const liveTimers = new Set();
globalThis.setTimeout = (fn, ms, ...a) => {
  const id = realTimers.st(() => {
    liveTimers.delete(id);
    fn(...a);
  }, ms);
  liveTimers.add(id);
  return id;
};
globalThis.clearTimeout = (id) => {
  liveTimers.delete(id);
  realTimers.ct(id);
};
globalThis.setInterval = (fn, ms, ...a) => {
  const id = realTimers.si(fn, ms, ...a);
  liveTimers.add(id);
  return id;
};
globalThis.clearInterval = (id) => {
  liveTimers.delete(id);
  realTimers.ci(id);
};
const sleep = (ms) => new Promise((res) => realTimers.st(res, ms));

// El: DOM functions the packs call that dom-stub does not provide
const QA = { '.touch-stick': 2, '.touch-knob': 2, '.touch-btn': 2 };
Object.assign(El.prototype, {
  insertAdjacentHTML() {
    this.appendChild(new El('svg', this.ownerDocument));
  },
  querySelectorAll(sel) {
    this._qa ??= {};
    return (this._qa[sel] ??= Array.from({ length: QA[sel] || 0 }, (_, i) => {
      const el = new El('div', this.ownerDocument);
      el.dataset.act = i ? 'jump' : 'crouch';
      return el;
    }));
  },
  setAttribute() {},
  removeAttribute() {},
  blur() {},
  click() {},
  pause() {},
  load() {},
  canPlayType: () => '',
  setPointerCapture() {},
  closest: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
});
Object.defineProperties(El.prototype, {
  lastElementChild: { get() { return this.children[this.children.length - 1] ?? null; } },
  firstChild: { get() { return this.children[0] ?? null; } },
  dataset: { get() { return (this._ds ??= {}); } },
});

// fake AudioContext: counts nodes, to check stop/disconnect/close
class FakeParam {
  constructor() { this.value = 0; }
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  cancelScheduledValues() {}
}
class FakeNode {
  constructor(kind, ctx) {
    this.kind = kind;
    this.ctx = ctx;
    this.stopped = 0;
    this.disconnected = 0;
    for (const k of ['frequency', 'gain', 'detune', 'Q', 'positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ']) this[k] = new FakeParam();
  }
  connect(n) { return n; }
  disconnect() { this.disconnected++; }
  start() {}
  stop() { this.stopped++; }
}
class FakeAudioContext {
  static all = [];
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'running';
    this.closed = false;
    this.nodes = [];
    this.destination = new FakeNode('destination', this);
    this.listener = new FakeNode('listener', this);
    FakeAudioContext.all.push(this);
  }
  resume() {}
  close() { this.closed = true; return Promise.resolve(); }
  createBuffer(_c, n) { return { getChannelData: () => new Float32Array(n) }; }
}
for (const [fn, kind] of [['createGain', 'gain'], ['createOscillator', 'osc'], ['createPanner', 'panner'], ['createBiquadFilter', 'filter'], ['createBufferSource', 'src']]) {
  FakeAudioContext.prototype[fn] = function () {
    const n = new FakeNode(kind, this);
    this.nodes.push(n);
    return n;
  };
}

// fake WebSocket: no network; close() fires 'close' asynchronously like a browser
class FakeWebSocket {
  static all = [];
  static OPEN = 1;
  constructor(url) {
    this.url = String(url);
    this.readyState = 0;
    this.closed = false;
    this.handlers = new Map();
    FakeWebSocket.all.push(this);
  }
  addEventListener(type, fn) { this.handlers.set(type, fn); }
  send() {}
  close() {
    if (this.closed) return;
    this.closed = true;
    queueMicrotask(() => this.handlers.get('close')?.());
  }
}

/* ---------------- khung test ---------------- */

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

function indexDom() {
  const dom = installDom();
  const d = dom.document;
  const mk = (tag, id, parent) => {
    const el = d.createElement(tag);
    el.id = id;
    return parent.appendChild(el);
  };
  const root = mk('div', 'app', d.body);
  mk('canvas', 'view', root);
  mk('div', 'ui', root);
  const boot = mk('div', 'boot', root);
  mk('div', 'boot-msg', boot);
  return dom;
}

const { createApp } = await import('../src/rise/app.js');
const base = (extra = {}) => ({ id: 'test', title: 'Test', build() {}, ...extra });
const eventCount = (app) => [...app.events.map.values()].reduce((n, s) => n + s.size, 0);
const nodeSet = (doc) => new Set([doc.body, ...doc.all()]);
const frames = async (r, n) => {
  for (let i = 0; i < n; i++) {
    await sleep(6);
    r.loop?.(performance.now());
  }
};
const mod = (p) => import(`../src/rise/packs/${p}`);

/**
 * Runs one pack.
 *   fields : app.<x> must be non-null after use() and null/undefined after dispose
 *   pre/act/post : hooks (pre before use, act after use + frames, post after dispose)
 *   ready  : emits 'app:ready' manually after installing (for packs that wait for it)
 *   expectNodes:false : the pack attaches no DOM (skips the "has nodes" check)
 */
async function runPack(c) {
  const { window, document } = indexDom();
  const A = { win: window.live, doc: document.live };
  const r = fakeRenderer();
  r.xr.setReferenceSpaceType = () => {};
  const app = await createApp({ game: base(), renderer: r });
  app.start();
  await frames(r, 1); // run past the first frame so core timers/events (app:ready, boot) do not leak into the baseline

  const plugin = (await mod(c.file))[c.fn];
  assert(typeof plugin === 'function', `missing export ${c.fn}`);
  c.pre?.(app);

  const B = {
    win: window.live,
    doc: document.live,
    ev: eventCount(app),
    scene: app.scene.children.length,
    nodes: nodeSet(document),
    timers: new Set(liveTimers),
  };

  let ret;
  app.use({ name: c.fn, install: (a, o) => (ret = plugin(a, o)) }, typeof c.opts === 'function' ? c.opts() : c.opts);
  if (c.ready) app.events.emit('app:ready', { app });
  for (const f of c.fields ?? []) assert(app[f], `app.${f} was not installed`);
  await frames(r, 3);
  await c.act?.(app, ret);
  await frames(r, 2);

  const added = [...nodeSet(document)].filter((n) => !B.nodes.has(n) && B.nodes.has(n.parentNode));
  if (c.expectNodes !== false) assert(added.length > 0, 'the pack attached no DOM node (the test cannot check node removal)');

  const dispose = typeof ret === 'function' ? ret : ret && typeof ret.dispose === 'function' ? () => ret.dispose() : null;
  assert(dispose, 'install returned no dispose (a function or an object with .dispose)');
  dispose();
  await c.afterDispose?.(app);
  assert(window.live === B.win, `window listener ${window.live} ≠ ${B.win}`);
  assert(document.live === B.doc, `document listener ${document.live} ≠ ${B.doc}`);
  assert(eventCount(app) === B.ev, `app.events listener ${eventCount(app)} ≠ ${B.ev}`);
  assert(app.scene.children.length === B.scene, `scene children ${app.scene.children.length} ≠ ${B.scene}`);
  for (const n of added) assert(!n.parentNode, `node <${n.tagName.toLowerCase()} class="${n.className}"> is still attached to the DOM`);
  for (const f of c.fields ?? []) assert(app[f] == null, `app.${f} was not reset`);
  const leaked = [...liveTimers].filter((t) => !B.timers.has(t));
  assert(!leaked.length, `${leaked.length} timers still alive`);
  dispose(); // idempotent
  await frames(r, 2); // the loop keeps running without calling into the removed pack
  await c.post?.(app, ret);

  app.destroy();
  assert(window.live === A.win, `after destroy: window listener ${window.live} ≠ ${A.win}`);
  assert(document.live === A.doc, `after destroy: document listener ${document.live} ≠ ${A.doc}`);
}

const fakeEntity = (x = 0, y = 0, z = -4) => ({ mesh: { position: new THREE.Vector3(x, y, z) }, pos: new THREE.Vector3(x, y, z), alive: true });
const key = (w, code, extra = {}) => w.dispatch('keydown', { code, stopImmediatePropagation() {}, stopPropagation() {}, ...extra });

/* ---------------- pack list ---------------- */

const cases = [
  { name: 'a11y', file: 'a11y/index.js', fn: 'a11yPlugin', fields: ['a11y'], act: (app) => app.a11y.set({ colorblind: 'protanopia', reduceMotion: true }), post: (app) => assert(!document.body.classList.contains('a11y-reduce-motion'), 'body class still set') },
  {
    name: 'audio3d',
    file: 'audio3d/index.js',
    fn: 'audio3dPlugin',
    fields: ['audio3d'],
    expectNodes: false,
    pre: () => (window.AudioContext = FakeAudioContext),
    act: (app) => assert(app.audio3d.playAt('hit', { x: 1, y: 0, z: 2 }), 'playAt'),
    post: (app) => {
      const panners = app.audio.ctx.nodes.filter((n) => n.kind === 'panner');
      assert(panners.length && panners.every((p) => p.disconnected > 0), 'panner not disconnected');
    },
  },
  { name: 'bakes', file: 'bakes/index.js', fn: 'bakesPlugin', fields: ['bakes'], expectNodes: false, act: (app) => app.bakes.add({ owner: 'w', work: (function* () { for (;;) yield; })(), commit() {} }) },
  { name: 'bench', file: 'bench/index.js', fn: 'benchPlugin', fields: ['bench'], act: () => key(window, 'F2') },
  { name: 'chat', file: 'chat/index.js', fn: 'chatPlugin', fields: ['chat'], act: () => key(window, 'KeyT') },
  {
    name: 'combat',
    file: 'combat/index.js',
    fn: 'combatPlugin',
    fields: ['combat'],
    act: (app) => {
      app.combat.register(fakeEntity(), { hp: 30 });
      app.combat.register(fakeEntity(2, 0, -5), { hp: 30 });
    },
  },
  { name: 'console', file: 'console/index.js', fn: 'consolePlugin', fields: ['console'], act: () => key(window, 'Backquote') },
  {
    name: 'debug',
    file: 'debug/index.js',
    fn: 'debugPlugin',
    fields: ['debug'],
    act: (app) => {
      key(window, 'F6');
      app.debug.showNav({ rows: 2, cols: 2, cell: 1, isBlocked: () => true, toWorld: (c, r) => ({ x: c, z: r }) });
    },
  },
  { name: 'dialogue', file: 'dialogue/index.js', fn: 'dialoguePlugin', fields: ['dialogue'], act: (app) => app.dialogue.start({ intro: { speaker: 'A', text: 'hi', choices: [{ label: 'ok' }] } }, 'intro') },
  { name: 'editor', file: 'editor/index.js', fn: 'editorPlugin', fields: ['editor'], ready: true, expectNodes: false, act: () => key(window, 'KeyS', { ctrlKey: true }) },
  {
    name: 'editor2d',
    file: 'editor2d/index.js',
    fn: 'editor2dPlugin',
    fields: ['editor2d'],
    opts: () => ({ texture: new THREE.Texture(), cols: 2, rows: 2, data: [[0, 1], [1, 0]] }),
    act: () => key(window, 'Digit2'),
  },
  { name: 'fmv', file: 'fmv/index.js', fn: 'fmvPlugin', fields: ['fmv'], opts: { scenes: { intro: { title: 't', duration: 5, subs: [{ t: 0, text: 'hi' }], choices: [{ at: 0.01, label: 'x', next: null }], next: null } }, start: 'intro' } },
  { name: 'grid', file: 'grid/index.js', fn: 'gridPlugin', fields: ['grid'], expectNodes: false },
  {
    name: 'inventory',
    file: 'inventory/index.js',
    fn: 'inventoryPlugin',
    fields: ['inventory', 'interaction'],
    act: (app) => {
      app.inventory.add({ id: 'a', name: 'A' }, 2);
      app.interaction.add(fakeEntity(), { label: 'x' });
    },
  },
  { name: 'lobby', file: 'lobby/index.js', fn: 'lobbyPlugin', fields: ['lobby'], pre: () => (globalThis.fetch = () => new Promise(() => {})), act: () => key(window, 'KeyL') },
  {
    name: 'loot',
    file: 'loot/index.js',
    fn: 'lootPlugin',
    fields: ['loot'],
    expectNodes: false,
    act: (app) => {
      app.loot.spawnAt({ x: 0, y: 0, z: 3 });
      app.loot.spawnAt({ x: 0, y: 0, z: 4 });
      assert(app.loot.count === 2, 'drop');
    },
    post: (app, api) => assert(api.count === 0, 'drops not cleared'),
  },
  {
    name: 'music (own ctx)',
    file: 'music/index.js',
    fn: 'musicPlugin',
    fields: ['music'],
    expectNodes: false,
    pre: () => (window.AudioContext = FakeAudioContext),
    act: (app) => {
      app.music.play('calm');
      app._ctx = FakeAudioContext.all.at(-1);
    },
    post: (app) => {
      assert(app._ctx.closed, 'the AudioContext created by the pack was not closed');
      assert(app._ctx.nodes.filter((n) => n.kind === 'osc').every((n) => n.stopped > 0), 'oscillator not stopped');
    },
  },
  {
    name: 'music (uses the app.audio ctx)',
    file: 'music/index.js',
    fn: 'musicPlugin',
    fields: ['music'],
    expectNodes: false,
    pre: (app) => {
      window.AudioContext = FakeAudioContext;
      app.audio.unlock();
    },
    act: (app) => app.music.play('calm'),
    post: (app) => assert(!app.audio.ctx.closed, 'must not close the app.audio ctx'),
  },
  {
    name: 'nameplate',
    file: 'nameplate/index.js',
    fn: 'nameplatePlugin',
    fields: ['nameplates'],
    act: (app) => app.nameplates.add(fakeEntity(), { name: 'Guide' }),
    post: (app, api) => assert(api.items.size === 0, 'items not cleared'),
  },
  {
    name: 'net',
    file: 'net/index.js',
    fn: 'netPlugin',
    fields: ['net', 'netChat'],
    ready: true,
    opts: { url: 'ws://127.0.0.1:1/ws' },
    pre: () => {
      FakeWebSocket.all.length = 0;
      globalThis.WebSocket = FakeWebSocket;
    },
    act: (app) => {
      assert(FakeWebSocket.all.length === 1, 'socket not opened');
      app.net.onSnapshot({ tick: 1, players: [{ nid: 7, x: 1, y: 0, z: 1, yaw: 0 }] });
      app._peers = app.world.entities.filter((e) => e.tags?.has?.('remote'));
      assert(app._peers.length === 1, 'peer not created');
      key(window, 'KeyT');
    },
    post: async (app) => {
      assert(FakeWebSocket.all[0].closed, 'socket not closed');
      assert(app._peers.every((e) => !app.world.entities.includes(e)), 'peer not removed from the world');
      await sleep(1000); // > first backoff (800 ms): must not reconnect
      assert(FakeWebSocket.all.length === 1, 'socket reconnected after dispose');
    },
  },
  { name: 'quest', file: 'quest/index.js', fn: 'questPlugin', fields: ['quests', 'dialogue'], act: (app) => app.quests.add({ id: 'q', title: 'T', steps: [{ id: 's', text: 'x', need: 1 }] }) },
  { name: 'replay', file: 'replay/index.js', fn: 'replayPlugin', fields: ['replay'], expectNodes: false, act: (app) => { app.replay.start(); assert(app.replayRecording, 'recording'); }, post: (app) => assert(!('replayRecording' in app), 'replayRecording still set') },
  { name: 'sideview (ortho)', file: 'sideview/index.js', fn: 'sidePlugin', fields: ['side', 'sideCamera'], expectNodes: false, pre: (app) => (app._cam0 = app.camera), post: (app) => assert(app.camera === app._cam0, 'camera not restored') },
  { name: 'sideview (perspective)', file: 'sideview/index.js', fn: 'sidePlugin', fields: ['side', 'sideCamera'], expectNodes: false, opts: { ortho: false }, pre: (app) => (app._fov = app.camera.fov), post: (app) => assert(app.camera.fov === app._fov, 'fov not restored') },
  { name: 'telemetry', file: 'telemetry/index.js', fn: 'telemetryPlugin', fields: ['telemetry'], expectNodes: false, opts: { flushMs: 100000 } },
  { name: 'touch', file: 'touch/index.js', fn: 'touchPlugin', fields: ['touch'], opts: { force: true }, act: (app) => assert(app.input.touch, 'input.touch'), post: (app) => assert(app.input.touch == null, 'input.touch not reset') },
  { name: 'tween', file: 'tween/index.js', fn: 'tweenPlugin', fields: ['tween'], expectNodes: false, act: (app) => app.tween.to({ from: 0, to: 1, duration: 5 }), post: (app, api) => assert(api.size === 0, 'tween not cleared') },
  {
    name: 'vfx',
    file: 'vfx/index.js',
    fn: 'vfxPlugin',
    fields: ['vfx'],
    act: (app) => {
      app._mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ emissive: 0x112233 }));
      app.vfx.burst({ x: 0, y: 1, z: -3 }, { count: 6 });
      app.vfx.damage({ x: 0, y: 0, z: -3 }, 12);
      app.vfx.hitFlash(app._mesh);
    },
    post: (app) => assert(app._mesh.material.emissive.getHex() === 0x112233, 'emissive not restored'),
  },
  { name: 'vn', file: 'vn/index.js', fn: 'vnPlugin', fields: ['vn'], act: (app) => app.vn.start({ start: 'a', nodes: { a: { speaker: 'X', text: 'hello', choices: [{ label: 'c', next: null }] } } }) },
  {
    name: 'weather',
    file: 'weather/index.js',
    fn: 'weatherPlugin',
    fields: ['weather'],
    expectNodes: false,
    pre: (app) => ((app._sunI = app.lights.sun.intensity), (app._sunY = app.lights.sun.position.y)),
    act: (app) => app.weather.set('rain'),
    afterDispose: (app) => assert(app.lights.sun.intensity === app._sunI && app.lights.sun.position.y === app._sunY, 'sun not restored'),
  },
  { name: 'xr (no secure context)', file: 'xr/index.js', fn: 'xrPlugin', fields: ['xr'] },
  {
    name: 'xr (secure, no navigator.xr)',
    file: 'xr/index.js',
    fn: 'xrPlugin',
    fields: ['xr'],
    pre: () => (globalThis.isSecureContext = true),
    act: (app) => assert(app.renderer.xr.enabled === true, 'xr.enabled'),
    post: (app) => {
      delete globalThis.isSecureContext;
      assert(app.renderer.xr.enabled === false, 'renderer.xr.enabled not restored');
    },
  },
  { name: 'npc', file: 'npc/index.js', fn: 'npcPlugin', fields: ['spawnNpc'], expectNodes: false },
  { name: 'sprite2d', file: 'sprite2d/index.js', fn: 'sprite2dPlugin', fields: ['sprite2d'], expectNodes: false, opts: { follow: () => 0 }, pre: (app) => (app._cam0 = app.camera), post: (app) => assert(app.camera === app._cam0, 'camera not restored') },
  { name: 'stats', file: 'stats/index.js', fn: 'statsPlugin', fields: ['stats'], expectNodes: false },
  { name: 'prefabs', file: 'prefabs/index.js', fn: 'prefabsPlugin', fields: ['prefabs'], expectNodes: false },
  { name: 'persistence', file: 'persistence/index.js', fn: 'persistencePlugin', fields: ['remote'], expectNodes: false, opts: { base: 'http://127.0.0.1:1' } },
  { name: 'assets', file: 'assets/index.js', fn: 'assetsPlugin', fields: ['assets'], expectNodes: false },
];

console.log('pack teardown');
for (const c of cases) await test(c.name, () => runPack(c));

// lobby: an in-flight fetch must be aborted on dispose
await test('lobby: a pending fetch is aborted on dispose', async () => {
  const { window } = indexDom();
  let signal = null;
  globalThis.fetch = (_u, o) => {
    signal = o?.signal;
    return new Promise((_res, rej) => signal?.addEventListener('abort', () => rej(new Error('abort'))));
  };
  const app = await createApp({ game: base(), renderer: fakeRenderer() });
  const { lobbyPlugin } = await mod('lobby/index.js');
  app.use(lobbyPlugin);
  key(window, 'KeyL');
  assert(signal && !signal.aborted, 'fetch not started');
  app.destroy();
  assert(signal.aborted, 'fetch not aborted');
});

// menu: created lazily through app.menu (not app.use) → the core calls menuInstance.dispose?.()
await test('lazy menu: destroy removes listeners and nodes', async () => {
  const { window, document } = indexDom();
  const A = { win: window.live, doc: document.live };
  const app = await createApp({ game: base(), renderer: fakeRenderer() });
  app.start();
  await app.menu.open('main');
  assert(app.menu.isOpen, 'menu not opened');
  const el = document.all().find((n) => String(n.className).startsWith('menu'));
  assert(el, 'no menu node yet');
  assert(window.live > A.win, 'menu attached no listeners');
  app.destroy();
  assert(!el.parentNode, 'menu node still present');
  assert(window.live === A.win && document.live === A.doc, `listener ${window.live}/${document.live} ≠ ${A.win}/${A.doc}`);
});

await test('fmv VideoLayer: dispose() removes the node and cleans up on app.destroy()', async () => {
  const { document } = indexDom();
  const app = await createApp({ game: base(), renderer: fakeRenderer() });
  const { VideoLayer } = await mod('fmv/video.js');
  const before = eventCount(app);
  const layer = new VideoLayer(app, { src: '/x.mp4' });
  const added = document.all().filter((n) => n.className === 'fmv-video');
  assert(added.length === 1 && added[0].parentNode, 'node not attached');
  assert(eventCount(app) === before + 1, 'app:destroy not registered');
  layer.dispose();
  layer.dispose();
  assert(!added[0].parentNode && eventCount(app) === before, 'dispose did not clean up');
  const layer2 = new VideoLayer(app, { src: '/y.mp4' });
  const el2 = document.all().find((n) => n.className === 'fmv-video');
  app.destroy();
  assert(!el2.parentNode && layer2.handlers.size === 0, 'app.destroy did not clean up a live VideoLayer');
});

await test('vfx/embers: userData.dispose removes it from the scene and disposes geometry/material', async () => {
  indexDom();
  const app = await createApp({ game: base(), renderer: fakeRenderer() });
  const { createEmbers } = await mod('vfx/embers.js');
  const n0 = app.scene.children.length;
  const e = createEmbers({ count: 20 });
  app.scene.add(e);
  let disposed = 0;
  e.geometry.addEventListener('dispose', () => disposed++);
  e.material.addEventListener('dispose', () => disposed++);
  e.userData.update(0.016, 1);
  e.userData.dispose();
  e.userData.dispose();
  assert(app.scene.children.length === n0 && disposed >= 2, `scene ${app.scene.children.length}/${n0}, disposed ${disposed}`);
  app.destroy();
});

/* ---------------- what is not (or need not be) tested ---------------- */

const SKIPPED = [
  ['xr: enter/exit session', 'needs real WebXR (navigator.xr.requestSession); only the install + dispose path is checked, no fake session'],
  ['fmv: real video playback', 'needs HTMLVideoElement + codecs; only VideoLayer teardown is checked with a fake element'],
  ['assets: texture()/gltf()', 'needs Image/GLTFLoader/WebGL; only install + dispose of the cache/fields is checked'],
  ['gltf', 'no plugin (pure loader/helper; GLTFLoader needs a browser)'],
  ['navmesh, physics, procgen, atlas, contracts, surface', 'no plugin: pure data classes/functions that attach nothing to the app'],
  ['tilemap, terrain, camera2d, triggers', 'no plugin: created by the game itself (terrain/sprite batch have their own dispose())'],
];
console.log('\nSKIPPED');
for (const [n, why] of SKIPPED) console.log(`  - ${n}: ${why}`);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
