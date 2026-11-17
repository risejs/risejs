# Troubleshooting

## `Cannot find module '...css'` when running Node

Rise imports CSS (HUD, pack UI). Node does not handle CSS.

- To test pure logic, import from `packs/<name>/core` (no CSS).
- To run the app, use a bundler (Vite, Rollup, webpack). Do not run `node main.js`.

## `WebGL context lost` / black canvas

- Check WebGL2: `document.createElement('canvas').getContext('webgl2')`.
- Older Safari: enable WebGL2 or use Chrome/Edge.
- Check the console for `[rise]` errors; the `createApp({ game })` entry throws errors with a stack.

## glTF reports `asset needs KTX2`

The asset uses `KHR_texture_basisu`. Pass a transcoder:

```js
await loadGltf('/m/x.glb', { ktx2: { transcoderPath: '/basis/', renderer: app.renderer } });
```

Serve `basis_transcoder.js` and `basis_transcoder.wasm` at that path. Both files ship with three.js under `examples/jsm/libs/basis/`.

## Sprite sheet is flipped / wrong UV

`parseSheet` flips V for three (origin at bottom-left). If your atlas is already flipped, use `uvFor` directly
or invert `frame.y = textureHeight - y - h` before parsing.

## Save reports `tampered: true`

- `reason: 'signature'`: the data was modified, or `gameId` changed.
- `reason: 'version'`: the envelope has no `v`.
- `reason: 'version-newer'`: the save comes from a newer version; it cannot be read backwards.
- `reason: 'migrate-missing'`: no migrate function for the old version.

See [api-stability.md](api-stability.md) and `SaveSlot` in [api-reference.md](api-reference.md).

## In the repository

These apply only when you work in a clone of the Rise repository.

### The demo PWA still serves the old version

The service worker caches under `rise-shell-vN` in `public/sw.js`.
Increase the version number each time the shell changes, or use DevTools → Application → Unregister.

### D1/R2 returns 500 on Windows

The default persist path is too long. Run the example server through the script, which sets a short path:

```bash
npm run server   # includes --persist-to C:/tmp/rise-state
```

### Wrangler 3 local D1 errors

The repository depends on wrangler 3. If local D1 fails, try wrangler 4:

```bash
npm i -D wrangler@4
npx wrangler --version
```

### `api:check` fails

An export was removed. If this is intended: increase `API_VERSION` in `src/rise/version.js`, add an entry to `CHANGELOG.md`,
update `docs/migration.md`, then run `npm run api:surface -- --write`.

### `npm pack` is too large

Check `files` in `package.json`; do not add `dist/` (the demo app) or `public/`. Run
`npm run check:package` to see the size and the files that are included.
