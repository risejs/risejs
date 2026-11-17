# Creating a game

A game is a module with `export default { ... }` that you pass to `createApp({ game })`. The fastest way to start a project:

```bash
npm create risejs@latest my-game
```

Inside the Rise repository, sample games live in `src/games/<id>/index.js` and are generated with `npm run create-game -- <id>`.

## Contract

| Field | Required | Description |
|---|---|---|
| `id` | yes | Used as the save key (in the repository it also matches the folder name) |
| `build(app)` | yes | May be `async`. Builds the world, entities, plugins, objective |
| `title` | | Tab title |
| `config` | | Overrides `DEFAULTS` (see `config.md`) |
| `hud` | | `{ kicker, title, sub }` for the objective block |
| `strings` | | `{ en: {...}, fr: {...} }`: the HUD uses `'@key'`, code uses `app.t(key, vars)` |
| `tick(dt, app)` | | Game rules every frame, after `world.update` |
| `snapshot(app)` / `restore(data, app)` | | Data for `app.saveGame()` / `app.loadGame()` |

Lifecycle: `resolveConfig` → renderer/scene/sky/lights/HUD → Input + Player + camera → `game.build(app)` →
`app.start()` (loop: input → player → world.update → `game.tick` → render). `app.player` already exists during `build`.

## Minimal runnable example

```js
// src/game/index.js
import * as THREE from 'three';
import { box } from 'risejs-core';
import { tweenPlugin } from 'risejs-core/packs/tween';

export default {
  id: 'canyon',
  title: 'Rise — Canyon',
  config: {
    preset: { camera: 'fps', crosshair: 'dot' },
    player: { spawn: [0, 0, 8], walk: 4.5 },
    hud: { hint: { enabled: true, text: 'WASD MOVE · SPACE JUMP' } },
  },
  hud: { kicker: 'CANYON', title: 'REACH THE LANDMARK', sub: 'Test canyon' },
  strings: { en: { 'hud.done': 'Done' }, fr: { 'hud.done': 'Terminé' } },

  build(app) {
    // the floor is a plain mesh, obstacles are built with box() → an Entity with an automatic collider
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: '#555b61' })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const root = new THREE.Group();
    root.add(floor);
    app.world.setStatic(root);                     // (root, colliders = [], surface = null)

    app.add(box({ size: [4, 3, 4], position: [0, 1.5, -10], color: 0x4e545c }));
    app.use(tweenPlugin);                          // opt-in pack → app.tween
    app.setObjective({ title: 'REACH THE LANDMARK', sub: 'To the north' });
  },

  tick(dt, app) {
    if (app.player.pos.z < -25) app.setObjective({ title: app.t('hud.done') });
  },
};
```

> For a floor with colliders, grass patches and ponds (`SurfaceMap`), see `docs/recipes.md` (sections 7 and 10) and `docs/entities.md`.
> Do not guess the collider format.

## Conventions

- `box({ size, position, color })`, `cylinder`, `decor(mesh)`, `material` (exported from `risejs-core`) return an `Entity`; add it with `app.add()`. See `docs/recipes.md` sections 7 and 10.
- To add an entity: `app.add(entity)`. A patrolling NPC needs the `npc` pack (`app.use(npcPlugin)` → `app.spawnNpc({ path, speed })`).
- Save keys: prefix `rise.<id>.`. To load models or textures, use the `gltf` and `assets` packs.
- A game does not read the URL: runtime options come from `app.options`.
- 2D/2.5D games set `player.controller: 'none'` and then use packs (`sidePlugin`, `sprite2dPlugin`…); the `2d` template of `create-risejs` is a working example.
- Split the code: build the world in `world.js`, rules/plugins in `index.js`. Put the game's pure logic next to them and test it with Node.

## Run and check

```bash
npm run dev          # in your project: the Vite dev server
```

In the Rise repository: `npm run dev` opens the demo shell (`?game=<id>` picks a sample game, demo shell only),
`npm run test:games` boots every sample game headless, and `npm run test:e2e` runs the browser smoke tests
(add the new id to `GAMES` in `e2e/smoke.spec.mjs`).
