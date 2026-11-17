# Writing a new pack

In your own project a pack is just a plugin function you pass to `app.use()`; the "Plugin contract" section is all you need.
The boundary rules, checklist and commands below apply when adding a pack to the Rise repository.

A pack = one capability for a group of genres, opt-in. If every game still needs it after you remove all gameplay, it is
core, not a pack (see the layering questions in `docs/architecture.md`; when in doubt, make it a pack first).

## Boundary rules (checked by `npm run check:boundary`)

1. The core (`src/rise/*.js`) does not statically import from `packs/`; only dynamic `import()`.
2. A pack may import other packs, but the graph must be acyclic.
3. A pack does not import from `src/games/`.
4. A pack does not read the URL and holds no text/colors/ids that belong to one specific game.
5. Reference budget of 16 KB per pack (hard cap 24 KB); if heavier, use lazy `import()`.

## Plugin contract

```js
// src/rise/packs/my-pack/index.js
import { MyCore } from './core.js';

export function myPackPlugin(app, options = {}) {
  const core = new MyCore(options);                  // pure logic
  const off = app.events.on('frame', (dt) => core.update(dt));   // on() returns a function that removes the listener
  app.my = {                                         // public API: app.<name>
    do: (x) => core.do(x),
  };
  return () => { off?.(); delete app.my; };          // dispose: app.destroy() calls it
}
```

- Signature: `plugin(app, options)` or an object `{ name, install(app, options) }` (`definePlugin(name, install)`).
  `app.use(plugin, options)` returns `app`, so it can be chained.
- Put the API on `app.<name>`; communicate through `app.events` (`on/once/off/emit`). Useful events: `frame`, `app:ready`, `app:start`, `app:stop`.
- A plugin may return a dispose function; `app.destroy()` removes everything. Every `window`/`document` listener, DOM element,
  timer and `requestAnimationFrame` the plugin creates must be cleaned up in dispose.
- Runtime options come from the `options` parameter or `app.options`, not from the URL.
- Use `app.rng` (seeded) instead of `Math.random()` if it affects game rules.

## Separate the pure logic

`core.js` does not import `three`, the DOM or `window`, so it can be tested with Node. `index.js` only connects `core` to `app`/three/DOM.
Only `index.js` may touch `app`.

## Checklist

1. Create `src/rise/packs/<name>/index.js` (+ `core.js` if there is logic).
2. If you want subpath imports, add them to `exports` in `package.json`.
3. Add tests for `core.js` to `scripts/test-core.mjs`.
4. Add plugin install/uninstall lifecycle tests to `scripts/test-app.mjs` if it touches the DOM/events.
5. Run `npm run api:surface -- --write` to update `scripts/api-surface.json` (new exports).
6. Add it to `docs/packs.md` (table) and `docs/api.md`; add a section to `docs/recipes.md` if there is a typical use.
7. Add a row to `skills/rise/references/packs.md`.

## Check commands

```bash
npm test                # pure logic
npm run test:app        # lifecycle
npm run check:boundary  # boundary rules + budget
npm run budget          # (same script) size
npm run api:check       # no export removed
npm run audit           # pack check
npm run check:encoding
```
