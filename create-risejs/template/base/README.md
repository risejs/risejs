# __TITLE__

A game built with [Rise.js](https://risejs.dev) on three.js.

## Commands

```bash
npm install
npm run dev       # dev server with hot reload
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## Where to edit

- `src/game/index.js`: your game (`config`, `hud`, `build(app)`, `tick(dt, app)`).
- `src/main.js`: starts the app with `createApp`.
- `index.html`: page shell (`#view`, `#ui`, `#boot`).

## Notes

- Rise never reads settings from the URL, so `?x=1` changes nothing. Edit `config` in code instead.
- `risejs-core` is in alpha and pinned to an exact version. Check its changelog before upgrading.
- Docs: https://risejs.dev
