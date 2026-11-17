# Quick recipes

## 1. Remove the crosshair

```js
// in the game module
config: { hud: { crosshair: { enabled: false } } }
```

or at runtime: `app.hud.setCrosshair(false)`.

## 2. Turn the crosshair into a small dot

```js
config: { hud: { crosshair: { style: 'dot', size: 8, thickness: 2, color: '#ffb347' } } }
```

## 3. Toggle-style crouch (instead of holding the key)

```js
config: { player: { crouch: { mode: 'toggle', toggleKey: 'KeyC' } } }
```

Listen with: `app.events.on('player:crouch', ({ crouched }) => ...)`.

## 4. Change the crouch key

```js
config: { input: { binds: { crouch: ['KeyX'] } } }
```
Note: changing `binds.crouch` does not change `player.crouch.key` (that one is only for documentation/display).

## 5. Start in third-person view

```js
config: { player: { view: { mode: 'tp', distance: 4.2, height: 1.6 } } }
```

## 6. Add a patrolling NPC

```js
import { npcPlugin } from 'risejs-core/packs/npc';

build(app) {
  app.use(npcPlugin);
  app.spawnNpc({
    path: [[-10, 0, -6], [10, 0, -6], [10, 0, 6]],
    speed: 1.4,
    pause: 1.5,
    color: 0x2f4b6b,
    name: 'guard',
  });
}
```

## 7. Add an object with collision

```js
import { box } from 'risejs-core';

build(app) {
  app.add(box({ size: [3, 2, 3], position: [4, 1, -8], color: 0x555c64, tags: ['cover'] }));
}
```

The collider is computed automatically once the mesh has world coordinates.

## 8. Add a sample game (in the repository)

```bash
npm run create-game -- canyon
# demo shell only: open http://localhost:5173/?game=canyon (the framework does not read the URL; your own project uses createApp({ game }))
```

## 9. Turn off the flashlight / change the sunlight

```js
config: {
  lights: {
    torch: { enabled: false },
    sun: { intensity: 4.2, color: '#ffd0a0', position: [-30, 28, 20] },
  },
}
```

## 10. Create a grass field and a pond

```js
import { SurfaceMap, SURFACE } from 'risejs-core';

const surface = new SurfaceMap();
surface.rect(SURFACE.GRASS, 0, 20, 30, 20);
surface.circle(SURFACE.WATER, -20, 0, 8);
app.world.setStatic(root, colliders, surface);
```

## 11. Quick tweaks during development

The framework does not read the URL (players must not be able to change config). Pass values through `createApp`:

```js
createApp({ game, config: { render: { fog: 0.004, exposure: 1.5, fov: 82 }, player: { view: { mode: 'tp' } } } });
```

## 12. Stationary NPC (turns its head only)

```js
// needs app.use(npcPlugin)
app.spawnNpc({ path: [[0, 0, -6]], speed: 0 });
```

## 13. Add your own HUD element

```js
const el = document.createElement('div');
el.className = 'stats';
el.style.bottom = '56px';
el.textContent = 'AMMO ∞';
app.hud.root.appendChild(el);
```

## 14. Run 2 games in 2 tabs

In the repository's demo shell, open each sample game in its own tab (`?game=city`, `?game=foundry`; demo only, the framework does not read the URL).
In your own project, call `createApp({ game })` in each page.

## 15. Capture a still frame

Set `config.time.still = true` to render a paused scene and `config.render.preserveDrawingBuffer = true` so the canvas can be
read back, then call `app.renderer.domElement.toDataURL('image/png')`. Press F1 to show the debug figures.

## 16. Add an interact key (E) and fire (left mouse button)

These actions already exist in the default config — just read them:

```js
tick(dt, app) {
  if (app.input.justPressed('interact')) {
    app.hud.setHint('Interacted');
  }
  if (app.input.down('fire')) {
    // fire
  }
  if (app.input.justPressed('reload')) {
    // reload
  }
}
```

Change the keys:

```js
config: { input: { binds: { interact: ['KeyF'], fire: ['Mouse0', 'KeyJ'] } } }
```

## 17. Pick up items & interact (inventory pack)

```js
import { inventoryPlugin } from 'risejs-core/packs/inventory';

build(app) {
  app.use(inventoryPlugin, { capacity: 8 });

  const crate = box({ size: [0.8, 0.8, 0.8], position: [6, 0.4, 4], color: 0x8a5a2b });
  app.add(crate);
  app.interaction.add(crate, {
    label: 'Pick up crate',
    range: 2.8,
    onUse: () => {
      app.inventory.add({ id: 'supply', name: 'Supply crate' }, 1);
      app.world.remove(crate);
    },
  });
}
```

- The prompt appears when you stand near the object and look at it (dot > 0.15).
- Open the inventory with **I**.
- Events: `inventory:add`, `inventory:change`.

## 18. Dialogue & quests (quest pack)

```js
import { questPlugin } from 'risejs-core/packs/quest';

const graph = {
  intro: {
    speaker: 'MARA',
    text: 'Can you pick up three crates for me?',
    choices: [
      { label: 'Accept', next: 'ok', action(app) {
          app.quests.add({ id: 'supply', title: 'SUPPLIES',
            steps: [{ id: 'crates', text: 'Collect crates', need: 3 }] });
      } },
      { label: 'Later', next: null },
    ],
  },
  ok: { speaker: 'MARA', text: 'Good.', choices: [{ label: 'Got it', next: null }] },
};

app.use(questPlugin);
app.dialogue.start(graph, 'intro');
app.quests.progress('supply', 'crates', 1);
```

- Dialogue: keys **1–9** or click; **Esc** closes; the game switches to the `dialogue` state automatically.
- Events: `quest:progress`, `quest:complete`.

## 19. Grid movement (grid pack)

```js
import { gridPlugin } from 'risejs-core/packs/grid';

app.use(gridPlugin, { cell: 3, stepTime: 0.18, repeat: 0.24, min: [-6, -6], max: [6, 6] });

app.events.on('grid:step', ({ i, j }) => console.log('cell', i, j));
app.events.on('grid:blocked', () => app.audio.play('error'));

app.grid.cell;       // { i, j }
app.grid.moveTo(5, -5);
```

Sample game: `tactics` (run from the repository's demo shell) — a 13×13 grid, the target cell glows.

## 20. Positional audio (audio3d pack)

```js
import { audio3dPlugin } from 'risejs-core/packs/audio3d';

app.use(audio3dPlugin);
app.audio3d.playAt('hit', { x: 0, y: 0.4, z: -34 });
```

The listener follows the camera every frame. Requires `audioPlugin` (enabled by default).

## 21. Save with D1 over HTTP

```js
import { persistencePlugin } from 'risejs-core/packs/persistence';

app.use(persistencePlugin, { base: 'http://127.0.0.1:8787', game: app.id, player: 'p1' });
await app.remote.auth();
const { data } = await app.remote.read();
await app.remote.write({ score: 10 });
await app.remote.event('teleport', { d: 40 });   // telemetry → events table
```

The server must be running (`npm run server`). To require auth: `--var AUTH_REQUIRED:1`.

## 22. Prepare for multiplayer

```js
import { zoneKey, neighborKeys } from 'risejs-core';

zoneKey(70, 130);              // "1,2"
neighborKeys(70, 130, 64, 1);  // 9 zones around the player
```

See [networking.md](networking.md) for the full protocol and architecture.

## 23. 3-channel chat + nameplates (chat, nameplate packs)

```js
import { chatPlugin } from 'risejs-core/packs/chat';
import { nameplatePlugin } from 'risejs-core/packs/nameplate';

app.use(nameplatePlugin);
app.use(chatPlugin);           // needs the net pack to send/receive

app.nameplates.add(npc, { name: 'MARA' });
app.nameplates.say(app.nameplates.items.get(npc), 'Hello', 3);
app.chat.ignore('spammer');    // hide messages from this player
```

**T** opens the input box, **Enter** sends, **Esc** closes. Commands: `/all …`, `/zone …`, `/w name …`.
Banned words are masked by default (`blocked`) and repeated messages are blocked (`SpamGuard`).

## 24. NPC AI with pathfinding (npc pack + navmesh)

```js
import { npcPlugin, NpcAgent } from 'risejs-core/packs/npc';
import { NavGrid } from 'risejs-core/packs/navmesh';

app.use(npcPlugin);
app.spawnNpc({ path: [[0, 0, 0], [10, 0, 0]], speed: 1.4 });   // patrol

const nav = new NavGrid({ cell: 1, minX: -60, maxX: 60, minZ: -60, maxZ: 60 });
for (const c of world.colliders) if (c.max.y > 1.2) nav.blockBox(c);

const guard = new NpcAgent({ path: [[0, 0, 0], [12, 0, 0]], sight: 16, nav });
app.world.add(guard);
```

`app.spawnNpc` is **not in core** — you must call `app.use(npcPlugin)` first (NPC behavior is a pack).

States: `patrol → chase → return`; `guard.goTo(point)` returns an array of A* waypoints.

## 25. Falling objects & vehicles (physics pack)

```js
import { Body, stepBody, Vehicle } from 'risejs-core/packs/physics/body';

const crate = new Body({ x: 0, y: 6, z: 0, restitution: 0.4 });
crate.impulse(2, 0, -3);
app.events.on('frame', (dt) => stepBody(crate, dt, { groundY: (x, z) => app.world.heightAt(x, z) }));

const car = new Vehicle({ x: 0, z: 0 });
car.update(dt, { throttle: 1, steer: -0.4 });   // every frame
```

No extra dependency: enough for falling crates, bouncing balls, and kinematic vehicles.

## 26. Lobby & quick match (lobby pack)

```js
app.use(lobbyPlugin, { url: 'http://127.0.0.1:8787' });
const room = await app.lobby.quickMatch();     // picks the room with the fewest players
```

**L** opens the list, **Q** quick match. Server: `POST /api/rooms` (heartbeat, TTL 60 s),
`GET /api/rooms` → `{ rooms, total, open }`.

## 27. Measure real fps (bench pack)

```js
import { benchPlugin } from 'risejs-core/packs/bench';
app.use(benchPlugin, { seconds: 10 });   // report: app.bench.report
```

The overlay shows fps, p50/p95/1% low, % jank, draw calls, triangles. **F4** downloads JSON.

## 28. Load an external model (gltf pack)

```js
import { loadGltf, prefabFromGltf, attachAnimations } from 'risejs-core/packs/gltf';

const gltf = await loadGltf('/models/crate.glb');
app.add(prefabFromGltf(gltf, { scale: 0.9, tags: ['solid'] })({ pos: [2, 0.5, 3], rotY: 0.4 }));

const anim = attachAnimations(gltf, gltf.scene);
anim.play('idle');
app.events.on('frame', (dt) => anim.update(dt));
```

You need a real `.glb`; the repo has a sample at `public/models/crate.glb` (`npm run make:glb`).

## 29. Accessibility & PWA

```js
import { a11yPlugin } from 'risejs-core/packs/a11y';
app.use(a11yPlugin);
app.a11y.set({ colorblind: 'deuteranopia', uiScale: 1.2, reduceMotion: true });
```

a11y settings are stored in `localStorage['rise.a11y']`; they are not read from the URL. PWA: `public/manifest.webmanifest` +
`public/sw.js` (registered only in PROD); icons live in `public/`.

## 30. Seeded RNG & tween

```js
import { Rng } from 'risejs-core';

const rng = new Rng('city');        // or app.rng (createApp({ seed }))
rng.int(1, 6); rng.pick(['a','b']); rng.shuffle(list);
rng.weighted([['common', 80], ['rare', 20]]);

app.tween.to({ from: 0, to: 1, duration: 0.4, ease: 'backOut', onUpdate: (v) => (x = v) });
```

Tweens run every frame automatically; `EASING` has 10 types.

## 31. Combat with health (combat + vfx packs)

```js
app.use(vfxPlugin);
app.use(combatPlugin);

app.combat.register(npc, { hp: 60, team: 2 });
app.combat.register({ pos: app.player.pos, mesh: { position: app.player.pos } }, { hp: 100, team: 1, bar: false });

const res = app.combat.strike(playerRef, { damage: 22, range: 2.8, arc: 0.8 });
// res = { target, applied, dead } | null
```

The health bar appears above the head when hp < max; damage numbers + hit flash are automatic if `vfx` is installed.

## 32. RPG: stats, XP, effects (stats + loot packs)

```js
import { Stats, Progression, StatusEffects } from 'risejs-core/packs/stats/core';
import { CRATE_LOOT } from 'risejs-core/packs/loot/core';

const stats = new Stats({ str: 10 });
stats.modifier({ stat: 'str', value: 0.2, mode: 'mul' });

const xp = new Progression({ level: 1 });
xp.addXp(120);                        // → level 2

const fx = new StatusEffects();
fx.add({ id: 'burn', duration: 4, dot: 6 });
fx.tick(dt);                          // { damage, heal, expired }

const drops = CRATE_LOOT.roll(app.rng, { luck: 0.1, rolls: 3 });
```

## 33. Visual novel (vn pack)

```js
app.use(vnPlugin);
app.vn.start({
  start: 'a',
  nodes: {
    a: { speaker: 'MARA', portrait: 'F', expression: 'happy', text: 'Hello.', next: 'b' },
    b: { text: 'Shall we go?', choices: [
      { label: 'Go', next: null, action: (app) => app.loadLevel('/levels/city.json') },
      { label: 'Stay', next: null },
    ] },
  },
});
```

Space advances · B backlog · A auto · Ctrl skip · 1–9 choose.

## 34. Weather & day/night

```js
app.use(weatherPlugin);
app.weather.set('rain');   // clear | rain | snow
app.weather.time = 0.75;   // 0..1 (night)
```

Console (with `consolePlugin`): `weather snow`, `time 0.2`.

## 35. Seeded map generation (procgen pack)

```js
import { generateRooms, scatter, makeNoise } from 'risejs-core/packs/procgen/core';

const { rooms, corridors } = generateRooms(app.rng, { count: 8, width: 96, height: 96 });
const trees = scatter(app.rng, { count: 60, width: 200, height: 200, minDist: 6 });
const noise = makeNoise('city').fbm;
```

Same seed → same map. Pass `createApp({ seed })` to reproduce the same map.

## 36. Replay & dev console

```js
app.use(replayPlugin);
app.replay.start();
const json = app.replay.stop();     // { tickMs, seed, frames }
app.replay.load(json);              // play back
```

Console: `app.use(consolePlugin)` → ` (backquote) opens it; `help`, `give ammo 10`, `spawn npc`, `weather rain`, `time 0.8`, `level /levels/a.json`.
Debug: `app.use(debugPlugin)` → F6 colliders, F7 stats, F8 navmesh.

## 37. Load a level with fade

```js
game.onLevel = (level, app) => { /* build entities from level.entities */ return level.entities.length; };
await app.loadLevel('/levels/park.json');
```

Without `onLevel`, it uses `applyLevel` + the default prefab registry.

## 38. Terrain from a heightfield (terrain pack)

```js
import { Terrain } from 'risejs-core/packs/terrain';
import { Heightfield } from 'risejs-core/packs/physics/heightfield';

const field = new Heightfield({ width: 128, height: 128, heights });
const terrain = new Terrain({ heightfield: field, size: 200, segments: 96 });
app.scene.add(terrain.mesh);
```

Color is lerped by height (low → mid → high → peak); call `terrain.dispose()` when changing maps.

## 39. Autotile & equipment

```js
const map = new Tilemap({ texture, cols, rows, tile: 1, data, solids: [1] });
map.applyAutotile({ family: 1, base: 4 });   // strip of 16 variants, 4 directions

app.inventory.add({ id: 'sword', name: 'Sword', stats: { str: 3 }, slot: 'weapon' }, 1);
app.inventory.equip('sword');                 // slot defaults to 'weapon'
app.inventory.bonus();                        // { str: 3 }
```

In the inventory panel: **1–8** select a slot, **R** equips/unequips.

## 40. Preload assets with progress (assets pack)

```js
app.use(assetsPlugin, { base: '/assets/' });

await app.assets.load(['tex/tile.png', 'sfx/hit.ogg', 'models/crate.glb'], {
  onProgress: (ratio, entry) => hud.setHint(`Loading ${Math.round(ratio * 100)}%`),
});

const tex = app.assets.texture('tex/tile.png');
const gltf = await app.assets.gltf('models/crate.glb');
```

Cached by URL; one failed file does not block the others (returns `{ ok, failed, total }`).

## 41. Background music, fade and duck (music pack)

```js
app.use(musicPlugin);
app.music.play('calm');        // calm | tense | dark | victory
app.music.duck(true);          // lowers automatically while dialogue/VN is open
app.music.stop(1.5);
```

No files needed: 4 chords synthesized with WebAudio (oscillator + lowpass + LFO).
You can pass `{ buffer }` to play pre-recorded music.

## 42. Fixed step for deterministic simulation

```js
game.config = { time: { fixed: 60, maxSteps: 5 } };
```

When `fixed > 0`, position/physics run in 1/60 s steps (accumulator), while `game.tick` and rendering
still follow the frame. A backlog larger than `maxSteps` is dropped to avoid a spiral of death.

## 43. Versioned save + migrate

```js
const slot = new SaveSlot({
  gameId: 'rpg',
  version: 2,
  migrate: {
    1: (data) => ({ ...data, coins: (data.coins || 0) * 100 }),
  },
});
const { data, migrated, from } = await slot.read();
```

The migrate chain runs v1→v2→…; a missing step → `reason: 'migrate-missing'`. A newer save → `'version-newer'`.

## 44. Editor export/import

Sample game `editor` (repository demo shell) → place objects, **Ctrl+S** saves to localStorage, **Ctrl+E** downloads a `.json`,
**Ctrl+I** imports a file. API: `app.editor.exportFile()`, `importData(json)`, `serialize()`.

