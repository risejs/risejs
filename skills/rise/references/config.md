# Config

Full source: `docs/configuration.md` and `src/rise/config.js` (`DEFAULTS`).

## Merge order

```
DEFAULTS (src/rise/config.js)
  ← game.config
    ← createApp({ config })      // passed in by the calling code
      ← PRESETS (applied last)   // game.config.preset = { camera, crosshair }
```

The final value is in `app.config`. Merging uses `deepMerge` (deep, non-mutating): declare only what you want to change.
The framework **never reads the URL**; `?fog=`, `?view=`… were removed (API_VERSION 2). The demo shell (`src/main.js`) reads only `?game=`
and, with `npm run dev`, passes a few dev flags (`nopause`, `shot`, `lang`, `seed`, `fixed`…) into `createApp`.

Free-form values outside the schema (server address, experimental flags) → `createApp({ options })`, then `app.options.x`
(a frozen object). Unknown keys in `config` produce a warning in dev (`validateConfig`).

Related exports: `DEFAULTS`, `deepMerge`, `resolveConfig`, `PRESETS`, `applyPresets`, `validateConfig`.

## Presets

```js
config: { preset: { camera: 'topdown', crosshair: 'none' }, player: { spawn: [0, 0, 6] } }
```

| Preset | Values |
|---|---|
| `camera` | `fps` · `tps` · `topdown` · `iso` |
| `crosshair` | `default` · `dot` · `none` |

## Main key groups

| Group | Commonly adjusted keys |
|---|---|
| `render` | `exposure`, `fog`, `fogColor`, `shadows`, `pixelRatioCap`, `antialias`, `fov`, `near`, `far` |
| `sky` | `zenith`, `horizon`, `ground`, `glow`, `glowStrength` |
| `lights` | `sun.position/intensity/color`, `fill`, `ambient`, `torch.enabled/intensity/distance` |
| `player` | `spawn`, `yaw`, `walk`, `run`, `jump`, `gravity`, `eye`, `height`, `radius`, `controller` (`'none'` turns off the FPS controller for 2D/2.5D), `view.mode/cycle`, `crouch.*`, `swim.*` |
| `hud` | `crosshair.*`, `objective.enabled`, `badge.enabled`, `stats.enabled`, `hint.{enabled,text}` |
| `input` | `binds.<action>` (array of key codes such as `KeyW`, `Mouse0`), `sensitivity` |
| `world` | `gravity` |
| `time` | `fixed` (0 = per frame; 60 = fixed step, deterministic), `maxSteps`, `autoPause`, `still` |
| `security` | `enabled`, `maxSpeed`, `maxStep`, `maxInputPerSec`, `bounds`, `maxDt` |
| `audio` | `enabled`, `volume` |

Palette/art direction (sky, fog, lighting) is content → put it in `game.config`; do not change `DEFAULTS` for one game.

## Example

```js
export default {
  id: 'canyon',
  config: {
    preset: { camera: 'tps' },
    render: { fog: 0.012, exposure: 1.2 },
    player: { spawn: [0, 0, 10], crouch: { mode: 'toggle' } },
    time: { fixed: 60 },
    input: { binds: { interact: ['KeyE', 'Mouse0'] } },
  },
};
```
