# Player

The built-in player controller: first/third-person movement, crouch, swim, AABB collision.
All parameters are in `config.player` ([configuration](configuration.md)).

## State

| Property | Description |
|---|---|
| `player.pos` | `Vector3` at the character's feet |
| `player.vel` | Velocity |
| `player.yaw` / `pitch` | Look direction |
| `player.mode` | `'fp'` or `'tp'` |
| `player.crouched` | Currently crouching |
| `player.swimming` | Currently swimming |
| `player.surface` | `street` / `grass` / `stone` / `water` |
| `player.height` | Current collider height (changes when crouching) |
| `player.onGround` | On the ground |

## Crouch

Three ways to set it up:

```js
// 1. default: hold Ctrl (or C)
player: { crouch: { enabled: true, mode: 'hold' } }

// 2. press to toggle
player: { crouch: { mode: 'toggle', toggleKey: 'KeyC' } }

// 3. turn it off completely
player: { crouch: { enabled: false } }
```

While crouching:

- the eye lowers `eye 1.68 → 1.05`, the collider `1.82 → 1.15`
- speed `4.1 → 2.2`, and jumping is not possible
- standing up succeeds only when nothing is overhead (checked automatically with `_blocked`)
- emits the `player:crouch` event

```js
app.events.on('player:crouch', ({ crouched }) => {
  app.hud.setHint(crouched ? 'CROUCHING' : '');
});
```

## View

`V` cycles through the modes in `view.cycle` (default `['fp','tp']`), or call `player.toggleView()`.

| Mode | Used for |
|---|---|
| `fp` | FPS |
| `tp` | TPS, boom that prevents wall clipping |
| `topdown` | top-down shooter, RTS-lite |
| `iso` | isometric RPG |
| `fixed` | puzzle, fixed room |

```js
player: { view: { mode: 'topdown', cycle: ['topdown', 'tp'], topdown: { height: 26, distance: 9 } } }
```

Movement always follows the camera direction (WASD = up/down/left/right on screen).

## Swim

When `SurfaceMap` returns `water > 0.5`, `swimming = true`:

- sinks to `swim.depth`, no gravity
- speed `swim.speed` / `swim.runSpeed`
- the camera lowers with the water surface

## Surfaces

| Type | Effect |
|---|---|
| `street` | normal |
| `grass` | ×0.86 speed |
| `stone` | ×1.02 |
| `water` | swim |

The game declares the areas itself:

```js
surface.rect('grass', 0, 20, 30, 20);
surface.circle('water', -20, 0, 8);
surface.rect('stone', 14, 16, 18, 14);
```

## Collision

- Per-axis AABB, stepped in increments of ≤ 10 cm, so the player cannot pass through thin walls.
- If the player ends up inside a box (spawn/teleport/frame drop), `_resolvePenetration` pushes them out along the shortest axis.
- Standing on top of objects is not supported yet: the floor is only the ground at `y = 0`.

## Events

| Event | Payload |
|---|---|
| `player:crouch` | `{ crouched }` |
| `player:view` | `{ mode }` |
| `player:jump` | — |

```js
app.events.on('player:jump', () => app.log('jump'));
```
