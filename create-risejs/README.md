# create-risejs

Scaffold a [Rise.js](https://risejs.dev) game project with one command.

```bash
npm create risejs@latest my-game
cd my-game
npm install
npm run dev
```

## Options

```
create-risejs [directory] [--template 3d|2d] [--yes]
```

| Option | Description |
|---|---|
| `-t, --template` | `3d` (a small first-person game, the default) or `2d` (a 2.5D side-scrolling platformer) |
| `-y, --yes` | skip the prompts and use the defaults |
| `-h, --help` | show help |
| `-v, --version` | show the version |

With `npm create`, put `--` before the options:

```bash
npm create risejs@latest my-game -- --template 2d
```

The target directory must be empty or not exist yet. Works with npm, pnpm, yarn and bun. Requires Node 18 or newer.

## What you get

A Vite project with `risejs-core` and `three` installed:

```
my-game/
  index.html          page shell
  src/main.js         starts the app with createApp
  src/game/index.js   your game
```

`risejs-core` is pinned to an exact version while it is in alpha, so a new release cannot break an existing project. Rise never reads settings from the URL; change the config in code.

## Links

- Website and docs: https://risejs.dev
- Framework package: https://www.npmjs.com/package/risejs-core

## License

ISC
