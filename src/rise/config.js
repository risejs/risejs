/**
 * Default configuration of Rise.js.
 *
 * Merge order (later overrides earlier):
 *   DEFAULTS  ←  game.config  ←  createApp({ config })
 *
 * Every value can be set from the game module without changing the framework.
 */

export const DEFAULTS = {
  render: {
    exposure: 1.3,
    fog: 0.008,
    fogColor: null,
    shadows: true,
    pixelRatioCap: 2,
    antialias: true,
    fov: 74,
    near: 0.1,
    far: 700,
    // keeps the buffer so the canvas can be captured (dev tools); costs performance, so off by default
    preserveDrawingBuffer: false,
    // 'high-performance' (discrete GPU) | 'low-power' (integrated GPU, saves battery) | 'default'
    powerPreference: 'high-performance',
  },

  // Neutral sky colours; a game sets its own palette in config.sky
  sky: {
    zenith: '#0a1018',
    horizon: '#33414d',
    ground: '#0b0e12',
    glow: '#c8d8e8',
    glowStrength: 0.25,
  },

  lights: {
    sun: { position: [-26, 22, 40], intensity: 3.4, color: '#fff4e6' },
    fill: 1.6,
    fillSky: 0x8fa6bd,
    fillGround: 0x2b2f33,
    ambient: 0.9,
    ambientColor: 0x9fb2c4,
    rimColor: 0x9ab6d4,
    rimIntensity: 0.85,
    bounce: { color: '#ffe6c8', intensity: 6, position: [0, 2.5, 6] },
    torch: { enabled: true, intensity: 32, distance: 44, angle: 0.58, penumbra: 0.5, color: '#ffd9a8' },
  },

  player: {
    spawn: [0, 0, 6],
    yaw: 0,
    controller: 'fps',
    eye: 1.68,
    height: 1.82,
    radius: 0.36,
    walk: 4.1,
    run: 6.6,
    jump: 5.4,
    gravity: 17,
    view: {
      mode: 'fp',
      cycle: ['fp', 'tp'],
      distance: 3.6,
      height: 1.55,
      topdown: { height: 28, distance: 10, fov: 55 },
      fixed: { position: [0, 12, 20] },
    },
    crouch: {
      enabled: true,
      mode: 'hold', // 'hold' | 'toggle'
      eye: 1.05,
      height: 1.15,
      speed: 2.2,
      key: 'ControlLeft',
      toggleKey: 'KeyC',
    },
    swim: { enabled: true, depth: -0.42, speed: 2.5, runSpeed: 3.4 },
  },

  hud: {
    crosshair: {
      enabled: true,
      style: 'cross', // 'cross' | 'dot' | 'none'
      size: 18,
      gap: 4,
      thickness: 1,
      color: null, // null follows the --rise-foreground CSS variable
      opacity: 0.75,
    },
    objective: { enabled: true, kicker: '', title: '', sub: '' },
    badge: { enabled: true },
    stats: { enabled: true },
    hint: { enabled: true, text: '' },
  },

  input: {
    binds: {
      forward: ['KeyW', 'ArrowUp'],
      back: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      run: ['ShiftLeft', 'ShiftRight'],
      jump: ['Space'],
      crouch: ['ControlLeft', 'KeyC'],
      view: ['KeyV'],
      pause: ['KeyP'],
      interact: ['KeyE'],
      inventory: ['KeyI'],
      slot1: ['Digit1'],
      slot2: ['Digit2'],
      slot3: ['Digit3'],
      slot4: ['Digit4'],
      slot5: ['Digit5'],
      slot6: ['Digit6'],
      slot7: ['Digit7'],
      slot8: ['Digit8'],
      reload: ['KeyR'],
      fire: ['Mouse0'],
      aim: ['Mouse2'],
      debug: ['F1'],
    },
    sensitivity: 0.0022,
  },

  world: {
    gravity: 17,
  },

  // 0 = variable per frame; 60 = fixed 1/60 s step (deterministic for replay and networking)
  time: {
    fixed: 0,
    maxSteps: 5,
    // auto-pause when the tab is hidden
    autoPause: true,
    // render exactly one frame, then stop (for check screenshots)
    still: false,
    // Resource limits. 0 = unlimited (runs at the display refresh rate: 60/120/144 Hz).
    // Can be changed at runtime: app.config.time.maxFps = 30
    maxFps: 0,
    // fps while the game is 'paused' (menu, hidden tab): no need to draw a still scene 60 times a second
    idleFps: 10,
    // fps when the window loses focus but the game keeps running. 0 = no reduction
    unfocusedFps: 0,
  },

  // Anomaly detection thresholds (client-side, see docs/anticheat.md)
  security: {
    enabled: true,
    maxSpeed: 12,
    maxStep: 3.5,
    maxInputPerSec: 160,
    bounds: 600,
    maxDt: 0.35,
  },

  audio: { enabled: true, volume: 0.45 },

  // globals: true → attaches window.__rise/__scene/__camera… in production too (dev only by default)
  debug: { globals: false },
};

/** Deep merge that does not mutate its inputs. */
export function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return patch === undefined ? base : clone(patch);
  }
  const out = isPlain(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (isPlain(v) && isPlain(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = clone(v);
  }
  return out;
}

function isPlain(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function clone(v) {
  return isPlain(v) ? deepMerge({}, v) : Array.isArray(v) ? v.slice() : v;
}

/** Shared presets, so a game declares one line instead of ten. */
export const PRESETS = {
  camera: {
    fps: { mode: 'fp', cycle: ['fp', 'tp'] },
    tps: { mode: 'tp', cycle: ['tp', 'fp'] },
    topdown: { mode: 'topdown', cycle: ['topdown', 'tp'], topdown: { height: 28, distance: 10, fov: 55 } },
    iso: { mode: 'iso', cycle: ['iso', 'tp'], distance: 22, height: 18 },
  },
  crosshair: {
    default: { enabled: true, style: 'cross', size: 18, gap: 4, thickness: 1 },
    dot: { enabled: true, style: 'dot', size: 8, thickness: 2 },
    none: { enabled: false },
  },
};

/** Applies presets. */
export function applyPresets(config) {
  const p = config.preset;
  if (!p) return config;
  if (p.camera && PRESETS.camera[p.camera]) {
    config.player.view = deepMerge(config.player.view, PRESETS.camera[p.camera]);
  }
  if (p.crosshair && PRESETS.crosshair[p.crosshair]) {
    config.hud.crosshair = deepMerge(config.hud.crosshair, PRESETS.crosshair[p.crosshair]);
  }
  delete config.preset;
  return config;
}

/** Returns the list of unknown keys; dev only. */
export function validateConfig(config, schema = DEFAULTS, path = '') {
  const unknown = [];
  for (const key of Object.keys(config)) {
    const full = path ? `${path}.${key}` : key;
    if (!(key in schema)) {
      unknown.push(full);
      continue;
    }
    const a = schema[key];
    const b = config[key];
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      unknown.push(...validateConfig(b, a, full));
    }
  }
  return unknown;
}

/**
 * Final configuration for a game: DEFAULTS ← game.config ← overrides (passed to createApp by code).
 * The framework does NOT read the URL: players cannot change config through a query string.
 */
export function resolveConfig(gameConfig = {}, overrides = null) {
  let merged = deepMerge(DEFAULTS, gameConfig);
  if (overrides && typeof overrides === 'object' && !(overrides instanceof URLSearchParams)) {
    merged = deepMerge(merged, overrides);
  }
  return applyPresets(merged);
}
