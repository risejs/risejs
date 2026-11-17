# Game module

A game is a module that exports a single object. Pass it to `createApp({ game })`. (In the Rise repository, each sample game is a folder under `src/games/<id>/`.)

## Contract

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Matches the folder name; used as the save key and, in the repository's demo shell only, for `?game=<id>` |
| `title` | string | | Tab title |
| `config` | object | | Overrides [configuration](configuration.md) |
| `hud` | object | | `{ kicker, title, sub }` for the objective block |
| `build(app)` | async function | yes | Builds the world, adds NPCs/entities, sets the objective |
| `tick(dt, app)` | function | | Game rules, every frame |
| `destroy(app)` | function | | Cleans up the game's resources on `app.destroy()` (called before plugins are disposed) |

## Lifecycle

```
createApp({ game })
        ↓
resolveConfig(DEFAULTS ← game.config ← createApp({ config }))
        ↓
renderer → scene → sky/lights → HUD
        ↓
Input + Player + camera
        ↓
game.build(app)          ← add world, entities, NPCs
        ↓
app.start() → loop: input → player → world.update → game.tick → render
        ↓
app.destroy() → stop → 'app:destroy' → game.destroy → plugin dispose (reverse) → listeners/DOM/renderer
```

## The `app` object

| Property | Description |
|---|---|
| `app.config` | The merged config |
| `app.world` | `World`: entities, colliders, surfaces |
| `app.add(entity)` | Adds an entity and computes its collider if needed |
| `app.spawnNpc(opts)` | Creates a patrolling NPC; provided by the `npc` pack (see [entities](entities.md)) |
| `app.hud` | HUD API (see [ui](ui.md)) |
| `app.setObjective({...})` | Shorthand for `hud.setObjective` |
| `app.player` | The player (created before `build`) |
| `app.events` | `Emitter`: `on/once/off/emit` |
| `app.scene`, `app.camera`, `app.renderer` | Raw three.js objects |
| `app.options` | Frozen object from `createApp({ options })`; never read from the URL |
| `app.use(plugin, opts)` | Installs a plugin (returns `app`; plugin fields attach directly to `app`) |
| `app.start()` / `app.stop()` / `app.destroy()` | Loop lifecycle; `destroy()` is idempotent |

## Minimal example

```js
export default {
  id: 'arena',
  title: 'Rise — Arena',
  config: { player: { spawn: [0, 0, 12] } },
  hud: { kicker: 'ARENA', title: 'SURVIVE', sub: 'Wave 1' },

  build(app) {
    const root = new THREE.Group();
    // ... build the geometry ...
    app.world.setStatic(root, colliders, surface);
    app.use(npcPlugin);   // from 'risejs-core/packs/npc'
    app.spawnNpc({ path: [[-8, 0, 0], [8, 0, 0]], speed: 1.2 });
    app.hud.setCrosshair({ style: 'dot', size: 6 });
  },

  tick(dt, app) {
    if (app.player.pos.z < -40) app.hud.setObjective({ title: 'RETURN TO BASE' });
  },
};
```

## Conventions

- The framework holds no text, colors or ids that belong to a game. Everything lives in the module.
- The sample games generate their resources in code (geometry, canvas textures, shaders). To load models or textures, use the `gltf` and `assets` packs.
- Compute colliders **after** `root.updateMatrixWorld(true)`.
- If you need storage, use the prefix `rise.<id>.`.
- `build` can `await` (loading data, async construction).

## Scaffolding

For a new project, use `npm create risejs@latest my-game`. Inside the Rise repository, add a sample game with:

```bash
npm run create-game -- canyon
```
This generates `src/games/canyon/index.js` + `world.js` with a sample world (floor, 3 blocks, grass patch, pond).
