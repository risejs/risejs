# Testing

These commands apply when you work in the Rise repository. There are three tiers, from cheap to expensive. The lower tiers run on every change; the browser tier runs before a release.

| Tier | Command | Environment | Catches | Run when |
|---|---|---|---|---|
| Pure logic | `node scripts/test-core.mjs` (also the first step of `npm test`) | Node, no DOM | Wrong math/rules in `core.js` of the core and packs (RNG, grid, combat, save, net zone, config…) | Every time you change logic; before every commit |
| App lifecycle | `npm run test:app` | Node + fake renderer + DOM stub | Broken `createApp → start → frame → destroy`, wrong plugin install/removal, leaked listeners, init-order bugs | When changing `app.js`, plugins, game modules; when adding a pack |
| Real browser | `npm run test:e2e` | Chromium/Firefox/WebKit + Vite dev | Bugs that appear only with real WebGL/DOM: shaders, variables undefined on the walking path, a game that does not boot, console errors | Before a release; after changing render/input/games |

`npm test` runs the logic tests, then the app lifecycle, pack, sample game and scaffolder tests (`test:app`, `test:packs`, `test:games`, `test:create`). The browser tier is separate.

## Choosing a tier

- A function that does not touch `THREE`/DOM: move it to `core.js` and test it with `npm test`. This is the cheapest path, so try it first.
- You need `app`, `events` and the plugin lifecycle but not pixels: `npm run test:app`.
- Only a real browser shows it (WebGL, audio, real key input, Firefox/Safari differences): `npm run test:e2e`.

## Limits

- e2e uses software WebGL and does not measure fps. For performance, use `app.use(benchPlugin, { seconds: 10 })` on a real machine.
- e2e runs only against `npm run dev`, because it needs `window.__rise` and the demo shell's dev-only `nopause` flag.
- Playwright's WebKit is not Safari on iOS; test mobile/XR by hand.
- Setup and run instructions for the browser tier are in `e2e/README.md` in the repository.
