# Pack catalog

47 packs, all opt-in. Each one is imported from `risejs-core/packs/<name>` and most are installed with `app.use(plugin)`. The **Game** column lists the sample game that uses the pack
(empty = tested but no demo yet). The sample games live in the framework repository and run from its demo shell.

## UI and communication

| Pack | Main API | Game |
|---|---|---|
| `menu` | `app.menu.toggle()` · pause/settings/rebind, lazy | all (P/Esc) |
| `a11y` | `app.a11y.set({ colorblind, uiScale, reduceMotion })` | arena |
| `chat` | `app.chat.send/open/ignore` · zone/all/DM, banned-word filter | arena (when a server URL is given) |
| `nameplate` | `app.nameplates.add(entity,{name})` · `say(item,text,3)` | arena |
| `lobby` | `app.lobby.quickMatch()` · L opens, Q quick match | arena |

## Gameplay

| Pack | Main API | Game |
|---|---|---|
| `combat` | `app.combat.register/hit/strike` · `Health` | arena, rpg, rogue |
| `inventory` | `app.inventory.add/equip/bonus` · panel I, R equips | city, rpg |
| `quest` | `app.quests.add/progress` | city |
| `dialogue` | `app.dialogue.start(graph, nodeId)` | rpg (through quest in city) |
| `vn` | `app.vn.start(script)` · typewriter, backlog, auto/skip | rpg |
| `grid` | `GridMover` · step by cell | tactics |
| `npc` | `npcPlugin` → `app.spawnNpc`, `NpcAgent`, `Npc` | arena, city, foundry, rpg, rogue |
| `navmesh` | `NavGrid.findPath/blockBox` | rogue (through NPC) |
| `physics` | `Obb`, `Heightfield`, `Body`, `stepBody`, `Vehicle` | city, side |
| `triggers` | `Triggers` enter/exit/once | side |
| `stats` | `Stats`, `Progression`, `StatusEffects` | rpg |
| `loot` | `app.loot.roll/spawnAt/pickup` · `LootTable` | rpg, rogue |

## Rendering and content

| Pack | Main API | Game |
|---|---|---|
| `sprite2d` | `SpriteBatch`, `SpriteAnimator`, `parseSheet`, `clipTimeline` | game2d |
| `tilemap` | `Tilemap`, `applyAutotile` | game2d |
| `camera2d` | `Camera2D` zoom/shake/pixel-perfect | game2d (through sprite2d) |
| `sideview` | `SideController` · slopes, ladders, platforms | side |
| `gltf` | `loadAsset`, `validateManifest`, `budgetCheck`, `glbInfo`, lazy meshopt + KTX2 | city |
| `assets` | `app.assets.load/texture/audio/gltf`, `report/clean/retain` | — |
| `terrain` | `Terrain`, `decodeHeightmap`, `heightfieldFrom` | — |
| `atlas` | `packAtlas`, `composePages`, `validatePages` | — |
| `contracts` | `ok/fail`, `stableStringify`, `hashValue`, `sha256Hex` | gltf |
| `bakes` | `bakesPlugin`, `app.bakes.add({ work: gen(), commit })` | rogue |
| `weather` | `app.use(weatherPlugin)` · `app.weather.set('rain'\|'snow')` · `dayCycle` | — |
| `procgen` | `makeNoise`, `scatter`, `generateRooms`, `autotileMask` | rogue |
| `vfx` | `app.vfx.burst/damage/hitFlash`, `createEmbers` | arena, city, foundry, rpg, rogue |
| `surface` | `edgeWeights`, `applySurfaceWear`, `attachSurfaceWear` | city (crate) |
| `tween` | `app.tween.to({ from, to, duration, ease })` | arena |
| `music` | `app.music.play('calm'\|'tense')`, `duck`, `stop` | rpg, rogue |
| `audio3d` | `app.audio3d.playAt('hit', { x, y, z })` · PannerNode HRTF | city |

## Network and storage

| Pack | Main API | Game |
|---|---|---|
| `net` | `app.net.connect/send/fire/reload/loot/wallet` · prediction, binary snapshots, server-side hits and loot | arena (server URL via `options.net`) |
| `persistence` | `app.remote.auth/read/write/event` (D1) | — |

## Platform

| Pack | Main API | Game |
|---|---|---|
| `touch` | joystick + buttons, enabled automatically on touch devices; `app.use(touchPlugin, { force: true })` to force | arena, rpg… |
| `xr` | `app.use(xrPlugin, { mode: 'immersive-vr' \| 'immersive-ar' })`, AR-first | arena |
| `bench` | `app.use(benchPlugin, { seconds: 10 })` · fps p50/p95/1% low, draw calls | every game |
| `telemetry` | `app.telemetry.event(type, data)` | arena |

## Dev tools

| Pack | Main API | Game |
|---|---|---|
| `console` | `` ` `` opens · `help/tp/give/spawn/god/weather/time/level` via `app.use(consolePlugin)` | — |
| `debug` | `app.use(debugPlugin)` · F6 colliders · F7 stats · F8 navmesh | — |
| `replay` | `app.use(replayPlugin)` · `app.replay.start/stop/load` | — |
| `fmv` | `app.use(fmvPlugin,{scenes})` · `VideoLayer` | fmv |
| `editor` | place/delete/rotate, Ctrl+S/O, Ctrl+E/I export/import JSON | editor |
| `editor2d` | paint tiles, Ctrl+S/O | game2d |
| `prefabs` | `PrefabRegistry`, `buildInstanced`, `composeAnchor` | game2d, rogue |

## Conventions

- The API lives on `app.<name>`; events go through `app.events`.
- Pure logic lives in the pack's `core.js` so it can be tested with Node.
- For a new pack, see the checklist in [architecture.md](architecture.md).
