# Game genres and Rise coverage

Rise does not assume an FPS. The core knows only: camera, input, world/entity, collision, HUD and the loop.
Each genre is a configuration of the axes below, plus one or more packs.

## Design axes

| Axis | In the core | Added by packs | Not available |
|---|---|---|---|
| Camera | `fp`, `tp`, `topdown`, `iso`, `fixed` | `camera2d`, `sideview` | orbit/cinematic camera, split-screen |
| Controls | action map (keyboard, mouse, gamepad), pointer lock, mouse drag | `touch` (virtual joystick), `menu` (key rebinding) | |
| Movement | first/third-person, top-down (camera-relative), swim, crouch, jump | `grid` (cell steps), `sideview`, `physics` (`Vehicle`) | climbing |
| Time | `GameState` (playing/paused), fixed step (`config.time.fixed`) | `replay` | slow motion, turn queue |
| Space | static world + entities, AABB, `SurfaceMap` | `physics` (`Obb`, `Heightfield`), `terrain`, `navmesh` | |
| Interaction | entity/tag/data, `input.justPressed('interact')` | `inventory`, `quest`, `dialogue`, `triggers` | |
| UI | HUD frame + API: crosshair, objective, badge, stats, hint | `menu`, `vn`, `chat`, `nameplate` | |
| Audio | `AudioBus` synth (ui/step/jump/hit/error) | `music`, `audio3d` | per-zone mixing |
| Storage | `SaveSlot` with HMAC signature and tamper detection | `persistence` (HTTP) | |
| Network | `net/zone.js` (interest management) | `net`, `lobby`, `chat`; see [networking](networking.md) | |
| Anti-cheat | `IntegrityGuard`, signed saves, input rate limit | server-side validation in the optional server example; see [anticheat](anticheat.md) | |

## Genre table

| Genre | What you configure | Sample game |
|---|---|---|
| First-person shooter | `view.mode='fp'`, crosshair on | `city`, `foundry` |
| Third-person | `view.mode='tp'`, `view.cycle=['fp','tp']` | `city` (press V) |
| Top-down shooter | `view.mode='topdown'`, crosshair optional | `arena` |
| Turn-based / tactics | `grid` pack (one cell per step) | `tactics` |
| 2.5D platformer | `sideview` pack + side camera | `side` |
| 2D platformer / top-down 2D | `sprite2d`, `tilemap`, `camera2d` packs | `game2d` |
| RPG | `inventory`, `quest`, `dialogue`, `stats`, `loot` packs | `rpg` |
| Roguelike | `procgen`, `navmesh`, `combat`, `loot` packs | `rogue` |
| Visual novel | `vn` pack | used inside `rpg` |
| Interactive video | `fmv` pack | `fmv` |
| VR / AR | `xr` pack + WebXR | none; not yet tested on headsets |
| Isometric | `view.mode='iso'` | none |
| Puzzle / fixed room | `view.mode='fixed'`, `triggers`, `inventory` | none |
| Horror | `fp` + `audio3d` + the flashlight (`lights.torch`) | none |
| Racing | `physics` pack (`Vehicle`, kinematic only) | none |
| RTS | not supported: there is no unit selection or order system | |
| Idle / clicker | out of scope: no 3D rendering needed | |

"None" means the pieces exist but no sample game exercises them together.


## Change genre with config

```js
// top-down
player: { view: { mode: 'topdown', cycle: ['topdown', 'tp'], topdown: { height: 26, distance: 9 } } }

// isometric
player: { view: { mode: 'iso', distance: 22, height: 18 } }

// fixed camera for a puzzle
player: { view: { mode: 'fixed', fixed: { position: [0, 14, 24] } } }
```

Movement stays camera-relative, so top-down uses WASD along the screen directions.

## Adding a new genre (for contributors)

1. **Do not add a sub-engine.** Add config plus at most one module in `src/rise/`.
2. **Do not fork the player.** If you need different movement, add a new `controller` next to `player.js`
   (for example `gridController.js`) and select it with `player.controller`.
3. **Do not put game rules in the core.** Rules belong in `games/<id>/tick`.
4. **Measure before generalizing.** Abstract only when at least 2 games use it.

## Packs by genre

| Pack | Genres that use it |
|---|---|
| `menu`, `a11y` | every genre |
| `inventory` + interaction | RPG, survival, puzzle |
| `quest` + `dialogue` | RPG, visual novel |
| `grid` | tactics, roguelike |
| `audio3d` | horror, immersive games |
| `net` + `chat` + `nameplate` + `lobby` | co-op, arena |
| `sprite2d` + `tilemap` + `camera2d` | platformer, 2D RPG |
| `sideview` + `triggers` | platformer, metroidvania |
| `npc` + `navmesh` | stealth, action RPG, sandbox |
| `physics` | sandbox, light racing, physics puzzles |
| `gltf` | any game that uses external models |
| `fmv` | interactive video |
| `xr` | AR/VR |
| `telemetry` + `bench` | operations, optimization |
| `editor`, `editor2d`, `prefabs` | authoring |

Details for each pack are in [recipes](recipes.md), [api](api.md) and [networking](networking.md).
