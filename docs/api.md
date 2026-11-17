# API overview

Exports of `risejs-core` and the main pack APIs. The generated list of every export is in [api-reference.md](api-reference.md).

## Initialization

| Export | Signature | Description |
|---|---|---|
| `createApp` | `({ game?, modules?, gameId?, locale?, seed?, config?, options?, canvas?, uiRoot?, mount?, renderer? }) => Promise<App>` | Creates the app; does not start the loop |
| `DEFAULTS` | object | Base configuration |
| `resolveConfig` | `(gameConfig, params) => config` | Merges config |
| `deepMerge` | `(base, patch) => object` | Deep merge |
| `PRESETS`, `applyPresets`, `validateConfig` | Presets + unknown-key check |

DOM / headless options of `createApp`:

| Option | Default | Description |
|---|---|---|
| `canvas` | existing `#view` → otherwise creates a `<canvas>` in `mount \|\| document.body` | Render + Input canvas |
| `uiRoot` | existing `#ui` → otherwise creates a `<div>` | Root for HUD, fade, menu |
| `mount` | — | Element that contains the app; when set, looks for `#view/#ui/#app/#boot` **inside** mount and creates them there |
| `renderer` | `WebGLRenderer` | A renderer-like object (`setAnimationLoop`, `render`, `compile`, `setSize`, `info`, `dispose?`) or a factory `(canvas, cfg) => renderer`. When given, the **WebGL2 check is skipped** (Node tests) |

`#boot` / `#boot-msg` are optional. An older `index.html` (`#app > #view + #ui + #boot`) works unchanged.
`window.__rise/__scene/__camera/__renderer/__player/__city` are attached only when `import.meta.env.DEV` or `config.debug.globals === true`.

### App

| Member | Type |
|---|---|
| `start()` / `stop()` | `() => App` — `start()` after `destroy()` is a no-op |
| `destroy()` | Destroys the app, idempotent (see below) |
| `running`, `destroyed` | boolean |
| `use(plugin, options)` | Installs a plugin; returns `app`. Installing the same name twice → warns once, ignored |
| `plugins` | array of installed plugin names |
| `input` | `Input` |
| `config` | object |
| `scene`, `camera`, `renderer` | three.js |
| `world` | `World` |
| `player` | `Player` |
| `hud` | HUD API |
| `events` | `Emitter` |
| `add(entity)` | `(Entity) => Entity` |
| `spawnNpc(opts)` | `(opts) => Npc`; set by the `npc` pack (`app.use(npcPlugin)`) |
| `setObjective(o)` | `(object) => void` |
| `menu` | Menu pack: `open(screen)`, `close()`, `toggle()`, `isOpen` (async) |
| `options` | object from `createApp({ options })` |

### `app.destroy()`

Order: stop the loop → emit `app:destroy` → `game.destroy?.(app)` → dispose plugins in **reverse** install order
(each in try/catch) → menu → `input.dispose()` → remove every core listener (window/document/canvas, resize)
and the DOM core created (fade, debug overlay, auto-created canvas/ui) → `hud.dispose()` → `world.remove()` for every entity →
`renderer.dispose?.()` → remove globals → `events.clear()`. A second call does nothing.

## World & Entity

| Export | Description |
|---|---|
| `World` | `setStatic`, `add`, `remove`, `query`, `update`, `surfaceAt`, `colliders`, `entities` |
| `Entity` | `{ mesh, tags, collider, data, alive, update(), dispose() }` |
| `box(opts)` | Box with a collider — `{ size, position, color, rotationY, tags, data, autoCollider }` |
| `cylinder(opts)` | Cylinder — `{ radius, height, position, color, segments, ... }` |
| `decor(mesh, opts)` | Decoration, no collider/shadow |
| `material(color, opts)` | Cached material |
| `SurfaceMap` | `rect(type,cx,cz,w,d)`, `circle(type,cx,cz,r)`, `at(x,z)` |
| `SURFACE` | `{ STREET, STONE, GRASS, WATER }` |

## Player & NPC

| Export | Description |
|---|---|
| `Player` | `update(dt)`, `toggleView()`, `pos`, `vel`, `yaw`, `pitch`, `mode`, `crouched`, `swimming`, `surface`, `height` |
| `CameraRig` | `setMode()`, `next()` — `fp` / `tp` / `topdown` / `iso` / `fixed` |
| `Character` | Procedural character: `setVisible(v)`, `update(dt, speed, heading, swimming, crouched)` |
| `Npc` | `new Npc({ path, speed, pause, color, name })` |

## Lifecycle, storage, anti-cheat, audio

| Export | Description |
|---|---|
| `GameState` | `set(state)`, `is(...)`, `state:change` event |
| `SaveSlot` | `read()`, `write(data)`, `clear()` — HMAC-signed |
| `IntegrityGuard` | `update(dt)`, `report()`, `flags` — detects anomalies |
| `AudioBus` | `play('ui'\|"step"\|"jump"\|"hit"\|"error")`, `unlock()`, `setVolume()` |
| `zoneKey`, `neighborKeys`, `inInterest`, `filterByInterest` | Interest management for multiplayer |

## Packs (opt-in, the game imports them)

| Pack | Export | Install with |
|---|---|---|
| Inventory | `inventoryPlugin`, `Inventory`, `InteractionSystem` | `app.use(inventoryPlugin, { capacity: 8 })` |
| Quest | `questPlugin`, `QuestLog` | `app.use(questPlugin)` |
| Grid | `gridPlugin`, `GridMover` | `app.use(gridPlugin, { cell: 3 })` |
| Audio 3D | `audio3dPlugin` | `app.use(audio3dPlugin)` (after audio) |
| Net | `netPlugin`, `NetClient` | `app.use(netPlugin, { url, room, map })` · `net.fire/reload/loot/wallet` |
| Persistence | `persistencePlugin`, `RemoteSave` | `app.use(persistencePlugin, { base, game, player })` |
| Touch | `touchPlugin` | `app.use(touchPlugin)` — enables itself on touch devices |
| Sideview | `sidePlugin`, `SideController` | `app.use(sidePlugin, { spawn: [0, 3] })` — requires `player.controller: 'none'` |
| Sprite2D | `sprite2dPlugin`, `SpriteBatch`, `SpriteAnimator`, `atlasUV`, `SortedSprites`, `parallaxOffset` | `app.use(sprite2dPlugin, { height: 14, follow })` |
| Tilemap | `Tilemap` | `new Tilemap({ texture, cols, rows, data, solids }).build()` |
| Prefabs | `prefabsPlugin`, `PrefabRegistry` | `app.use(prefabsPlugin)` then `app.prefabs.register(id, fn)` |
| Triggers | `Triggers` | `new Triggers(events); t.add({ id, box, once, onEnter })` |
| Camera2D | `Camera2D` | `new Camera2D(cam, { height, zoom, pixelPerfect, ppu })` + `shake()` |
| Editor2D | `editor2dPlugin` | `app.use(editor2dPlugin, { texture, cols, rows, data, solids })` |
| FMV | `fmvPlugin`, `Timeline`, `QTE`, `BranchGraph` | `app.use(fmvPlugin, { scenes, start })` |
| Chat | `chatPlugin`, `parseChat`, `RateLimiter` | `app.use(chatPlugin)` (requires net) |
| Nameplate | `nameplatePlugin`, `projectToScreen` | `app.use(nameplatePlugin)` + `app.nameplates.add(entity, { name })` |
| NPC | `npcPlugin`, `Npc`, `NpcAgent` | `app.use(npcPlugin)` → `app.spawnNpc({ path })`; `new NpcAgent({ nav })` |
| i18n | `I18n`, `app.t(key, vars)` | `new I18n({ locale, strings })`; HUD uses `'@key'` |
| glTF | `loadGltf`, `collidersFromGltf`, `mergeBoxes`, `registerGltfPrefab`, `attachAnimations` | `await registerGltfPrefab(app.prefabs, 'crate', url)` |
| Accessibility | `a11yPlugin`, `resolveA11y`, `a11yCss` | `app.use(a11yPlugin, { colorblind: 'protanopia', uiScale: 1.2 })` |
| Telemetry | `telemetryPlugin`, `TelemetryBuffer`, `summarize` | `app.use(telemetryPlugin, { url })`; `app.telemetry.event('x', {})` |
| Lobby | `lobbyPlugin`, `pickRoom`, `formatRooms` | `app.use(lobbyPlugin, { url })`; `app.lobby.quickMatch()` |
| Navmesh | `NavGrid` | `nav.findPath(from, to)`; `new NpcAgent({ nav })` |
| Physics lite | `Body`, `stepBody`, `Vehicle` | `stepBody(body, dt, { groundY })` |
| Chat filter | `maskWords`, `SpamGuard`, `IgnoreList` | `chatPlugin(app, { blocked, mask })` |
| FMV video | `VideoLayer`, `pickPlayback`, `activeCue`, `parseVtt` | `new VideoLayer(app, { src: 'a.m3u8', mp4: 'a.mp4', subtitle })` |
| Bench | `benchPlugin`, `summarizeFrames`, `buildReport`, `formatReport` | `app.use(benchPlugin, { seconds: 10 })`; `app.bench.report` |
| KV adapter | `getKv`, `memoryKv`, `bindingKv`, `httpKv` | `server`: `getKv(env)`; Redis/Postgres via `httpKv({ base })` |
| RNG | `Rng`, `mulberry32`, `hashSeed` | `app.rng.pick(list)`; `createApp({ seed })` |
| Tween | `tweenPlugin`, `Tweens`, `EASING`, `lerp` (pack `tween`) | `app.use(tweenPlugin)`; `app.tween.to({ from, to, duration, ease, onUpdate })` |
| Combat | `combatPlugin`, `Health`, `inMeleeArc`, `pickTarget` | `app.combat.register(npc, { hp })`; `app.combat.strike(player)` |
| VFX | `vfxPlugin`, `Particles`, `Pool`, `burst`, `createEmbers` | `app.vfx.burst(pos)`; `createEmbers({ count })` |
| Stats | `Stats`, `Progression`, `StatusEffects`, `xpForLevel` | `stats.get('str')`; `status.add({ id: 'burn', dot: 8 })` |
| Loot | `LootTable`, `rarityOf`, `RARITY`, `CRATE_LOOT` | `table.roll(app.rng, { luck: 0.2 })` |
| VN | `vnPlugin`, `Typewriter`, `paginate`, `EXPRESSIONS` | `app.vn.start({ start, nodes })` |
| Weather | `weatherPlugin`, `dayCycle`, `blendWeather` | `app.weather.set('rain')`; `app.weather.time = 0.4` |
| Procgen | `makeNoise`, `scatter`, `generateRooms`, `autotileMask` | `generateRooms(app.rng, { count: 6 })` |
| Replay | `replayPlugin`, `Recorder`, `Playback` | `app.replay.start()` / `.stop()` / `.load(json)` |
| Console | `consolePlugin` | `app.use(consolePlugin)`; `app.console.add('heal', { run })` |
| Debug | `debugPlugin` | `app.use(debugPlugin)`; F6 colliders · F7 stats · F8 navmesh |
| Level | `app.loadLevel(url)`, `fadeOut/fadeIn` | `await app.loadLevel('/levels/a.json')` |
| Contracts | `ok/fail/isOk/unwrap`, `stableStringify`, `hashValue`, `sha256Hex` | `ok(x)`; `hashValue({a:1})` |
| Bakes | `bakesPlugin`, `BakeQueue` | `app.bakes.add({ owner, work: gen(), commit })` |
| Asset manifest | `loadAsset`, `applyManifestColliders`, `validateManifest`, `roleMatches`, `budgetCheck`, `lodIndexFor` | `await loadAsset('/m/crate.glb')` |
| Instancing | `buildInstanced`, `classifyTransform`, `flipIndices`, `composeAnchor` | `buildInstanced(mesh, items)` |
| Asset cache | `ByteCache`, `app.assets.report/clean/retain` | `cache.clean(64e6, { dryRun: true })` |
| Terrain bin | `decodeHeightmap`, `heightfieldFrom`, `chunkRanges`, `lodIndexForDistance` | `heightfieldFrom({ buffer, width, height })` |
| Sprite sheet | `parseSheet`, `uvFor`, `clipTimeline` | `parseSheet(asepriteJson)` |
| Atlas | `packAtlas`, `composePages`, `validatePages` | `packAtlas(images, { maxSize: 2048 })` |
| Surface wear | `edgeWeights`, `applySurfaceWear`, `attachSurfaceWear` | `attachSurfaceWear(gltf.scene, { strength: 0.6 })` |
| glTF info | `glbInfo`, `needsMeshopt`, `needsKtx2`, `isQuantized`, `ktx2Plan` | `glbInfo(buffer)`; `loadGltf(url, { ktx2: { transcoderPath: '/basis/', renderer } })` |
| LOD group | `LodGroup`, `lodGroupFromManifest` | `new LodGroup([{ object, minCoverage: 0.6 }])` |
| Sprite animator | `SpriteAnimator.fromSheet(sheet, clip)` | `SpriteAnimator.fromSheet(parseSheet(json), 'walk')` |
| Assets | `assetsPlugin`, `classify`, `normalizeList`, `progressOf` | `await app.assets.load(['a.png'], { onProgress })` |
| Music | `musicPlugin`, `moodOf`, `crossfade`, `duckGain` | `app.music.play('calm')`; `app.music.duck(true)` |
| Stats | `statsPlugin`, `Stats`, `Progression`, `StatusEffects` | `app.stats.create({ str: 12 })` |
| Loot | `lootPlugin`, `LootTable`, `rarityOf` | `app.loot.spawnAt(pos, { table: 'rogue' })` |
| Fixed step | `advance`, `resolveFixed` | `config.time.fixed = 60` |
| Save migrate | `SaveSlot({ version, migrate })`, `migrateData` | `new SaveSlot({ version: 2, migrate: { 1: fn } })` |
| Terrain | `Terrain`, `terrainLod` | `new Terrain({ heightfield, size: 200, segments: 96 })` |
| Tilemap | `Tilemap`, `autotileMask`, `autotileVariant` | `map.applyAutotile({ family: 1, base: 4 })` |
| Inventory | `Inventory`, `equip/unequip/bonus` | `inv.equip('sword', 'weapon')`; `inv.bonus()` |
| XR | `xrPlugin` | `app.use(xrPlugin, { mode: 'immersive-ar' \| 'immersive-vr' })` — **AR first**, falls back to VR |
| Editor | `editorPlugin` | `app.use(editorPlugin, { cell: 1 })` — E/Q/R/T, Ctrl+S/Ctrl+O |
| Menu | `createMenu` (lazy via `app.menu`) | automatic |

After installing: `app.inventory`, `app.interaction`, `app.quests`, `app.dialogue`, `app.grid`, `app.audio3d`, `app.net`, `app.remote`, `app.netChat`.

## Input

| Export | Description |
|---|---|
| `Input` | `down(action)`, `justPressed(action)`, `look`, `endFrame()`, `clear()`, `locked` |

Default actions: `forward`, `back`, `left`, `right`, `run`, `jump`, `crouch`, `view`,
`interact`, `reload`, `fire`, `aim`, `debug`. To add a new action, declare it in
`config.input.binds` and read it with `input.down('name')` / `input.justPressed('name')`.

## HUD

| Export | Description |
|---|---|
| `createHud(root, cfg)` | `setObjective`, `setHint`, `setStats`, `setState`, `setCrosshair`, `toggle`, `bind`, `root` |

`hud.bind(target, getter)` accepts a selector or an element; it updates itself when reactive state changes (flushed per frame).

## Reactive & plugin

| Export | Description |
|---|---|
| `reactive(obj)` | Proxy that tracks reads/writes |
| `effect(fn)` | Re-runs when dependencies change; returns a cancel function |
| `computed(getter)` | Derived value |
| `flush()` | Applies updates (the app calls it at the end of each frame) |
| `definePlugin(name, install, dispose?)` | Creates a plugin for `app.use()`; `dispose(app)` is called on `app.destroy()` |
| `audioPlugin`, `savePlugin` | Built-in plugins |

Plugin contract: `app.use(fn | { name, install, dispose? }, options)`. `install(app, options)` **may return**
a dispose function or an object with `.dispose()` (e.g. `return api` when `api.dispose` exists); for an async install, it is taken from the
resolved value. `app.destroy()` calls dispose in reverse install order.

## Render

| Export | Description |
|---|---|
| `createRenderer(canvas, cfg)` | WebGLRenderer + tone mapping |
| `bindResize(renderer, camera)` | Resizes with the viewport; **returns an unbind function** `unbind()` (the resize function is at `unbind.resize`) |
| `createSky(sky)` | Gradient sky |
| `createLights(cfg)` | `{ sun, fill, amb, rim, bounce }` |
| `createEmbers(n)` | Ash particles, `userData.update(dt, t)` |
| `PALETTE` | Base colors |

## Events

| Event | Payload |
|---|---|
| `app:ready` | `{ app }` — after the first frame |
| `app:start` / `app:stop` | — |
| `app:destroy` | `{ app }` — at the start of `destroy()`, after the loop stops, before cleanup |
| `player:crouch` | `{ crouched }` |
| `player:view` | `{ mode }` |
| `player:jump` | — |
