# Repository structure

```
src/rise/            core: app lifecycle, config, input, player, camera, HUD, save, i18n
src/rise/packs/      opt-in packs (combat, inventory, quest, navmesh, tilemap, net, ...)
src/games/           sample games: arena, city, editor, fmv, foundry, game2d, rogue, rpg, side, tactics
src/shared/          code shared by client and server (level format, collision, weapons)
src/main.js          demo shell that runs the sample games (not part of the npm package)
create-risejs/       the `npm create risejs` scaffolder and its project templates
server/              optional multiplayer server example (Cloudflare Workers + Durable Objects)
scripts/             tests, boundary/API/package checks, generators
e2e/                 Playwright smoke tests for the sample games
skills/              reference notes for AI coding agents, shipped with the package
docs/                documentation published on https://risejs.dev/docs
public/              static assets for the demo shell
```

## Layers

- **core** (`src/rise/`) holds what every game needs. It never imports a pack.
- **packs** (`src/rise/packs/`) add genre features. A pack may import other packs, never a game.
- **games** (`src/games/`) hold content: maps, art direction, balance.

`npm run check:boundary` enforces these rules. See [docs/architecture.md](docs/architecture.md).

## Packages

| Folder | npm package |
|---|---|
| `.` | [`risejs-core`](https://www.npmjs.com/package/risejs-core) |
| `create-risejs/` | [`create-risejs`](https://www.npmjs.com/package/create-risejs) |
