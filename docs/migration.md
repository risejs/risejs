# Migration

## 0.1.0-alpha.3

| Before | After | Notes |
|---|---|---|
| `--ink` | `--rise-background` | CSS variables were renamed; override the new names in your stylesheet |
| `--ink-2` | `--rise-muted` | |
| `--bone` | `--rise-foreground` | |
| `--bone-dim`, `--bone-faint`, `--steel` | `--rise-muted-foreground` | |
| `--line` | `--rise-border` | |
| `--plate`, `--plate-solid` | `--rise-surface` | |
| `--signal`, `--signal-hot` | `--rise-accent` | |
| `--alarm` | `--rise-destructive` | |
| `--f-display`, `--f-label` | `--rise-font-sans` | |
| `--f-mono` | `--rise-font-mono` | |
| `--rust`, `--shadow`, `--f-cjk`, `--sat`, `--sar`, `--sab`, `--sal`, `--gl`, `--gr` | removed | use `env(safe-area-inset-*)` directly for safe areas |
| default locale `'vi'` | default locale `'en'` | pass `locale` to `createApp` or set it in the game module |
| `hud.crosshair.color` defaults to a fixed color | defaults to `null` | the crosshair follows `--rise-foreground`; set `color` for a fixed color |

See the Theming section of [ui.md](ui.md) for the full variable list.

## Package rename (0.1.0-alpha.2)

| Before | After | Notes |
|---|---|---|
| `npm install rise-framework` | `npm install risejs-core` (`three` is a peer dependency; npm 7+, pnpm and bun install it automatically, yarn users add `three` themselves) | the `rise-framework` name on npm belongs to an unrelated package |
| `import … from 'rise-framework'` | `import … from 'risejs-core'` | the same applies to subpaths: `risejs-core/style.css`, `risejs-core/packs/<name>`, `risejs-core/shared/*` |
| (create the project by hand) | `npm create risejs@latest my-game` | the `create-risejs` scaffolder |

## 0.1.0-alpha.1 (2026-11-16)

The first packaged alpha. Changes compared with the code before release:

| Before | After | Notes |
|---|---|---|
| `import { Npc } from 'risejs-core'` | `import { npcPlugin, Npc } from 'risejs-core/packs/npc'` | NPC is behavior, so it is a pack |
| `app.spawnNpc(...)` available by default | `app.use(npcPlugin)`, then `app.spawnNpc(...)` | the core does not hold behavior |
| `import { tweenPlugin } from 'risejs-core'` | `import { tweenPlugin } from 'risejs-core/packs/tween'` | tween is opt-in |
| `app.dialogue` created by the quest pack | `app.use(dialoguePlugin)` or `questPlugin` (installs it automatically) | the `dialogue` pack is split out |
| `import { parseChat } from 'packs/chat/index.js'` | `import { parseChat } from 'risejs-core/packs/chat/core'` | pure logic is split into `core.js` |
| `SaveSlot({ gameId })` | `SaveSlot({ gameId, version, migrate })` | reading an old save requires declaring `migrate` |
| `read()` returns `{ data, tampered }` | adds `migrated`, `from`, `reason: 'version-newer'` | a newer save is clearly rejected |
| `config.time` did not exist | `{ fixed: 0|60, maxSteps: 5 }` | fixed step for replay/net |
| `loadGltf(url)` | `loadGltf(url)` + `loadAsset(url)` | `rise.asset.json` manifest for collider/anchor/LOD/budget |
| `app.assets` had no cache | `app.assets.cache`, `report/clean/retain` | LRU by bytes, preview before deleting |
| `collidersFromGltf` | still available, but prefer the manifest | Box3 fallback when there is no manifest |
| `import { hash }` did not exist | `import { hashValue } from 'risejs-core/packs/contracts/hash'` | deterministic hash |
| `bakes` in the core (planned) | `bakes` pack | streaming infrastructure is opt-in |
| `KTX2` not supported | `loadGltf(url, { ktx2: { transcoderPath, renderer } })` | needs `public/basis/` |

### Common path changes

```js
// old
import { loadGltf } from '../../rise/packs/gltf/index.js';
// new (consumer)
import { loadGltf, loadAsset } from 'risejs-core/packs/gltf';
```

### Unchanged

- `createApp`, `World`, `Entity`, `Input`, `Player`, `Character`, `CameraRig`, `createHud`,
  `reactive`, `SaveSlot`, `IntegrityGuard`, `zoneKey`… keep their names.

## Server (0.1.0-alpha.1)

| Before | After |
|---|---|
| `token = HMAC(secret, player)` (no expiry) | `v1.<player>.<exp>.<sig>`: expiring, signature verified |
| `/ws` did not check auth | with `AUTH_REQUIRED=1` it needs `?player=&token=` |
| `hit` accepted client damage | damage comes from the weapon id; `fire` is computed by the server |
| `/api/kv`, `/api/blob` open | need a token when auth is enabled |
| no server economy | `wallets`/`wallet_items`/`wallet_ledger` + `/api/wallet/:g/:p/apply` |
| no server collision | `?map=<game>` → `CollisionMap` (LOS + anti wall-clipping) |

After upgrading, old clients must call `POST /api/auth` again to get a new token. Also run
`POST /api/admin/migrate` again (or `npm run server:migrate`) to create the wallet tables.

## URL overrides removed (API_VERSION 2)

| Before | After |
|---|---|
| `?crosshair=0`, `?fog=`, `?walk=`, `?spawn=`… | removed; set them in `game.config` or `createApp({ config })` |
| `applyUrlOverrides(config, params)` | removed |
| `resolveConfig(gameConfig, params)` | `resolveConfig(gameConfig, overrides?)` |
| `createApp({ params })` | `createApp({ gameId, locale, seed, config, options })` |
| `app.params.get('x')` / `.has('x')` | `app.options.x` / `'x' in app.options` |
| `?lang=`, `?seed=` | `createApp({ locale, seed })` |
| `?fixed=60`, `?nopause`, `?shot` | `config.time.fixed`, `config.time.autoPause = false`, `config.time.still = true` |
| `?touch=1` | `app.use(touchPlugin, { force: true })` |
| `?colorblind=&uiScale=&motion=0` | `app.use(a11yPlugin, { colorblind, uiScale, reduceMotion })` |

## App lifecycle: one object, `destroy()`, plugin dispose (unreleased)

| Before | After |
|---|---|
| `createApp` returned a shallow copy `{ ...app, start, stop }`, so plugins installed later did not appear on the returned object | Returns the `app` **itself**; `app.use(x)` attaches fields to the object you hold |
| No way to destroy the app | `app.destroy()` (idempotent); `game.destroy?.(app)` is called |
| `install(app)` had no cleanup | `install` can return a dispose function or an object with `.dispose()`; or use `definePlugin(name, install, dispose)` |
| Installing the same named plugin twice ran it twice | Warns once and skips later installs |
| `const resize = bindResize(r, cam); resize()` | `const unbind = bindResize(r, cam); unbind.resize(); unbind()` |
| `window.__rise`, `__player`… always present | Only in dev or with `config.debug.globals: true` |
| `#view`, `#ui`, `#app` required in the HTML | `createApp({ canvas, uiRoot, mount })`; created automatically if missing |
| Always created a `WebGLRenderer` | `createApp({ renderer })` accepts a renderer/factory (headless tests) |
| `loadLevel` without prefabs → vague `TypeError` | Clear error: needs `game.onLevel`, `buildEntity` or `app.use(prefabsPlugin)` |

## Upgrade procedure

1. Read the version section in `CHANGELOG.md`.
2. Run `npm run api:check` in the Rise repo (if you forked it), or compare `docs/api-reference.md`.
3. Look for "Deprecated" entries in the console when you run the game.
4. Update according to the migration tables, then run `npm test`.
