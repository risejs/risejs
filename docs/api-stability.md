# API stability and versioning

## Versions

- `VERSION`: the package version (semver, currently `0.1.0-alpha.3`).
- `API_VERSION`: an integer, increased when a public export is **removed or changes meaning**.
- `apiInfo()` returns both; use it for logging/telemetry.

```js
import { VERSION, API_VERSION, apiInfo, deprecate } from 'risejs-core';
```

During the **alpha** phase the API can change, but every breaking change must:
1. increase `API_VERSION`,
2. be recorded in `CHANGELOG.md`,
3. get an entry in [migration.md](migration.md).

From beta onward: remove something only after **1 minor** release with a `deprecate()` warning.

## Three stability levels

| Level | What it is | Commitment |
|---|---|---|
| **Stable** | exports from `risejs-core` (core) | not removed within the same major; a change must bump `API_VERSION` |
| **Beta** | packs with a plugin + docs in [packs.md](packs.md) | parameter names may change, the entry stays |
| **Internal** | `core.js`, `manifest.js`, `heightmap.js` files… | usable, but names are not guaranteed |

The pack entry (`risejs-core/packs/<name>`) is the main surface. Subpaths such as `packs/gltf/manifest` are
kept because the bundled tools use them, but they can change if the changelog says so.

## Automated checks (for contributors)

```bash
npm run api:check     # fails if an export is removed or API_VERSION differs from the snapshot
npm run api:surface -- --write   # update the snapshot after adding exports
```

Snapshot: `scripts/api-surface.json` (core + 47 packs). CI runs `api:check`; adding an export only prints
a warning, and removing an export fails.

## Deprecation

```js
import { deprecate } from 'risejs-core';

export function oldName(...args) {
  deprecate('oldName', 'newName', { since: '0.1.0-alpha.1' });
  return newName(...args);
}
```

- The warning appears **once** per name (no console spam).
- Keep the alias for at least 1 minor release, then remove it and bump `API_VERSION`.

## Naming conventions

- `app.<domain>` for runtime APIs: `app.combat`, `app.inventory`, `app.loot`.
- Plugin: `xxxPlugin(app, options)`.
- Pure logic: `core.js` in the pack, exporting functions/classes with no DOM dependency.
- Events: `domain:action` (`combat:hit`, `loot:pick`, `vn:node`).

## Breaking change checklist (for contributors)

- [ ] Does the rename have an alias + `deprecate()`?
- [ ] Was `API_VERSION` increased?
- [ ] Is there a "Changed/Removed" entry in `CHANGELOG.md`?
- [ ] Does `docs/migration.md` have an old → new table?
- [ ] Are `npm run api:surface -- --write` + `npm run api:check` green?
- [ ] Were the tests and at least 1 sample game updated?
