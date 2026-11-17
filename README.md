# Rise.js

A web game framework for 3D, 2.5D and 2D games, built on [three.js](https://threejs.org).

The core is small. Everything else ships as packs that you import only when you need them. There are no runtime dependencies; `three` is a peer dependency.

Website and docs: https://risejs.dev

Source code: https://github.com/risejs/risejs

> **Status: alpha.** The API can still change between releases. Breaking changes are listed in `CHANGELOG.md`, with upgrade notes in `docs/migration.md`.

## Install

Start a new project:

```bash
npm create risejs@latest my-game
cd my-game
npm install
npm run dev
```

Or add it to an existing one:

```bash
npm install risejs-core
```

`three` is a peer dependency. npm 7+, pnpm and bun install it automatically. With yarn, add it yourself: `yarn add risejs-core three`.

Requirements:

- Node 18 or newer (build tooling only; the framework runs in the browser)
- three `^0.180`
- a bundler that handles CSS imports (Vite, Rollup, webpack)
- a browser with WebGL2

## Quick start

```js
import { createApp } from 'risejs-core';
import 'risejs-core/style.css';
import { inventoryPlugin } from 'risejs-core/packs/inventory';
import game from './game/index.js';

const app = await createApp({ game });
app.use(inventoryPlugin);
app.start();
```

A game is a plain module:

```js
export default {
  id: 'my-game',
  title: 'My Game',
  config: { /* optional */ },
  hud: { /* optional */ },
  build(app) { /* create the world */ },
  tick(dt) { /* optional, runs every frame */ },
};
```

## What's included

### Core

- Layered config, set by the game only. The framework never reads settings from the URL.
- App lifecycle: `createApp` → `build` → `start` / `stop`
- Input: keyboard, mouse, gamepad, touch
- Player controllers: first-person, third-person, top-down
- Cameras, reactive HUD, save slots, seeded RNG, i18n, level loader
- Plugins through `app.use()`

### Packs

47 packs, each imported from `risejs-core/packs/<name>`:

| Area | Packs |
|---|---|
| UI | `menu` `a11y` `chat` `nameplate` `lobby` |
| Gameplay | `combat` `inventory` `quest` `dialogue` `grid` `npc` `navmesh` `physics` `triggers` `stats` `loot` `vn` |
| Rendering and content | `sprite2d` `tilemap` `camera2d` `sideview` `gltf` `terrain` `weather` `procgen` `vfx` `tween` `atlas` `surface` `audio3d` |
| Networking and storage | `net` `persistence` |
| Platform | `touch` `xr` `bench` `telemetry` `assets` `music` `bakes` `contracts` |
| Dev tools | `console` `debug` `replay` `editor` `editor2d` `prefabs` `fmv` |

A multiplayer server is available as an optional piece (Cloudflare Worker with Durable Objects, D1, R2 and KV). The framework does not depend on it.

### Genres

The same core is used for first-person shooters, top-down arenas, grid tactics, 2.5D platformers, 2D tilemap games, interactive video, RPGs and roguelikes. `docs/genres.md` describes which packs each one uses.

## Documentation

Guides and API reference: https://risejs.dev/docs

The package also ships its docs as Markdown under `node_modules/risejs-core/docs/`:

| File | Covers |
|---|---|
| `install.md` | setup, imports, browser requirements |
| `architecture.md` | how core, packs and game code are separated |
| `game-module.md` | the game module contract |
| `configuration.md` | config merge order, presets |
| `packs.md`, `api-reference.md`, `api.md` | pack catalogue and API |
| `recipes.md`, `genres.md` | common tasks, per-genre setups |
| `networking.md`, `anticheat.md` | multiplayer, cheat resistance |
| `api-stability.md`, `migration.md` | versioning policy, renames between releases |
| `troubleshooting.md`, `browser-support.md` | common errors, supported browsers |

## Known limitations

- **Client-side saves can be forged.** `SaveSlot` signs data with an HMAC key that lives on the client, so it only catches casual edits. Games that need tamper resistance should store saves on a server.
- **Cheating cannot be fully prevented in a browser.** Only server authority can be trusted.
- **Zone loot on the optional server is kept in memory** and is lost when the connection drops.
- **No TypeScript types yet.** There are no `.d.ts` files and JSDoc coverage is thin.
- **The core leans toward 3D.** A 2D game still loads the player, sky and lights unless you set `player.controller: 'none'`.
- **Not yet tested** on real mobile devices or XR headsets. PWA offline support and accessibility have not been audited.

## License

ISC. The `LICENSE` and `NOTICE` files are included in the package.
