# HUD and crosshair

The HUD is a fixed frame. Every element can be turned on or off with `config.hud`; the text comes from the game.

## Configuration

```js
export default {
  hud: { kicker: 'DISTRICT 04', title: 'REACH THE PARK', sub: 'Cross the street' },
  config: {
    hud: {
      crosshair: { enabled: true, style: 'cross', size: 18, gap: 4, thickness: 1, opacity: 0.75 },
      objective: { enabled: true },
      badge: { enabled: true },
      stats: { enabled: true },
      hint: { enabled: true, text: 'V — SWITCH VIEW' },
    },
  },
};
```

| Element | Turn off with |
|---|---|
| Crosshair | `hud.crosshair.enabled: false` |
| Objective block | `hud.objective.enabled: false` |
| FP/TP badge + surface | `hud.badge.enabled: false` |
| Stats line (calls/tris/FPS) | `hud.stats.enabled: false` |
| Hint line | `hud.hint.enabled: false` |

## Crosshair: 3 ways

### 1. In the game's config

```js
config: { hud: { crosshair: { style: 'dot', size: 8, color: '#ffb347' } } }
config: { hud: { crosshair: { enabled: false } } }         // remove it completely
```

### 2. With `createApp({ config })` (dev)

```js
createApp({ game, config: { hud: { crosshair: { style: 'dot' } } } });
```

There is no URL override. Players cannot turn off or change the crosshair through the query string.

### 3. At runtime

```js
app.hud.setCrosshair(false);                       // turn off
app.hud.setCrosshair(true);                        // turn back on
app.hud.setCrosshair({ style: 'dot', size: 10 });  // change the style
app.hud.toggle('crosshair', false);                // equivalent
```

Styles: `'cross' | 'dot' | 'none'`. Size, gap and thickness are in px.

## Menu / Settings (pack)

The menu is the `menu` pack. It is **loaded only the first time it opens** (dynamic import).
If you do not use it, it costs no bytes.

```js
await app.menu.open('main');    // Pause menu
await app.menu.open('settings');
await app.menu.close();
await app.menu.toggle();
app.menu.isOpen;                 // boolean
```

The `P` key opens and closes it. Esc while playing (which exits pointer lock) also opens the menu.

**Settings** are stored at `localStorage['rise.settings.<gameId>']`:

| Key | Effect |
|---|---|
| `volume` | AudioBus volume |
| `sensitivity` | Mouse sensitivity (Input) |
| `pixelRatio` | Cap on devicePixelRatio |
| `binds` | Remapped keys (action → [code]) |

Rebind: click a key in Settings, then press the new key. Press Esc to cancel.

The menu calls `app.setState('paused')` when it opens and `'playing'` when it closes. The loop already depends on state,
so nothing else needs to change.

## API

| Function | Description |
|---|---|
| `setObjective({ kicker, title, sub })` | Change the objective block |
| `setHint(text)` | Bottom line |
| `setState({ mode, surface })` | FP/TP badge + surface |
| `setStats({ calls, tris })` | Render numbers (the loop calls it) |
| `setCrosshair(patch \| boolean)` | Change the crosshair |
| `toggle(name, on)` | `'crosshair' \| 'objective' \| 'badge' \| 'stats' \| 'hint'` |
| `hud.root` | The `#ui` element, for adding your own DOM |

Example of adding a clock:

```js
const clock = document.createElement('div');
clock.className = 'stats';
clock.style.bottom = '56px';
hud.root.appendChild(clock);
app.events.on('app:ready', () => {});
```

## Theming

Rise ships neutral, minimal styles and leaves the look of your game to you. Every color, font and radius used by
the HUD and the packs comes from a small set of CSS variables. Override them in your own stylesheet:

```css
:root {
  --rise-accent: #f59e0b;
  --rise-radius: 0;
  --rise-font-sans: 'Inter', system-ui, sans-serif;
}
```

The defaults are declared with zero specificity, so a plain `:root { ... }` rule is enough. You can also set the
variables on any ancestor element to theme one part of the page.

| Variable | Default | Used for |
|---|---|---|
| `--rise-background` | `#09090b` | Page and boot screen background, level fade |
| `--rise-foreground` | `#fafafa` | Text, crosshair |
| `--rise-muted` | `#27272a` | Subtle fills (tracks, inactive controls) |
| `--rise-muted-foreground` | `#a1a1aa` | Secondary text |
| `--rise-border` | `#3f3f46` | Borders and dividers |
| `--rise-surface` | `rgb(9 9 11 / 0.82)` | Panels drawn over the game view |
| `--rise-overlay` | `rgb(9 9 11 / 0.6)` | Scrim behind menus |
| `--rise-accent` | `#60a5fa` | Focus, hover, selected and progress states |
| `--rise-accent-foreground` | `#09090b` | Text on an accent fill |
| `--rise-destructive` | `#ef4444` | Errors and damage |
| `--rise-radius` | `4px` | Corner radius |
| `--rise-font-sans` | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | UI text |
| `--rise-font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | Stats, console, key labels |

- The HUD stylesheet is loaded by the core. `risejs-core/style.css` adds only the page shell: canvas and UI layout, the boot screen, the level fade and the fatal error box.
- Each pack brings its own small stylesheet, loaded when you import the pack.
- The crosshair is controlled by `--xh-*` variables set from `config.hud.crosshair`. Its color follows `--rise-foreground` unless you set `crosshair.color`.

Change the crosshair color by state:

```js
app.hud.setCrosshair({ color: app.player.onGround ? '#ffffff' : '#ff5a40' });
```
