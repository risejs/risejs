# Pack catalog

Packs are opt-in: `app.use(xPlugin, opts)`, then call `app.<name>`. Original catalog and examples: `docs/packs.md`, `docs/recipes.md`.

Import: `import { xPlugin } from 'risejs-core/packs/<pack>'` (pure logic: `risejs-core/packs/<pack>/core`, if the pack has a `core.js`).
Inside the Rise repository, sample games import the same files by relative path (`../../rise/packs/<pack>/index.js`).
A pack with "—" in the plugin column is a pure library/class, used directly without `app.use`.

## UI and communication

| Pack | Plugin / export | Added to app | Notes |
|---|---|---|---|
| `menu` | `createMenu` | `app.menu` (the core loads it lazily) | pause/settings/rebind, P/Esc keys |
| `a11y` | `a11yPlugin` | `app.a11y.set({ colorblind, uiScale, reduceMotion })` | |
| `chat` | `chatPlugin` | `app.chat.send/open/ignore` | zone/all/DM channels, banned-word filter |
| `nameplate` | `nameplatePlugin` | `app.nameplates.add(entity,{name})`, `say` | |
| `lobby` | `lobbyPlugin` | `app.lobby.quickMatch()` | needs `net` |

## Gameplay

| Pack | Plugin / export | Added to app | Notes |
|---|---|---|---|
| `combat` | `combatPlugin` | `app.combat.register/hit/strike` | has `Health`, logic in `core.js` |
| `inventory` | `inventoryPlugin`, `InteractionSystem` | `app.inventory`, `app.interaction` | panel I |
| `quest` | `questPlugin` | `app.quests.add/progress`, `app.dialogue` | |
| `dialogue` | `dialoguePlugin`, `createDialogue` | `app.dialogue.start(graph, nodeId)` | |
| `vn` | `vnPlugin` | `app.vn.start(script)` | visual novel |
| `grid` | `gridPlugin`, `GridMover` | `app.grid` | cell-based movement |
| `npc` | `npcPlugin`, `NpcAgent` | `app.spawnNpc(opts)` | patrol / AI |
| `navmesh` | `NavGrid` | — | `findPath`, `blockBox` |
| `physics` | `Obb`, `Heightfield`, `Body`, `stepBody`, `Vehicle` | — | subpaths `physics/obb`, `physics/heightfield`, `physics/body` |
| `triggers` | `Triggers` | — (`sidePlugin` also attaches `app.triggers`) | enter/exit/once |
| `stats` | `statsPlugin` | `app.stats` | `Stats`, `Progression`, `StatusEffects` |
| `loot` | `lootPlugin` | `app.loot.roll/spawnAt/pickup` | `LootTable` |

## Rendering and content

| Pack | Plugin / export | Added to app | Notes |
|---|---|---|---|
| `sprite2d` | `sprite2dPlugin`, `SpriteBatch`, `SpriteAnimator` | `app.sprite2d` | subpath `sprite2d/sheet` |
| `tilemap` | `Tilemap`, `autotileVariant` | — | |
| `camera2d` | `Camera2D` | — | zoom/shake/pixel-perfect |
| `sideview` | `sidePlugin`, `SideController` | `app.side`, `app.sideCamera`, `app.triggers` | slopes, ladders, platforms |
| `gltf` | `preloadGltf`, `prefabFromGltf`, `collidersFromGltf`… | — | subpaths `gltf/manifest`, `gltf/loader-info`; lazy loader |
| `assets` | `assetsPlugin` | `app.assets.load/texture/audio/gltf` | cache with `retain/clean` |
| `terrain` | `Terrain`, `terrainLod` | — | subpath `terrain/heightmap` |
| `atlas` | `packAtlas`, `composePages`, `validatePages` | — | |
| `contracts` | (subpath) | — | `contracts/hash`, `contracts/diagnostics` |
| `bakes` | `bakesPlugin` | `app.bakes.add({ work, commit })` | heavy work split across frames |
| `weather` | `weatherPlugin` | `app.weather.set('rain'\|'snow')` | |
| `procgen` | (`core.js`) | — | import `risejs-core/packs/procgen` |
| `vfx` | `vfxPlugin`, `Particles`, `FloatText`, `HitFlash` | `app.vfx.burst/damage/hitFlash` | `createEmbers` is in `vfx/embers.js` |
| `surface` | `applySurfaceWear`, `attachSurfaceWear` | — | |
| `tween` | `tweenPlugin`, `EASING` | `app.tween.to({ from, to, duration, ease })` | |
| `music` | `musicPlugin` | `app.music.play/duck/stop` | |
| `audio3d` | `audio3dPlugin` | `app.audio3d.playAt(name, {x,y,z})` | HRTF |
| `prefabs` | `prefabsPlugin`, `PrefabRegistry` | `app.prefabs` | subpaths `prefabs/instances`, `prefabs/lod-group` |
| `fmv` | `fmvPlugin` | `app.fmv` | `VideoLayer`, `scenes` |

## Network, storage, platform

| Pack | Plugin / export | Added to app | Notes |
|---|---|---|---|
| `net` | `netPlugin`, `NetClient` | `app.net`, `app.netChat` | the server decides hits/loot |
| `persistence` | `persistencePlugin`, `RemoteSave` | `app.remote.auth/read/write/event` | D1 over HTTP |
| `touch` | `touchPlugin` | `app.touch` | joystick, turns on automatically on touch devices |
| `xr` | `xrPlugin` | `app.xr` | VR/AR |
| `telemetry` | `telemetryPlugin` | `app.telemetry.event(type, data)` | |

## Dev tools

| Pack | Plugin | Added to app | Notes |
|---|---|---|---|
| `bench` | `benchPlugin` | `app.bench` | fps p50/p95 |
| `console` | `consolePlugin` | `app.console` | `` ` `` key |
| `debug` | `debugPlugin` | `app.debug` | F6/F7/F8 |
| `replay` | `replayPlugin` | `app.replay.start/stop/load` | |
| `editor` | `editorPlugin` | `app.editor` | place/delete 3D objects |
| `editor2d` | `editor2dPlugin` | `app.editor2d` | paint tiles |

## Quick picks

- FPS/arena: `combat` + `npc` + `vfx` (+ `net`). RPG: `stats` + `loot` + `inventory` + `quest` + `dialogue`.
- 2D/2.5D: `sprite2d` + `tilemap` + `camera2d`, or `sideview`. Map generation: `procgen` (+ `bakes`).
- To be sure of names and signatures, read the pack source (`node_modules/risejs-core/src/rise/packs/<pack>/index.js`) and `docs/api-reference.md` before calling.
