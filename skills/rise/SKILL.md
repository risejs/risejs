---
name: rise
description: Use this skill when building or modifying games with Rise.js (risejs-core, "risejs") — a small three.js game framework in plain JS ESM + Vite. Covers creating a game module, createApp config, opt-in packs via app.use(), writing a new pack, and the core/pack/game boundary rules. Triggers on: createApp, app.use, game module, src/games, src/rise/packs, rise pack, Rise config.
---

# Rise.js

A web game framework (3D / 2.5D / 2D) on three.js: a small core, opt-in packs, and no runtime dependencies other than `three`.
The npm package is `risejs-core`; new projects are scaffolded with `npm create risejs@latest`.

## Model: core, packs, game

- **Core** (`risejs-core`): what every game needs: loop, input, rendering, world, HUD, save, config.
- **Packs** (`risejs-core/packs/<name>`): genre-specific capabilities, opt-in through `app.use()`. Most attach `app.<name>`.
- **Game**: your module: map, colors, balance, rules.

The framework **never reads the URL**. Config comes from `game.config` or the `createApp` parameters.

## Quick start (in a project that uses the package)

```bash
npm create risejs@latest my-game      # or: npm install risejs-core three
cd my-game && npm install && npm run dev
```

```js
import { createApp } from 'risejs-core';
import 'risejs-core/style.css';
import game from './game/index.js';

const app = await createApp({
  game,                                    // the game module object
  locale: 'en', seed: 'abc',
  config: { time: { fixed: 60 } },         // overrides game.config
  options: { net: 'ws://localhost:8787' }, // free-form values → app.options (frozen)
});
app.start();
```

Game module: `{ id, title, config, hud, strings, build(app), tick(dt, app), snapshot, restore }`
(only `id` and `build` are required). Pack: `app.use(xPlugin, opts)`, then use `app.x`.

## Rules and common traps

1. Do not read `location`/`URLSearchParams` for game config. Pass options in `createApp({ options })` and read `app.options`.
2. Colliders can be computed only **after** `root.updateMatrixWorld(true)`; then call `app.world.setStatic(root, colliders, surface)`.
3. If a plugin needs cleanup (listeners, DOM, timers), it returns a dispose function; `app.destroy()` calls it. Do not leak `window.addEventListener`.
4. Save keys use the prefix `rise.<id>.`. `app.saveGame()`/`app.loadGame()` use `game.snapshot(app)`/`game.restore(data, app)`.
5. For deterministic simulation (replay, networking), use `app.rng` (seeded) and `config.time.fixed: 60`; do not use `Math.random()` in game rules.
6. `app.spawnNpc` exists only after `app.use(npcPlugin)`; other pack APIs likewise appear only after their plugin is installed.
7. The entry `risejs-core` imports CSS, so it needs a bundler. Pure logic can be tested in Node through `risejs-core/packs/<name>/core`.

## Working in the Rise repository

These apply only when editing the framework itself (a clone of the repository), not a project that depends on it.

```
src/rise/            core
src/rise/packs/*     packs
src/games/<id>/      sample games, run by the demo shell (src/main.js)
```

```bash
npm run create-game -- canyon      # generates src/games/canyon/{index.js,world.js}
npm run dev                        # demo shell; ?game=canyon selects a sample game (demo shell only)
```

- The core **never** statically imports from `packs/` (only dynamic `import()`). Packs do not import `games/`. The pack graph is acyclic. `npm run check:boundary` enforces this.
- Do not put one game's text, colors or ids in the core or a pack. That is content and belongs in `src/games/<id>/`.
- Pure logic (math, rules, data) lives in the pack's `core.js` and is tested with Node. The THREE/DOM part is a thin layer around it.
- Sample games generate their resources in code (geometry, canvas textures); do not add binary assets unless needed.
- When you add a public export, run `npm run api:surface -- --write`; removing an export is blocked by `npm run api:check`.
- Files must be UTF-8: `npm run check:encoding`. Docs are written in English.

Check before finishing:

```bash
npm test               # logic, app lifecycle, packs, sample games, scaffolder
npm run check:boundary # core/pack boundary rules
npm run api:check      # no API breakage
npm run test:e2e       # real browsers (before a release; see docs/testing.md)
```

## References

| File | Use when |
|---|---|
| `references/game-module.md` | Creating a game from scratch, with a runnable example |
| `references/packs.md` | Finding a pack: name → `app.x` → import path |
| `references/writing-a-pack.md` | Writing a new pack, the plugin contract, checklist |
| `references/config.md` | Config merge order, presets, main key groups |

Sources of truth (trust the source over this skill if they differ): `docs/api.md`, `docs/recipes.md`, `docs/packs.md`,
`docs/game-module.md`, `docs/configuration.md`, `docs/architecture.md`, all shipped in the package under `docs/`.
