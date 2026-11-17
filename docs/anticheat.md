# Anti-cheat

## Core principle

> The client is never trustworthy. Anything the client can check, the client can also modify.

Rise therefore works in two layers:

1. **Client-side (included)**: early detection, higher attack cost, telemetry.
2. **Server-side (required for online games)**: validates position, hits and economy, and sends data
   only for the area of interest.

Only layer 2 actually prevents cheating. Layer 1 is useful for detection and reporting only.

## What Rise provides

### IntegrityGuard (`src/rise/anticheat.js`)

| Check | Catches | Default threshold |
|---|---|---|
| `speed` | speedhack (abnormally fast movement) | > 12 m/s |
| `teleport` | instant displacement | > 3.5 m/frame |
| `time-anomaly` | clock tampering, hidden tab | dt > 0.35 s |
| `out-of-bounds` | leaving the map | \|x\|,\|z\| > 600 |
| `invalid-position` | NaN/Infinity | — |
| `input-flood` | macros/spam | > 160 events/s |

```js
app.events.on('anticheat:flag', (flag) => {
  // send to the server: fetch('/report', { method:'POST', body: JSON.stringify(flag) })
  console.warn('[anticheat]', flag.type, flag.detail);
});
```

Enable or disable it and adjust the thresholds:

```js
config: { security: { enabled: true, maxSpeed: 10, maxStep: 3, maxInputPerSec: 120 } }
```

Measured results: a 40 m teleport raises the `teleport` and `speed` flags; a modified save gives `tampered: true`.

### Signed SaveSlot (`src/rise/save.js`)

```
{ v:1, t, data, sig: HMAC-SHA-256("rise|<gameId>|save-v1", JSON(data)) }
```

- If `data` is modified without re-signing, `read()` returns `tampered: true, reason: 'signature'`.
- Without `crypto.subtle` (file://), a weak checksum is used and the `weak: true` flag is set.
- **Limit:** the key lives on the client. A determined player can still modify it. For games with an
  economy, the save must live on the server.

### Rate limit and action map

`Input` counts events; `IntegrityGuard` computes the rate per second. The action map can block unknown
keys, but it cannot stop macros. The server has to count.

## Threat table

| Cheat | What the client can do | What the server must do |
|---|---|---|
| Speedhack | detect dt/speed | simulate at 20 Hz, clamp speed by dt |
| Teleport | detect position jumps | reject positions > `maxMove` |
| Fly / no-clip | detect out-of-bounds | raycast/heightfield on the server |
| Wallhack | limit the data sent | **interest management**: send only entities in the 3×3 zones |
| Aimbot | cannot be detected | check abnormal aim rotation, compute hits on the server |
| Save editing | HMAC signature | store state on the server, sign server-side |
| Item duplication | — | transaction id, idempotency |
| Packet replay | nonce + timestamp | reject old packets |
| Bots | rate + pattern | challenge, behavior analytics |
| Asset/client modification | bundle hash | load assets from the server, CSP, integrity |

## Required for online games

1. **Server-authoritative movement**: the client sends input, the server computes the position.
2. **Hit validation**: the server raycasts; the client sends only direction and time.
3. **Interest management**: use `net/zone.js`, and do not send entities outside the zone.
4. **Short-lived session token** (JWT, 15 minutes), signed by the server.
5. **Idempotency** for every economy operation (purchase, reward claim).
6. **Log and replay**: keep the last 30–60 s of input for investigation.

## What not to do

- Do not detect devtools and block them. This causes false positives and means nothing to anyone who knows how.
- Do not over-obfuscate. It only slows attackers down; it does not stop them.
- Do not trust the client's `performance.now()` for important logic.
- Do not hide all logic in the client and call it "anti-cheat".

## API

```js
app.anticheat.enabled = false;     // disable when debugging
app.anticheat.report();            // { flags, count } to send as telemetry
app.anticheat.reset();             // after a legitimate teleport (respawn)

const save = app.save;             // SaveSlot
await save.write({ score: 10 });
const { data, tampered } = await save.read();
```

## Testing

```js
// simulate a teleport
player.pos.x += 40;
guard.update(0.016);               // → teleport flag
```

## Server layer (example server in the repository: `server/src/ac.js`, `security.js`, `session-guard.js`)

| Function | Purpose |
|---|---|
| `clampInput({ mx, mz, yaw })` | normalizes the move vector to ≤ 1, drops NaN, wraps yaw |
| `acceptMove(prev, next, dt)` | rejects teleports (> 6 m/tick) and speed hacks (> 9.5 m/s) |
| `validHit({ from, to, yaw, range })` | a hit must be within range and within the view cone |
| `clampDamage` / `clampRange` | clamp to 1..50 / 1..8, so a client cannot one-shot or shoot across the map |
| `acceptSeq` | drops input with a repeated or old `seq` (replay, resend) |
| `canHit` | 120 ms cooldown per hit, which blocks hit spam |
| `takeToken` | 120 messages/s/session |
| `sanitizeName` / `sanitizeChat` | strips control/HTML characters, truncates to 16/200 |
| `validRoom` | room name of 1–40 safe characters |
| `safeJsonParse` | does not throw when a client sends broken JSON |
| `timeOk` / `clockOffset` | measures clock drift (record only, no blocking) |
| `resolveShot` | the server computes hits by weapon, range, angle and LOS (`obstacles`) |
| `WeaponState` | ammo, rpm, reload: a client cannot rapid-fire or get infinite ammo |
| `ShotPattern` | `macro` and `high-accuracy` flags, sent as `anticheat` (no auto-ban) |
| `signToken` / `verifyToken` | expiring HMAC token `v1.player.exp.sig` |
| `CollisionMap` | `segmentBlocked` (LOS), `circleBlocked`/`resolveMove` (anti wall-clipping) |
| `Wallet` / `applyWallet` | idempotent wallet; `spend` is guarded by `gold >= ?` |
| `rollLoot` | rolls with seed `player:crateId`, so reopening does not change the result |

### The map is the single source of truth

`src/games/<game>/map.js` holds plain boxes and circles (no three). `world.js` builds the geometry from it,
and the server loads it from the `map=<game>` request parameter of the WebSocket URL and builds a `CollisionMap`. Editing the map in one place
changes both sides. `cover: false` blocks movement only (grass, decorative areas); the default `true`
blocks bullets too.

### Wallet and loot

`POST /api/wallet/:game/:player/apply`: `op:'spend'` needs the wallet owner's token, and `op:'grant'` is
**admin only**. The D1 ledger is keyed on `(game, player, key)`, so a retry or replay is counted only once.
`spend` uses an UPDATE with `WHERE gold >= ?`, so a wallet cannot go negative even with parallel requests.


`ZoneRoom` applies all of this: input goes through `clampInput` + `acceptSeq`, and a position mismatch is
**rolled back** and reported as `{ type: 'anticheat', reason: 'speed' }`. Hits go through `fire`, which the
server computes (ammo/rpm/LOS). The legacy `hit` takes its damage from the weapon id, and hits that come too
fast are dropped. Each session has a `flags` counter of violations (sent with telemetry).
