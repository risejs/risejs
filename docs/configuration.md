# Configuration

## Override order

```
DEFAULTS (src/rise/config.js)
   ← game.config (src/games/<id>/index.js)
      ← createApp({ config })   (optional, passed in by the calling code)
```

The framework **does not read the URL**. Config is a decision made by the game developer; players cannot change it with a
query string. The final value lives in `app.config`.

## Full reference

### render

| Key | Default | Meaning |
|---|---|---|
| `exposure` | `1.3` | ACES tone mapping exposure |
| `fog` | `0.008` | Fog density (FogExp2) |
| `shadows` | `true` | Enable shadow maps |
| `pixelRatioCap` | `2` | Cap on devicePixelRatio |
| `antialias` | `true` | MSAA |
| `fov` | `74` | Field of view |
| `near` / `far` | `0.1` / `700` | Camera clipping planes |

### sky

| Key | Default |
|---|---|
| `zenith` | `#0a0c10` |
| `horizon` | `#d9793a` |
| `ground` | `#160f0c` |

### lights

| Key | Default | Meaning |
|---|---|---|
| `sun.position` | `[-26, 22, 40]` | Sun direction |
| `sun.intensity` | `3.4` | Intensity |
| `sun.color` | `#ffc08a` | Sun color |
| `fill` | `1.6` | Hemisphere light |
| `ambient` | `0.9` | Ambient |
| `torch.enabled` | `true` | Flashlight attached to the character body |
| `torch.intensity` | `32` | Flashlight intensity |
| `torch.distance` | `44` | Flashlight range |

### player

| Key | Default | Notes |
|---|---|---|
| `spawn` | `[0,0,6]` | Starting position |
| `yaw` | `0` | Initial facing direction (radians) |
| `eye` | `1.68` | Eye height when standing |
| `height` | `1.82` | Collider height |
| `radius` | `0.36` | Collider radius |
| `walk` / `run` | `4.1` / `6.6` | Speed in m/s |
| `jump` | `5.4` | Jump velocity |
| `gravity` | `17` | Fall acceleration |
| `view.mode` | `'fp'` | `fp` / `tp` / `topdown` / `iso` / `fixed` |
| `view.cycle` | `['fp','tp']` | List cycled when pressing V |
| `view.distance` | `3.6` | Third-person camera distance |
| `view.height` | `1.55` | Third-person aim point height |
| `view.topdown` | `{height:28,distance:10,fov:55}` | Top-down camera parameters |
| `view.fixed` | `{position:[0,12,20]}` | Fixed camera |
| `crouch.enabled` | `true` | Allow crouching |
| `crouch.mode` | `'hold'` | `'hold'` holds the key, `'toggle'` presses to switch |
| `crouch.eye` | `1.05` | Eye height when crouching |
| `crouch.height` | `1.15` | Collider height when crouching |
| `crouch.speed` | `2.2` | Speed when crouching |
| `crouch.key` | `'ControlLeft'` | Default key |
| `crouch.toggleKey` | `'KeyC'` | Toggle key when mode is toggle |
| `swim.enabled` | `true` | Swim when entering a water zone |
| `swim.depth` | `-0.42` | Sink depth |
| `swim.speed` / `runSpeed` | `2.5` / `3.4` | Swim speed |

### security (client-side guard)

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Enable IntegrityGuard |
| `maxSpeed` | `12` | Speed threshold in m/s |
| `maxStep` | `3.5` | Maximum step per frame |
| `maxInputPerSec` | `160` | Input spam limit |
| `bounds` | `600` | Map bounds |
| `maxDt` | `0.35` | Time-anomaly threshold |

### audio

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Enable synth audio |
| `volume` | `0.45` | Volume |

### hud

| Key | Default | Notes |
|---|---|---|
| `crosshair.enabled` | `true` | Show/hide the crosshair |
| `crosshair.style` | `'cross'` | `'cross'` / `'dot'` / `'none'` |
| `crosshair.size` | `18` | Diameter (px) |
| `crosshair.gap` | `4` | Gap in the center |
| `crosshair.thickness` | `1` | Line thickness |
| `crosshair.color` | `null` | Any CSS color. When `null`, the crosshair uses the `--rise-foreground` CSS variable |
| `crosshair.opacity` | `0.75` | Opacity |
| `objective.enabled` | `true` | Objective block |
| `badge.enabled` | `true` | FP/TP + surface |
| `stats.enabled` | `true` | Draw calls/tris/FPS |
| `hint.enabled` | `true` | Hint line at the bottom |

### input

| Key | Default |
|---|---|
| `binds.forward` | `['KeyW','ArrowUp']` |
| `binds.back` | `['KeyS','ArrowDown']` |
| `binds.left` | `['KeyA','ArrowLeft']` |
| `binds.right` | `['KeyD','ArrowRight']` |
| `binds.run` | `['ShiftLeft','ShiftRight']` |
| `binds.jump` | `['Space']` |
| `binds.crouch` | `['ControlLeft','KeyC']` |
| `binds.view` | `['KeyV']` |
| `binds.pause` | `['KeyP']` |
| `binds.interact` | `['KeyE']` |
| `binds.reload` | `['KeyR']` |
| `binds.fire` | `['Mouse0']` |
| `binds.aim` | `['Mouse2']` |
| `binds.debug` | `['F1']` |
| `sensitivity` | `0.0022` |

AZERTY keyboards work: the physical keys still match `KeyW…`, and the letters `z/q` are accepted.

Mouse: `Mouse0` (left), `Mouse1` (middle), `Mouse2` (right). You can bind any action to the mouse,
for example `{ interact: ['KeyE', 'Mouse0'] }`.

## Presets

Instead of declaring 10 keys, use a preset and adjust only the differences:

```js
config: {
  preset: { camera: 'topdown', crosshair: 'none' },
  player: { spawn: [0, 0, 6] },
}
```

| Camera preset | Result |
|---|---|
| `fps` | `mode: fp`, cycle `[fp, tp]` |
| `tps` | `mode: tp`, cycle `[tp, fp]` |
| `topdown` | `mode: topdown`, height 28, distance 10, fov 55 |
| `iso` | `mode: iso`, distance 22, height 18 |

| Crosshair preset | Result |
|---|---|
| `default` | 18 px cross |
| `dot` | 8 px dot, thickness 2 |
| `none` | off |

Presets are applied last, on top of `game.config` and `createApp({ config })`.

## Resource limits (GPU / battery)

By default the game draws at the display refresh rate (60/120/144 Hz) and uses the discrete GPU. To go easier on the machine:

| Key | Default | Effect |
|---|---|---|
| `time.maxFps` | `0` (unlimited) | fps cap while playing. `30` cuts GPU load by about half compared to 60 |
| `time.idleFps` | `10` | fps when `paused` (menu, hidden tab) |
| `time.unfocusedFps` | `0` (off) | fps when the window loses focus but the game keeps running |
| `render.pixelRatioCap` | `2` | The number of pixels to draw grows with the square: `1` is up to 4x lighter than `2` on HiDPI screens |
| `render.shadows` | `true` | Turn off to skip the 2048² shadow map pass every frame |
| `render.antialias` | `true` | Turn off to skip MSAA |
| `render.powerPreference` | `'high-performance'` | `'low-power'` prefers the integrated GPU (laptops, battery saving) |

```js
config: { time: { maxFps: 60 }, render: { pixelRatioCap: 1.5 } }
// change at runtime, e.g. in a "Battery saver" menu:
app.config.time.maxFps = 30;
```

`maxFps`/`idleFps`/`unfocusedFps` are re-read every frame, so changing them at runtime takes effect immediately; the `render.*` keys are read only
at startup. The fps limit does not apply in XR sessions.

## No URL overrides

Since API_VERSION 2, `applyUrlOverrides` has been removed: `?fog=`, `?exposure=`, `?fov=`, `?shadows=`, `?view=`,
`?crosshair=`, `?crosshairStyle=`, `?stats=`, `?badge=`, `?objective=`, `?walk=`, `?run=`, `?spawn=`,
`?lang=`, `?seed=`, `?fixed=`, `?nopause`, `?shot` no longer have any effect in the framework.

To tweak quickly during development, pass values through code:

```js
createApp({
  game,
  locale: 'en',
  seed: 'abc',
  config: { render: { fog: 0.012 }, time: { fixed: 60, autoPause: false } },
  options: { net: 'ws://localhost:8787' },   // → app.options, the game reads it itself
});
```

The demo shell (`src/main.js`, not part of the package) reads only `?game=` to choose a sample game; the other dev
parameters work only in `npm run dev` (`import.meta.env.DEV`) and are ignored in the build.

## Overriding in a game

```js
export default {
  id: 'city',
  config: {
    render: { fog: 0.0068, exposure: 1.35 },
    player: { spawn: [0, 0, 10], crouch: { mode: 'toggle' } },
    hud: { crosshair: { enabled: false } },
  },
};
```

Declare only what you want to change — `deepMerge` keeps the rest.
