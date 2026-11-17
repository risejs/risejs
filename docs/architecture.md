# Architecture: core ↔ pack ↔ game

Three layers. Code is placed in a layer by what it is, not by how many places use it.

This page describes the layout of the Rise repository and is mainly for contributors. If you only use the
npm package, the part that matters is: import the core from `risejs-core` and each pack from
`risejs-core/packs/<name>`.

```
src/rise/            core — infrastructure EVERY game needs, always loaded (reference: 85 KB)
src/rise/packs/*     pack — capabilities for one group of genres, opt-in (reference: 16 KB/pack)
src/games/*          content — maps, characters, art direction, balance
```

## Layering questions (in order)

1. **Nature**: if you strip out all specific gameplay, does *any* game still need this?
   - Yes → core candidate.
   - No, it only makes sense for one genre/feature → **pack**.
2. **Universality**: does every game need it (loop, input, render, save, HUD), or only
   games of that genre (health, quests, inventory, dialogue, tilemap)?
3. **Content vs mechanism**: sky color, fog, embers, background music, and stat balance are
   **content** → `games/`. The mechanism that *expresses* that content (sky shader, fog, particle
   system) → core/pack.
4. **Cost**: if it is universal but heavy, or only used on secondary screens (menu, glTF loader,
   dev tools) → **lazy** pack, and state in the manifest "universal but opt-in because of KB".

Number of usages is only a **secondary signal**, not a criterion. A universal utility used
in one place can still belong in core; a gameplay behavior used by 5 games still belongs in a pack.

## Boundary rules (machine-checked)

| # | Rule | How it is checked |
|---|---|---|
| 1 | Core does **not** statically import from `packs/` | `check-boundary` (only dynamic `import()` is allowed) |
| 2 | A pack may import other packs; the graph must be **acyclic** | `check-boundary` (DFS) |
| 3 | A pack does **not** import from `games/` | review + script |
| 4 | Every core file must declare its **reason for being in core** in `scripts/core-manifest.json` | `check-boundary` fails on missing or surplus entries |
| 5 | **Budgets are reference values**: core 85 KB, pack 16 KB, game chunk 28 KB. Exceeding them → warning; fails only above the hard limits (core 100, pack 24, game 36) | `npm run budget` |

`npm run check:boundary` runs in CI. To add a file to core, you must write a one-sentence reason in the manifest.

## What belongs where (example decisions)

| Item | Layer | Why |
|---|---|---|
| loop, renderer, camera, input, world, HUD, state, config | core | every game |
| seeded RNG | core | determinism is a property of the simulation, not of any one gameplay |
| 3D→screen projection | core | 3 packs use it, and it is infrastructure math |
| sky shader, fog, lights — **mechanism** | core | every 3D game needs lighting |
| sky, fog, bounce light, embers **colors** | `games/*` | each game's art direction |
| health, damage, i-frames | pack `combat` | only games with fighting |
| NPC patrol, chase AI | pack `npc` | gameplay behavior |
| tween/easing | pack `tween` | universal but small, opt-in; core does not need it to run |
| pause/settings menu | pack `menu` | universal but heavy, and only used when the menu is open → lazy |
| glTF loader | pack `gltf` | universal but a 43 KB library → lazy |
| tilemap, sprite2d, sideview | packs | by 2D/2.5D genre |
| console/debug/bench/replay | packs | only dev/ops use them |

## Core by role

| Role | Files |
|---|---|
| Lifecycle | `app.js` · `config.js` · `plugin.js` · `state.js` · `events.js` |
| I/O | `input.js` · `audio.js` · `save.js` |
| World & render | `world.js` · `player/*` · `camera/rig.js` · `render/*` · `ui/hud.js` |
| Infrastructure utilities | `rng.js` · `projection.js` · `reactive.js` · `spatial.js` · `i18n.js` · `anticheat.js` |
| Networking (pure math) | `net/zone.js` |

## Add a new pack

```js
// src/rise/packs/my-pack/index.js
export function myPackPlugin(app, options = {}) {
  const offFrame = app.events.on('frame', (dt) => { /* … */ });
  const onKey = (e) => { /* … */ };
  window.addEventListener('keydown', onKey);
  const el = app.hud.root.appendChild(document.createElement('div'));
  app.my = { /* public API */ };
  // cleanup — app.destroy() calls these in reverse install order
  return () => {
    offFrame();
    window.removeEventListener('keydown', onKey);
    el.remove();
    delete app.my;
  };
}
```

Checklist:

1. Do not import `games/`; if you import another pack, the graph must stay acyclic.
2. Put the API on `app.<name>` and emit events through `app.events`.
3. A pack that attaches listeners (window/document/element), creates DOM, or calls `app.events.on(...)` **MUST** return a
   dispose function from `install` (or an object with `.dispose()`, or `definePlugin(name, install, dispose)`) that removes exactly
   those things. `app.destroy()` calls dispose in reverse install order; lifecycle test: `npm run test:app`.
4. Keep pure logic in `core.js` so it can be tested in Node (no DOM).
5. Add tests to `scripts/test-core.mjs`, then run `npm run check:boundary` + `npm test`.
6. Document it in `docs/api.md` and add an entry to `docs/recipes.md`.

## Add a file to core

1. Answer the 4 questions above; if in doubt, make it a pack first.
2. Add a line to `scripts/core-manifest.json` with a one-sentence reason.
3. If it exceeds the **hard limit** of 100 KB, you must record the decision together with measurements. Exceeding the 85 KB reference only needs a reason in the PR.
