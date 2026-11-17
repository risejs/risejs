import * as THREE from 'three';
import './ui/hud.css';

import { resolveConfig, deepMerge, DEFAULTS } from './config.js';
import { Emitter } from './events.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player/player.js';
import { Character } from './player/character.js';
import { createHud } from './ui/hud.js';
import { GameState } from './state.js';
import { I18n } from './i18n.js';
import { Rng } from './rng.js';
import { hasWebGL2 } from './env.js';
import { IntegrityGuard } from './anticheat.js';
import { advance, resolveFixed } from './timestep.js';
import { flush } from './reactive.js';
import { validateConfig } from './config.js';
import { audioPlugin } from './plugins/audio.js';
import { savePlugin } from './plugins/save.js';
import { createRenderer, bindResize } from './render/renderer.js';
import { PALETTE, createSky, createLights } from './render/world-light.js';

/**
 * Rise.js: application setup.
 *
 *   const app = await createApp({ game });            // the consumer imports the game
 *   const app = await createApp({ modules, gameId }); // the app globs, the caller picks the game
 *
 * Other options: locale, seed, config (overrides game.config), options (→ app.options).
 * Nothing is read from the URL.
 *
 * DOM mounting / headless:
 *   canvas, uiRoot, mount: option → existing element (#view/#ui/#app) → created inside mount || body.
 *   renderer: a WebGLRenderer-like object or a factory (canvas, cfg) => renderer; when given,
 *              the WebGL2 check is skipped (Node tests, fake renderer).
 * Cleanup: app.destroy() stops the loop, disposes plugins (reverse install order) and removes the listeners and DOM the core created.
 *
 * A game module only needs: { id, title, config?, hud?, build(app), tick? }
 */
export async function createApp({
  gameId,
  game: gameInput = null,
  modules = null,
  locale = null,
  seed = null,
  config: configOverrides = null,
  options = {},
  canvas: canvasOpt = null,
  uiRoot: uiRootOpt = null,
  mount = null,
  renderer: rendererOpt = null,
} = {}) {
  // The framework does not read the URL. Every choice (game, locale, seed, config, options) is passed in by the calling code.
  const id = gameId || gameInput?.id || 'city';
  const appOptions = Object.freeze({ ...(options || {}) });

  // --- load the game module: an object first, then the glob passed by the caller ---
  let loaded = gameInput;
  if (!loaded) {
    const keys = modules ? Object.keys(modules) : [];
    const key = keys.find((k) => k.endsWith(`/${id}/index.js`) || k.endsWith(`/${id}.js`));
    if (!key) {
      const available = keys.map((k) => k.split('/').slice(-2)[0]).sort();
      throw new Error(`Could not load game "${id}". Available: ${available.join(', ') || '(none)'}.`);
    }
    loaded = (await modules[key]()).default;
  }

  const game = loaded;

  // --- config: defaults ← game ← createApp overrides ---
  const config = resolveConfig(game.config || {}, configOverrides);
  const i18n = new I18n({
    locale: locale || game.locale || config.locale || 'en',
    fallback: 'en',
    strings: game.strings || {},
  });
  config.hud.objective = i18n.translateDeep(deepMerge(config.hud.objective, game.hud || {}));

  if (import.meta.env?.DEV) {
    const unknown = validateConfig(config);
    if (unknown.length) console.warn('[rise] unknown config keys:', unknown.join(', '));
  }

  // --- cleanup: every listener and DOM node the core creates is registered here so destroy() removes it (reverse order) ---
  const disposables = [];
  const listen = (target, type, fn, opts) => {
    if (!target?.addEventListener) return () => {};
    target.addEventListener(type, fn, opts);
    const off = () => target.removeEventListener(type, fn, opts);
    disposables.push(off);
    return off;
  };
  const win = globalThis.window;
  const doc = globalThis.document;
  const own = (el, parent) => {
    parent.appendChild(el);
    disposables.push(() => el.parentNode?.removeChild(el));
    return el;
  };
  // --- mount: option → existing element → created (the id is only set when the page has none, so ui.css applies) ---
  const find = (id) => (mount ? mount.querySelector?.(`#${id}`) : doc?.getElementById?.(id)) || null;
  const host = mount || doc?.body;
  const make = (tag, id, parent) => {
    const el = doc.createElement(tag);
    if (!doc.getElementById?.(id)) el.id = id;
    el.className = `rise-${id}`;
    return own(el, parent);
  };
  let canvas = canvasOpt || find('view');
  if (!canvas) {
    canvas = make('canvas', 'view', host);
    canvas.tabIndex = 0;
  }
  const uiRoot = uiRootOpt || find('ui') || make('div', 'ui', host);
  const appRoot = mount || find('app') || canvas.parentNode || host;
  const boot = find('boot');
  const bootMsg = find('boot-msg');

  const events = new Emitter();

  let renderer;
  if (rendererOpt) {
    renderer = typeof rendererOpt === 'function' ? rendererOpt(canvas, config.render) : rendererOpt;
  } else {
    if (!hasWebGL2(doc)) {
      throw new Error(
        '[rise] This browser does not support WebGL2. Use a current Chrome/Edge/Firefox/Safari, or enable hardware acceleration.'
      );
    }
    renderer = createRenderer(canvas, config.render);
  }
  renderer.toneMappingExposure = config.render.exposure;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(config.render.fogColor || PALETTE.fog), config.render.fog);

  const camera = new THREE.PerspectiveCamera(
    config.render.fov,
    1,
    config.render.near,
    config.render.far
  );
  camera.rotation.order = 'YXZ';
  disposables.push(bindResize(renderer, camera));
  let activeCamera = camera;

  bootMsg && (bootMsg.textContent = 'Raising the sky');
  scene.add(createSky(config.sky));

  const lights = createLights(config.lights);
  scene.add(lights.sun, lights.fill, lights.rim, lights.bounce, lights.amb);

  const world = new World();
  scene.add(world.root);

  // HUD before build so the game can call setObjective inside build()
  const hud = createHud(uiRoot, config.hud);

  const state = new GameState('playing', events);

  // window.__rise… only in dev or when config.debug.globals === true
  const globals = !!(win && (import.meta.env?.DEV || config.debug?.globals === true));
  const GLOBALS = ['__rise', '__scene', '__camera', '__renderer', '__player', '__city'];
  const records = []; // { name, dispose } in install order
  const warned = new Set();
  let destroyed = false;
  let running = false;
  let input = null;

  /** The app object passed to game.build / game.tick */
  const app = {
    id,
    game,
    i18n,
    t: (key, vars) => i18n.t(key, vars),
    rng: new Rng(seed ?? game.seed ?? 1),
    seed: seed ?? game.seed ?? null,
    // free-form options passed by the code calling createApp({ options }); never taken from the URL
    options: appOptions,
    config,
    events,
    renderer,
    scene,
    camera,
    lights,
    world,
    hud,
    state,
    plugins: [],
    /**
     * Installs a plugin: an `install(app, options)` function or `{ name, install, dispose? }`.
     * install MAY return a dispose function (or an object with .dispose()). A duplicate name warns once and is skipped.
     */
    use(plugin, options) {
      const p = typeof plugin === 'function' ? { name: plugin.name || 'plugin', install: plugin } : plugin;
      if (!p || typeof p.install !== 'function') throw new Error('[rise] invalid plugin');
      if (destroyed) return app;
      const name = p.name || 'plugin';
      if (name !== 'plugin' && records.some((r) => r.name === name)) {
        if (!warned.has(name)) console.warn(`[rise] plugin "${name}" is already installed; skipping the duplicate`);
        warned.add(name);
        return app;
      }
      const rec = { name, dispose: null };
      const take = (ret) => {
        const fns = [];
        if (typeof ret === 'function') fns.push(ret);
        else if (ret && ret !== app && typeof ret.dispose === 'function') fns.push(() => ret.dispose());
        if (typeof p.dispose === 'function') fns.push(() => p.dispose(app));
        rec.dispose = fns.length ? () => fns.forEach((f) => f()) : null;
      };
      const ret = p.install(app, options);
      take(ret);
      if (typeof ret?.then === 'function') ret.then(take);
      records.push(rec);
      app.plugins.push(name);
      return app;
    },
    player: null,
    character: null,
    add: (entity) => world.add(entity),
    // installed by the `npc` pack: app.spawnNpc(opts)
    spawnNpc: null,
    setObjective: (o) => hud.setObjective(o),
    setCamera(next) {
      if (!next) return activeCamera;
      activeCamera = next;
      app.camera = next;
      if (globals) win.__camera = next;
      return next;
    },
    setState: (next) => {
      state.set(next);
      hud.setPaused(next === 'paused');
      return state.current;
    },
    async saveGame() {
      const data = game.snapshot ? game.snapshot(app) : { player: { pos: app.player?.pos.toArray() ?? null } };
      await app.save?.write(data);
      return data;
    },
    async loadGame() {
      const res = await app.save?.read();
      if (!res?.data) return null;
      if (game.restore) game.restore(res.data, app);
      else if (app.player && res.data.player?.pos) app.player.pos.fromArray(res.data.player.pos);
      return res.data;
    },
    /** Loads a level JSON (format v1) with a fade and the game.onLevel hook. */
    async loadLevel(url, { fade = true, buildEntity = null } = {}) {
      if (!game.onLevel && !buildEntity && typeof app.prefabs?.build !== 'function') {
        throw new Error('[rise] loadLevel needs game.onLevel, the buildEntity option, or the prefabs pack (app.use(prefabsPlugin)).');
      }
      if (fade) await app.fadeOut(0.2);
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`[rise] loadLevel ${res.status}: ${url}`);

      const { parseLevel, validateLevel, applyLevel } = await import('../shared/level.js');
      const level = parseLevel(await res.text());
      const check = validateLevel(level);
      if (!check.ok) throw new Error(`[rise] invalid level: ${check.errors.join('; ')}`);

      const count = game.onLevel
        ? game.onLevel(level, app)
        : applyLevel(app, level, { buildEntity: buildEntity || ((e, a) => a.add(a.prefabs.build(e))) });

      events.emit('level:loaded', { level, count, url });
      if (fade) await app.fadeIn(0.25);
      return level;
    },
    /** Fades the screen to black, then continues. */
    fadeOut(seconds = 0.25) {
      return new Promise((resolve) => {
        app.fade.classList.add('on');
        app.fade.style.transitionDuration = `${seconds}s`;
        setTimeout(resolve, seconds * 1000);
      });
    },
    fadeIn(seconds = 0.25) {
      return new Promise((resolve) => {
        app.fade.style.transitionDuration = `${seconds}s`;
        app.fade.classList.remove('on');
        setTimeout(resolve, seconds * 1000);
      });
    },
    log: (...a) => console.log('[rise]', ...a),
    input: null,
    get running() {
      return running;
    },
    start() {
      if (running || destroyed) return app;
      running = true;
      clock.getDelta();
      // setAnimationLoop works without XR too and switches to XR when a session starts
      renderer.setAnimationLoop(frame);
      events.emit('app:start');
      return app;
    },
    stop() {
      running = false;
      renderer.setAnimationLoop(null);
      events.emit('app:stop');
      return app;
    },
    /**
     * Destroys the app (idempotent): stop the loop → emit 'app:destroy' → game.destroy → dispose plugins (reverse) →
     * menu → Input → core listeners/DOM → HUD → entities → renderer → globals → clear the emitter.
     */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const safe = (fn, what) => {
        try {
          fn();
        } catch (err) {
          console.error(`[rise] destroy: ${what}`, err);
        }
      };
      if (running) safe(() => app.stop(), 'stop');
      events.emit('app:destroy', { app });
      safe(() => game.destroy?.(app), 'game.destroy');
      for (const r of records.splice(0).reverse()) if (r.dispose) safe(r.dispose, `plugin ${r.name}`);
      safe(() => {
        menuInstance?.dispose?.();
        menuInstance?.root?.parentNode?.removeChild(menuInstance.root);
      }, 'menu');
      safe(() => input?.dispose(), 'input');
      for (const off of disposables.splice(0).reverse()) safe(off, 'listener/DOM');
      safe(() => hud.dispose(), 'hud');
      safe(() => [...world.entities].forEach((e) => world.remove(e)), 'world');
      safe(() => renderer.dispose?.(), 'renderer');
      if (globals && win.__rise === app) for (const k of GLOBALS) delete win[k];
      app.plugins.length = 0;
      events.clear();
    },
    get destroyed() {
      return destroyed;
    },
  };

  bootMsg && (bootMsg.textContent = 'Building the world');
  app.fade = doc.createElement('div');
  app.fade.className = 'rise-fade';
  own(app.fade, uiRoot);

  // auto-pause when the tab loses focus (avoids lost progress and running in the background)
  listen(doc, 'visibilitychange', () => {
    if (doc.visibilityState !== 'hidden') return;
    if (config.time?.autoPause === false) return;
    if (state.is('playing')) app.setState('paused');
  });

  app.use(audioPlugin, config.audio);
  app.use(savePlugin, { gameId: id });

  // unlock audio on the first gesture
  const unlockAudio = () => app.audio?.unlock();
  listen(win, 'pointerdown', unlockAudio, { once: true });
  listen(win, 'keydown', unlockAudio, { once: true });

  // --- character + player: created BEFORE game.build so build() can use app.player / app.input ---
  const character = new Character({ color: config.player.color });
  scene.add(character.group);

  input = new Input(canvas, config.input);
  app.input = input;
  const player = new Player({
    camera,
    input,
    colliders: world.colliders,
    config: config.player,
    surfaceAt: (x, z) => world.surface.at(x, z),
    // lazy: game.build may attach world.heightfield after the player has been created
    heightAt: (x, z) => (world.heightfield ? world.heightfield.heightAt(x, z) : 0),
    character,
    events,
  });
  app.player = player;
  app.character = character;

  if (typeof game.build === 'function') await game.build(app);

  const guard = new IntegrityGuard({
    player,
    events,
    input,
    limits: config.security,
  });
  guard.enabled = config.security?.enabled !== false;
  app.anticheat = guard;

  // The menu is a lazy pack: it is only loaded the first time it opens (keeps the initial bundle small).
  let menuInstance = null;
  let menuLoading = null;
  const ensureMenu = () => {
    if (!menuInstance) {
      menuLoading ??= import('./packs/menu/index.js').then((mod) => {
        menuInstance = mod.createMenu({ app, root: uiRoot, config });
        return menuInstance;
      });
      return menuLoading;
    }
    return Promise.resolve(menuInstance);
  };

  app.menu = {
    open: (which) => ensureMenu().then((m) => m.open(which)),
    close: () => ensureMenu().then((m) => m.close()),
    toggle: () => ensureMenu().then((m) => m.toggle()),
    get isOpen() {
      return !!menuInstance?.isOpen;
    },
    get screen() {
      return menuInstance?.screen ?? 'main';
    },
    get settings() {
      return menuInstance?.settings;
    },
  };

  character.setVisible(player.rig.mode !== 'fp');

  // --- flashlight ---
  let torch = null;
  let torchTarget = null;
  if (config.lights.torch?.enabled !== false) {
    const t = config.lights.torch;
    torch = new THREE.SpotLight(new THREE.Color(t.color), t.intensity, t.distance, t.angle, t.penumbra, 1.2);
    torchTarget = new THREE.Object3D();
    torch.target = torchTarget;
    scene.add(torch, torchTarget);
  }

  /* ---------------- debug overlay (F1) ---------------- */
  const dbg = doc.createElement('div');
  dbg.style.cssText =
    'position:absolute;left:10px;bottom:10px;z-index:60;display:none;font:11px/1.5 ui-monospace,monospace;' +
    'color:#b8e6ff;background:rgba(4,8,12,.82);border:1px solid #2b3b4a;padding:6px 8px;white-space:pre;pointer-events:none';
  own(dbg, appRoot);
  let dbgOn = false;

  listen(doc, 'pointerlockchange', () => {
    hud.setHint(
      doc.pointerLockElement === canvas
        ? 'ESC RELEASE MOUSE · V CHANGE VIEW · C CROUCH · WASD MOVE'
        : 'CLICK TO LOCK MOUSE (OR DRAG) · V CHANGE VIEW · C CROUCH'
    );
  });
  listen(doc, 'pointerlockerror', () => {
    hud.setHint('POINTER LOCK BLOCKED · DRAG TO LOOK · V CHANGE VIEW · C CROUCH');
  });

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  const stillFrame = config.time?.still === true;
  let elapsed = 0;
  let firstFrame = true;
  let statTimer = 0;
  let raf = 0;
  let simFrames = 0;

  const fixedStep = resolveFixed(config.time?.fixed);
  const maxSteps = Math.max(1, Number(config.time?.maxSteps) || 5);
  let acc = 0;

  // Frame rate limit: skip the callback until enough time has passed. Config is read every frame, so it can change at runtime.
  let lastFrameAt = -Infinity;
  const frameCap = () => {
    if (renderer.xr?.isPresenting) return 0; // XR must run at the headset's rate
    const t = config.time || {};
    const caps = [Number(t.maxFps) || 0];
    if (state.is('paused')) caps.push(Number(t.idleFps) || 0);
    else if (Number(t.unfocusedFps) > 0 && doc.hasFocus && !doc.hasFocus()) caps.push(Number(t.unfocusedFps));
    const active = caps.filter((c) => c > 0);
    return active.length ? Math.min(...active) : 0;
  };

  function frame(now) {
    if (!running || destroyed) return;
    if (win?.__halt) return;

    const stamp = typeof now === 'number' ? now : performance.now();
    const cap = firstFrame ? 0 : frameCap();
    // -1.5 ms: avoids dropping a frame because of vsync jitter (e.g. a 30 cap on a 60 Hz display)
    if (cap > 0 && stamp - lastFrameAt < 1000 / cap - 1.5) return;
    lastFrameAt = stamp;

    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    elapsed += dt;
    statTimer += dt;
    simFrames++;

    input.poll();

    if (input.justPressed('debug')) {
      dbgOn = !dbgOn;
      dbg.style.display = dbgOn ? 'block' : 'none';
    }

    if (input.justPressed('pause')) app.menu.toggle();

    if (state.is('playing')) {
      if (fixedStep > 0) {
        const r = advance(acc, dt, fixedStep, maxSteps);
        acc = r.acc;
        for (let i = 0; i < r.steps; i++) {
          if (config.player.controller !== 'none') player.update(fixedStep);
          world.update(fixedStep, { player, app });
        }
        if (r.dropped) acc = 0;
      } else {
        if (config.player.controller !== 'none') player.update(dt);
        world.update(dt, { player, app });
      }

      game.tick?.(dt, app);
      guard.update(rawDt);
      events.emit('frame', dt);

      // footstep sound; AudioBus rate-limits it
      const speed = Math.hypot(player.vel.x, player.vel.z);
      if (player.onGround && speed > 1.2) app.audio?.play('step', { gain: Math.min(0.09, speed * 0.012) });
    }

    flush();

    if (torch) {
      const cp = Math.cos(player.pitch);
      torch.position.set(player.pos.x, player.pos.y + (player.crouched ? 1.05 : 1.35), player.pos.z);
      torchTarget.position.set(
        player.pos.x - Math.sin(player.yaw) * cp * 14,
        player.pos.y + (player.crouched ? 1.05 : 1.35) + Math.sin(player.pitch) * 14,
        player.pos.z - Math.cos(player.yaw) * cp * 14
      );
    }

    lights.bounce.intensity = (config.lights.bounce?.intensity ?? 6) + Math.sin(elapsed * 3.1) * 2.4 + Math.sin(elapsed * 7.7) * 1.1;
    lights.sun.intensity = (config.lights.sun?.intensity ?? 3) + Math.sin(elapsed * 0.4) * 0.15;

    hud.update(dt);
    if (statTimer > 0.25) {
      statTimer = 0;
      hud.setStats({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
      hud.setState({ mode: player.mode, surface: player.surface });
    }

    if (dbgOn) {
      dbg.textContent =
        `game  ${id}   view ${player.mode}   crouch ${player.crouched}\n` +
        `pos   ${player.pos.x.toFixed(2)} ${player.pos.y.toFixed(2)} ${player.pos.z.toFixed(2)}\n` +
        `surf  ${player.surface}   swim ${player.swimming}\n` +
        `stats calls ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles / 1000).toFixed(1)}k\n` +
        `entities ${world.entities.length}  colliders ${world.colliders.length}`;
    }

    renderer.render(scene, activeCamera);
    input.endFrame();

    if (firstFrame) {
      firstFrame = false;
      if (stillFrame && win) win.__halt = true;
      boot?.classList.add('done');
      setTimeout(() => boot?.remove(), 700);
      events.emit('app:ready', { app });
    }
  }

  renderer.compile(scene, activeCamera);
  if (globals) {
    // compatibility with older check scripts (dev / config.debug.globals only)
    Object.assign(win, { __rise: app, __scene: scene, __camera: camera, __renderer: renderer, __player: player, __city: world });
  }

  return app;
}

export { DEFAULTS };
