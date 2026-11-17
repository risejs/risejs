# Multiplayer and data

Online play is optional. The design follows four principles:

1. Sync only inside a **zone** (64 m cell) — do not send the whole map to everyone.
2. Thin server, no full physics engine; the client predicts, the server validates.
3. Runs **without a server** by default (single-player). Online is an optional module.
4. No dependency on a specific service: the `transport` and `persistence` layers are adapters.

## Architecture

```
Client A ─┐
Client B ─┼── WebSocket ──► Gateway ──► Zone hub ──► Persistence
Client C ─┘                 (auth)     (interest)    (Redis/PG/Supabase)
```

- **Gateway**: validates the token, rate-limits, attaches `playerId`.
- **Zone hub**: keeps the list of players per zone; each tick it filters by interest, then sends deltas.
- **Persistence**: stores only durable data (inventory, progress), not the position every frame.

## Zone & interest management

Zone = 64 m (the same size as a render chunk — one concept, two uses).

```js
import { zoneKey, neighborKeys, filterByInterest } from 'risejs-core';

zoneKey(70, 130);            // "1,2"
neighborKeys(70, 130, 64, 1); // 9 zones: "0,1" … "2,3"
filterByInterest(players, 70, 130, 64, 1);
```

Send rules:

| Event | Sent to |
|---|---|
| Player enters a zone | Players in the 3×3 around that zone |
| Player leaves a zone | Players who could see it (send `leave`) |
| Position snapshot | Only subscribers of the current zone + neighbors |
| Chat | Current zone (or a global channel if you want) |

With 3×3 zones of 64 m, a player receives data for at most about 200 m × 200 m.

## Protocol

Input, chat and events are JSON messages. Position snapshots are binary (`src/shared/snapshot.js`, shared by client and server):

```
Header: [type u8 = 1][self u16][tick u16][count u16]              7 bytes
Entity: [nid u16][x i16][y i16][z i16][yaw u8][seq u16]           11 bytes per player
```

Coordinates are quantized in 1 cm steps (±327 m).

## Ticks

| Component | Rate | Notes |
|---|---|---|
| Server simulation | 20 Hz | 50 ms steps, enough for first-person movement |
| Snapshots | 20 Hz | 11 bytes per player |
| Client input | 20 Hz | `{type:'input', seq, mx, mz, yaw}` |
| Prediction | local | the client runs its own player and snaps to the server position when it drifts more than 0.75 m |

Remote players are created when they first appear in a snapshot and removed on `leave`. Players do not collide with each other.


## Client API (`net` pack)

```js
import { netPlugin } from 'risejs-core/packs/net';

app.use(netPlugin, {
  url: 'wss://game.example',
  room: 'city-01',
  name: 'player',
  token: '<token from POST /api/auth>',
  map: 'arena',          // optional: server-side collision map
});

// app.net is the NetClient. It connects after 'app:ready' and reconnects by itself.
app.events.on('net:status', (status) => {});
app.events.on('net:chat', (msg) => {});
app.events.on('net:hit', (msg) => {});
app.events.on('net:wallet', (msg) => {});

app.net.fire('rifle');            // the server keeps ammo/rpm and computes hits
app.net.reload('rifle');
app.net.loot('crate-17', 'crate'); // the server rolls; idempotent
```

The pack sends player input every tick and applies snapshots (remote players, corrections) by itself.


The pack is **optional**: a game that does not install it runs offline.

### Server-authoritative combat & economy

| Task | Client does | Server does |
|---|---|---|
| Shooting | sends `{type:'fire', weapon}` | `WeaponState` (ammo/rpm/reload) + `resolveShot` (range/angle/LOS) |
| Damage | does not send | picks by weapon id, broadcasts `hit` |
| Loot | sends `crateId` | rolls seed `player:crateId`, writes the wallet, returns `loot` |
| Wallet | reads `GET /api/wallet/:game/:player` | D1 ledger keyed by `(game,player,key)` |

The collision map uses **a single source**: `src/games/<game>/map.js` → the client builds the geometry (`world.js`) and the
server
loads it from the `map=arena` request parameter of the WebSocket URL (`CollisionMap`). `npm run make:map` exports `public/maps/*.json`.

```js
// WebSocket request parameters sent to the server; an unknown map does not exist ⇒ blocks nothing (fail-open), no error
const ws = new WebSocket(`${base}/ws?room=arena&map=arena&x=0&z=8`);
```

## Persistent data

Rise ships two storage paths: `SaveSlot` (localStorage, in the core) and the `persistence` pack (HTTP, against the example
server). For anything else, write an adapter with this shape:

```js
export class Storage {
  async load(gameId, playerId) {}
  async save(gameId, playerId, patch) {}
}
```

| Backend | When to use | Notes |
|---|---|---|
| localStorage (`SaveSlot`) | default, single-player | synchronous, limited to ~5 MB |
| HTTP (`persistence` pack or your own) | game with its own backend | `fetch` + token, batch writes |
| Redis | realtime server, hot sessions | TTL, hash per player |
| Postgres | long-term data, queries | JSONB for state |
| Supabase | want realtime + auth out of the box | Realtime channel per zone |
| Firebase | similar, Google ecosystem | Firestore + presence |

Principle: **do not write position to the DB**. Write only when: changing zone, completing an objective, leaving the game.

## Choosing a realtime backend

| Option | Pros | Cons |
|---|---|---|
| Custom WebSocket (Node `ws`) + Redis pub/sub | light, full control, no per-message cost, scales to multiple nodes | you handle scaling, auth, deploy |
| Managed realtime service | auth + DB + broadcast out of the box, quick to prototype | latency/message limits, hard to get an exact 20 Hz tick |
| Cloudflare Durable Objects | 1 object = 1 zone, scales automatically | locked in to Cloudflare |

The example server in the repository uses Durable Objects.

## Reference deployment (optional, not a dependency)

`server/` in the repository is a **runnable example** on Cloudflare, used for testing. It is not part of the npm package. The framework imports nothing from it:
if your game does not install the net pack (`app.use(netPlugin, { url })`) and you do not deploy `server/`, Rise still runs offline as before.

| Endpoint | Binding | Purpose |
|---|---|---|
| `GET /api/health` | — | Liveness check |
| `POST /api/admin/migrate` | D1 | Creates the `saves`, `events` tables (dev) |
| `GET/PUT /api/save/:game/:player` | D1 | Save/read state |
| `POST/GET /api/events` | D1 | Anti-cheat telemetry |
| `PUT/GET /api/blob/:key` | R2 | Replays, images, blobs |
| `GET /ws?room=` | Durable Object | Realtime per zone |

### Run locally

```bash
npm run server        # wrangler dev --local --port 8787
npm run server:test   # protocol test: welcome / peers / zone / chat
```

On Windows, if D1/R2 return 500 with the default path (the path is too long), use
`--persist-to C:\tmp\rise-state` — the `npm run server` script already sets it.

### Prediction and reconciliation

- Client at 20 Hz: `{type:'input', seq, mx, mz, yaw}`; `mx/mz` is the intended direction in world space.
- The server simulates in 50 ms steps using `src/shared/sim.js` (shared by client/server) and returns a 20 Hz snapshot
  `{type:'snapshot', tick, self, players:[{id,x,z,yaw,seq,name,color}]}`.
- The client predicts with the real `Player` (with collisions); when a snapshot arrives, it compares the server position with the position stored
  at that `seq`. Drift **> 0.75 m** → snap to the server and count `stats.corrections`.
- Server-side collision is optional: when the connection names a collision map, the server blocks movement through walls and checks
  line of sight with `CollisionMap`. Without a map the server does not simulate colliders; the client blocks itself near walls and any
  drift is fixed by the snap.

### Auth, HTTP save, chat

- `POST /api/auth {player}` returns an expiring token `v1.<player>.<exp>.<sig>` signed with HMAC-SHA256 (`AUTH_SECRET`). Enable checking with
  `--var AUTH_REQUIRED:1`; a missing/wrong token → 401.
- Client: `app.use(persistencePlugin, { base, game, player })` → `app.remote.auth()`, `.read()`, `.write()`, `.event()`.
- Chat UI in the `net` pack: **T** opens, **Enter** sends, **Esc** closes; keys are blocked from reaching the game while typing.

Limits: there is no token refresh endpoint; chat has no moderation beyond the word filter and rate limit; `AUTH_REQUIRED` defaults to 0 for development.

### Per-zone shards (Durable Objects)

- Each zone is its own DO: `idFromName("<room>:<zx>:<zz>")`.
- The client connects with `zx, zz, x, z`; the server simulates and sends `rezone` if the player leaves the zone
  → the client reconnects to the correct new zone by itself.
- Every 200 ms, each DO pushes its player list to the 8 neighboring zones through a DO-to-DO `fetch`
  (`/internal/relay`), cached with an 800 ms TTL.
- Snapshot = local players + players from neighboring zones that are still fresh.

Redis or another pub/sub is not needed for this setup. If you deploy across several geographic regions, replace the relay with
Redis Streams or Workers Queues.

## Security and anti-cheat

What the example server does (details in [anticheat](anticheat.md)):

- Tokens are signed and expire; the server verifies the signature and does not trust a player id sent by the client.
- Rate limits: 120 messages per second per session, 5 chat messages per 5 seconds.
- Moves faster than 9.5 m/s or longer than 6 m in one tick are rejected and rolled back; hits are computed by the server.
- Data outside the interest area is not sent, which limits wallhacks at the data level.


## Lobby and chat

- Chat has 3 channels (`zone` / `all` / `dm`): `zone` is sent only within the 3×3 neighboring zones (`adjacent`).
- **Lobby**: `POST /api/rooms` writes `room:<name>` to KV (TTL 60 s), `GET /api/rooms` returns
  `{ rooms, total, open }`. Client: `lobby` pack, **L** opens it, **Q** quick match (`pickRoom`).
- Client-side chat filtering: `maskWords` (masks banned words), `SpamGuard` (blocks repeated messages), `IgnoreList`.
- Server-side chat rate limit: `ChatGuard` 5 messages / 5 s / player.
