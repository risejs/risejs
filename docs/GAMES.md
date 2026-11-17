# Add a sample game to the repository

This page is for contributors working in a clone of the Rise repository, where sample games live under `src/games/`.
In your own project, a game is any module you pass to `createApp({ game })`; see [game-module.md](game-module.md).

## 1. Create the folder

```
src/games/<id>/
  index.js      # game module contract
  world.js      # builds geometry + colliders + surface
```

## 2. Minimal index.js

```js
import * as THREE from 'three';
import { SurfaceMap } from '../../rise/world/surface.js';

export default {
  id: 'arena',
  title: 'Rise — Arena',
  config: {
    render: { fog: 0.01, exposure: 1.3 },
    player: { spawn: [0, 0, 8], yaw: 0 },
    lights: { sun: { position: [-20, 24, 30], intensity: 3.2 } },
  },
  hud: { kicker: 'TEST ARENA', title: 'SURVIVE', sub: 'Wave 1' },
  build(app) {
    const root = new THREE.Group();
    const colliders = [];
    const surface = new SurfaceMap();

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x2a2d31 }));
    floor.rotation.x = -Math.PI / 2;
    root.add(floor);

    const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial({ color: 0x555c64 }));
    box.position.set(0, 2, -10);
    box.castShadow = true;
    root.add(box);
    root.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(box));

    app.world.setStatic(root, colliders, surface);
  },
};
```

## 3. Run

```
npm run dev
http://localhost:5173/?game=arena
```

In the repository's demo shell, `?game=<id>` selects the sample game (demo only; the framework does not read the URL). In your own project, pass the module with `createApp({ game })`.

You do not need to edit `index.html` or any file in `src/rise/`. `npm run create-game -- <id>` generates this folder for you.

## 4. Add surface interaction (optional)

```js
surface.rect('grass', 0, 20, 30, 20);   // grass patch
surface.circle('water', -20, 0, 8);     // swimmable pond
```

The player is automatically slower on grass (×0.86) and swims when entering water.

## 5. Game rules (optional)

```js
tick(dt, app) {
  if (app.player.pos.z < -30) app.setObjective({ title: 'DONE' });
}
```

`tick` runs every frame, after the player updates.

## Conventions

- The framework holds **no** text, colors or ids that belong to a game.
- The sample games generate their resources in code (geometry, canvas textures, shaders) and load no asset files.
- Compute colliders **after** `root.updateMatrixWorld(true)`.
- Prefix `localStorage` keys with the game id: `rise.<id>.<key>`.
