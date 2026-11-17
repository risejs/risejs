# Install and use

## Requirements

| Item | Version | Notes |
|---|---|---|
| Node | ≥ 18 | only for build/dev; the runtime is the browser |
| three | `^0.180.0` | the only **peerDependency** (Rise has no runtime dependencies) |
| Bundler | Vite 5+/Rollup/Webpack | packs import CSS, so a bundler is required |
| Browser | WebGL2 | modern Chrome/Edge/Firefox/Safari |

Rise is **browser-only**. Pure `core.js` files (math, format, loot…) run in Node for testing,
but the `risejs-core` entry imports CSS, so it cannot run directly in Node.

## Two ways to install

**1. Create a new project (recommended)** using the `create-risejs` scaffolder:

```bash
npm create risejs@latest my-game
cd my-game && npm install && npm run dev
```

**2. Add it to an existing project:**

```bash
npm install risejs-core
```

`three` is a **peerDependency** (`^0.180.0`). npm 7+, pnpm and bun install it automatically. With yarn, add it
yourself: `yarn add risejs-core three`.

## Install from a local tarball

To test an unpublished build, pack the repository and install the tarball:

```bash
# in the Rise repository
npm run build:lib
npm pack                 # creates risejs-core-0.1.0-alpha.3.tgz

# in another project
npm install ../path-to-repo/risejs-core-0.1.0-alpha.3.tgz three
```

In a project that uses Vite:

```js
// main.js
import { createApp } from 'risejs-core';
import 'risejs-core/style.css';
import game from './game/index.js';

createApp({ game }).then((app) => app.start());
```

The demo app finds games with a glob:

```js
createApp({ modules: import.meta.glob('./games/*/index.js') });
```

Using packs:

```js
import { inventoryPlugin } from 'risejs-core/packs/inventory';
import { combatPlugin } from 'risejs-core/packs/combat';
import { loadGltf, prefabFromGltf } from 'risejs-core/packs/gltf';

app.use(inventoryPlugin, { capacity: 8 });
app.use(combatPlugin);
```

Pure modules (test with Node):

```js
import { LootTable } from 'risejs-core/packs/loot/core';
import { decodeHeightmap } from 'risejs-core/packs/terrain/heightmap';
```

## DOM requirements

`createApp` takes three options to specify DOM elements:

| Option | Meaning |
|---|---|
| `canvas` | the WebGL `<canvas>` to render to |
| `uiRoot` | the root element that holds the HUD/UI |
| `mount` | the parent element; any missing element is created inside it |

If you pass nothing, Rise looks them up by id: `#view` (canvas), `#ui` (UI), `#app` (mount) and **creates any missing element**,
so a page with only `<div id="app"></div>` is enough to run.

```js
const app = await createApp({ game, mount: document.getElementById('stage') });
app.start();
// when removing the game from the page (SPA, hot reload, tests):
app.destroy();   // stops the loop, removes listeners, releases the renderer
```

Use `app.destroy()` for a clean teardown. Do not reuse that `app` afterwards.

## Structure of a game

```js
export default {
  id: 'my-game',
  title: 'My Game',
  config: { player: { spawn: [0, 0, 0] } },
  build(app) {
    app.use(myPack);
    app.add(/* entity */);
  },
  tick(dt, app) {},
};
```

See [game-module.md](game-module.md).

## Working in the repository

Everything below applies only when you have cloned the Rise repository. None of it is needed to use the npm package.

### Builds

| Command | Result |
|---|---|
| `npm run dev` | dev server with the demo shell and the sample games |
| `npm run build` | demo app → `dist/` |
| `npm run build:lib` | core library → `dist-lib/rise.js` + `rise.css` (three external) |
| `npm pack` | release tarball (core source, docs and license only) |
| `npm run create-game -- <id>` | scaffolds a new sample game under `src/games/<id>/` |

### Example server (optional)

```bash
npm run server        # wrangler dev on port 8787
```

On Windows, local D1 fails when the persist path is too long; the script passes `--persist-to C:/tmp/rise-state` for that reason.
See [networking.md](networking.md) and [anticheat.md](anticheat.md).

### Checks

```bash
npm test              # logic, app lifecycle, pack, sample game and scaffolder tests
npm run api:check     # no public export removed
npm run check:package # metadata + tarball
npm run test:app      # headless app lifecycle (Node)
npm run test:e2e      # Playwright smoke (needs a browser)
npm run perf          # CPU benchmark (Node)
```
