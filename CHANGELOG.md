# Changelog

This project follows [Keep a Changelog](https://keepachangelog.com/) and semver. During the alpha phase
the API may change, but every breaking change is recorded here together with migration notes.

## [0.1.0-alpha.3] — 2026-11-17

### Breaking

- **CSS variables renamed to the `--rise-*` set**, and the bundled styles reduced to neutral, minimal defaults. `risejs-core/style.css` now contains only the page shell (canvas and UI layout, boot screen, level fade, fatal error box). Theme the UI by overriding the `--rise-*` variables; see `docs/ui.md`.

  | Before | After |
  |---|---|
  | `--ink` | `--rise-background` |
  | `--ink-2` | `--rise-muted` |
  | `--bone` | `--rise-foreground` |
  | `--bone-dim`, `--bone-faint`, `--steel` | `--rise-muted-foreground` |
  | `--line` | `--rise-border` |
  | `--plate`, `--plate-solid` | `--rise-surface` |
  | `--signal`, `--signal-hot` | `--rise-accent` |
  | `--alarm` | `--rise-destructive` |
  | `--f-display`, `--f-label` | `--rise-font-sans` |
  | `--f-mono` | `--rise-font-mono` |
  | `--rust`, `--shadow`, `--f-cjk`, `--sat`, `--sar`, `--sab`, `--sal`, `--gl`, `--gr` | removed |

- **The default locale is now `'en'`** (was `'vi'`). Set `locale` in `createApp` or in the game module if your game ships another language.
- **The default crosshair color follows `--rise-foreground`.** `config.hud.crosshair.color` now defaults to `null`; set it to keep a fixed color.
- **Built-in UI text and error messages are in English.** Code that matched on message text needs updating.

### Changed

- README files for `risejs-core`, `create-risejs` and the project template rewritten.
- README no longer uses relative links, which were broken on the npm package page.
- Documentation revised: outdated URL-parameter references and maintainer-only notes removed, repository-only instructions marked as such.
- `VideoLayer` (fmv pack) accepts `subtitleLang` for the subtitle track language.

### Fixed

- `create-risejs` on Windows: a target folder with non-ASCII characters (for example accented letters) got an empty project while the files went into a mis-encoded sibling folder. The CLI no longer uses `fs.cpSync` and now fails loudly if the template was not copied.

No public export was removed or renamed, so `API_VERSION` stays at 2.

## [0.1.0-alpha.2] — 2026-11-17

### Breaking changes (API_VERSION 1 → 2)

- **The npm package `rise-framework` is renamed to `risejs-core`** (the old name belongs to an unrelated package on npm). Added the `create-risejs` scaffolder (`npm create risejs@latest`). Website: https://risejs.dev. See `docs/migration.md`.
- **The framework no longer reads the URL.** Removed `applyUrlOverrides` and every config override via query string
  (`?crosshair=`, `?fog=`, `?walk=`, `?run=`, `?spawn=`, `?view=`, ...), which let players change a game's speed,
  spawn point and HUD on their own.
- `createApp` no longer takes a `params` argument; it now accepts `locale`, `seed`, `config` and `options`. `app.params` is now `app.options`.
- `?lang=`, `?seed=`, `?fixed=`, `?nopause` and `?shot` in the core are replaced by `createApp({ locale, seed })`,
  `config.time.fixed`, `config.time.autoPause`, `config.time.still` and `config.render.preserveDrawingBuffer`.
- The `touch` pack no longer reads `?touch=1` (use `{ force: true }`); the `a11y` pack no longer reads `?colorblind=&uiScale=&motion=`.
- Demo shell: in production builds only `?game=` works; other dev parameters are available only with `npm run dev`.
- `bindResize(renderer, camera)` now returns a function that removes the listener (`unbind()`) instead of the resize function (still available as `unbind.resize`).
- `window.__rise`, `__scene`, `__camera`, `__renderer`, `__player` and `__city` are attached only in dev or when `config.debug.globals` is `true`.
- Installing a plugin with the same name again now logs a warning once and is skipped (previously `install` ran again).

### Added

- `app.destroy()` (idempotent): stops the loop, emits `app:destroy`, calls `game.destroy?.(app)`, disposes plugins in
  reverse install order, removes all listeners and DOM created by the core, disposes entities and the renderer, and clears emitters. Also `app.destroyed`.
- Dispose contract for plugins: `install` may return a dispose function or an object with `.dispose()`;
  `definePlugin(name, install, dispose?)`.
- `createApp({ canvas, uiRoot, mount, renderer })`: mount into custom DOM, with elements created automatically when missing; an injected renderer
  (object or factory) skips the WebGL2 check, so the app can run headless.
- `Input#dispose()`, `hud.dispose()`, `Emitter#clear()`, `config.debug.globals`.
- `npm run test:app` (`scripts/test-app.mjs`): lifecycle tests in Node with a fake DOM and a fake renderer.
- Every pack that provides a plugin now cleans up fully on `dispose` / `app.destroy()`: removes window/document/DOM listeners, unregisters `app.events` handlers,
  clears timers, removes DOM nodes, closes sockets (`NetClient#dispose()` does not reconnect), stops/disconnects audio, removes objects from the scene
  (and disposes geometry/materials the pack created), restores camera/lights/fog to their previous values, and resets `app.<field>` to `null`.
  Added `VideoLayer#dispose()` (cleans up automatically on `app:destroy`) and `createEmbers().userData.dispose()`.
- `node --import ./scripts/css-stub-register.mjs scripts/test-packs.mjs`: per-pack teardown tests (fake DOM/audio/WebSocket).
- `npm run test:games`: boots the 10 sample games in Node (fake DOM and renderer); included in `npm test`.
- Resource limits: `config.time.maxFps` (0 = unlimited), `config.time.idleFps` (default 10 while `paused`;
  previously a still scene was still drawn 60+ times per second), `config.time.unfocusedFps`, `config.render.powerPreference`.
  `maxFps` can be changed at runtime via `app.config.time.maxFps`. Not applied during XR sessions.

### Fixed

- The frame loop called `audio.play('step')` with an undefined variable, throwing every frame while walking. It now uses `app.audio?.play`.
- `createApp` returned a shallow copy of `app`, so plugins installed through a returned object (`app.inventory`, `app.weather`, ...)
  and `setCamera` were not reflected. There is now a single `app` object.
- The `visibilitychange` handler called `api.setState` (not yet declared at creation time); it now uses `app.setState`.
- `loadLevel` without `buildEntity` / `game.onLevel` / `app.prefabs` now throws a clear error instead of a `TypeError`.
- `chat` pack: the `window` option (ms) shadowed the global `window`, so `window.addEventListener` threw on install; it now uses `globalThis.window`.
- `console` pack: `add()` returned `api` before it was declared (TDZ), so the plugin failed to install; it is now declared first.
- `editor2d` pack: `rebuild()` assigned `app.editor2d.built` (missing, or a getter without a setter), throwing on install; the assignment was removed.
- `combat.hit`: the default parameter `iframe = iframe` caused a ReferenceError whenever it was called without `iframe`.
- **The 4 sample games tactics, side, rpg and rogue failed to start**: `game.build()` read `app.player`, but the core created the player AFTER build. Input, character and player are now created before `game.build`, and `heightAt` reads `world.heightfield` lazily.
- Fixed `hud.toggleHint is not a function` when pointer lock changes state (added `hud.toggleHint` and removed a redundant call).
- `music` pack: without Web Audio, `app.music.play()` crashed the whole game (rpg and rogue on WebKit). It now warns once and runs silently.
- `npm test` now also runs `test:app` and `test:packs` (per-pack dispose checks).
- Playwright now uses its own port (5183) and no longer reuses an existing server.

## [0.1.0-alpha.1] — 2026-11-16

The first alpha that can be packaged.

### Added

- 81 KB core in 28 files: app lifecycle, config, input, player, camera, HUD, reactive state, i18n, save,
  anti-cheat, world/entity, seeded RNG, projection, timestep, net zone math.
- 47 opt-in packs: combat, inventory, quest, dialogue, vn, stats, loot, npc, navmesh, physics,
  grid, triggers, sprite2d, tilemap, camera2d, sideview, terrain, weather, procgen, vfx, surface,
  gltf, assets, atlas, bakes, contracts, chat, nameplate, lobby, net, persistence, menu, a11y,
  touch, xr, bench, telemetry, replay, console, debug, editor, editor2d, prefabs, fmv, music,
  audio3d, tween.
- 9 sample games: city, foundry, arena, tactics, side, game2d, fmv, rpg, rogue.
- `rise.asset.json`: box/capsule/hull colliders, anchor, port, kit, LOD, budget advisory.
- Instancing splits batches by determinant; material wear `_edge` / `_cavity`.
- Save versioning and migration; fixed timestep; LRU asset cache with preview/retain.
- Optional Cloudflare server: zone Durable Objects, binary snapshots, lobby, anti-cheat.
- Wall-collision and server-side economy:
  - `src/shared/collision.js`: shared `CollisionMap` with `segmentBlocked` (line of sight) and `resolveMove` (sliding, no wall clipping).
  - `src/games/arena/map.js`: the map is a single source. The client builds geometry from it and the server loads it via `?map=arena`; `npm run make:map` exports to `public/maps/`.
  - The server computes `fire` (ammo, rpm, line of sight against the map) and handles `reload`.
  - Economy: `wallets` / `wallet_items` / `wallet_ledger` (D1) and an idempotent `POST /api/wallet/:game/:player/apply`;
    `grant` is admin-only, `spend` requires the wallet owner's token.
  - Loot: the server rolls with seed `player:crateId`; reopening returns `duplicate`, with no reroll or duplication.
- Added `scripts/check-install.mjs`: packs the package into a temp folder and runs a Vite build to catch `exports` / `files` errors.

### Changed

- Demo uses system fonts instead of the Google Fonts CDN.

### Security

- Fixed XSS in dialogue, fmv, quest and menu.
- Server: clamped damage/range and ammo/rpm/reload, hits go through `resolveShot`, monotonic `seq`, rate limiting, and HMAC tokens that now **expire**.
- Client drops stale snapshots; XR and touch use feature detection with fallbacks.
- **Old tokens are no longer valid** (format `v1.player.exp.sig`); clients must call `/api/auth` again.

### Notes

- The package ships as **ESM source** (Vite/Rollup handle the CSS); `dist-lib/rise.js` is a build of the core.
- Browser-only: requires WebGL2. Does not run in Node (except pure `core.js` modules, for testing).
- No real-device fps measurements yet.
