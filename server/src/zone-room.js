/**
 * ZoneRoom: a Durable Object for ONE zone (phase 4).
 *
 * - The client connects with `?room=base&zx=&zz=&x=&z=`
 * - The server simulates position; when a player leaves the zone it sends `rezone` and closes
 * - Every 200 ms it pushes players to the 8 neighbouring zones (DO-to-DO, no Redis needed)
 * - A snapshot holds local players + the cache from neighbouring zones
 */
import { stepPlayer, MAX_STEP } from '../../src/shared/sim.js';
import { encodeSnapshot } from '../../src/shared/snapshot.js';
import { clampInput, acceptMove, validHit, ChatGuard } from './ac.js';
import { LIMITS, takeToken, sanitizeName, sanitizeChat, clampRange, safeJsonParse } from './security.js';
import { acceptSeq, canHit } from './session-guard.js';
import { weaponOf, resolveShot } from '../../src/shared/weapons.js';
import { WeaponState } from '../../src/shared/combat.js';
import { CollisionMap } from '../../src/shared/collision.js';
import { GAME_MAPS } from '../../src/games/arena/map.js';
import { ShotPattern } from './detection.js';
import { Wallet, rollLoot } from './economy.js';
const TICK_MS = 50;
const RELAY_MS = 200;
const ZONE_SIZE = 64;
const NEIGHBOR_TTL = 800;

const zoneOf = (x, z) => [Math.floor(x / ZONE_SIZE), Math.floor(z / ZONE_SIZE)];
const adjacent = (a, b) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;

const snap = (s) => ({
  nid: s.nid,
  x: s.x,
  y: 0,
  z: s.z,
  yaw: s.yaw,
  seq: s.seq,
});

export class ZoneRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.nextNid = 1;
    this.neighbors = new Map(); // key -> { players, at }
    this.base = null;
    this.zone = null;
    this.tick = 0;
    this.lastBroadcast = 0;
    this.lastRelay = 0;
    this.chatGuard = new ChatGuard({ max: 5, windowMs: 5000 });
    this.mapName = null;
    this.collision = new CollisionMap();
  }

  key(zx, zz) {
    return `${this.base}:${zx}:${zz}`;
  }

  /** Loads the map from the registry; an unknown or missing map blocks nothing (empty map). */
  loadMap(name) {
    if (!name) return false;
    const data = GAME_MAPS[name];
    if (!data) {
      this.collision = new CollisionMap();
      this.mapName = null;
      return false;
    }
    this.collision = new CollisionMap(data);
    this.mapName = name;
    return true;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Load/override the map (plain data): internal only, never exposed to clients
    if (url.pathname === '/internal/map' && request.method === 'POST') {
      const parsed = safeJsonParse(await request.text());
      if (!parsed.ok || !parsed.value) return new Response('bad json', { status: 400 });
      this.collision = new CollisionMap(parsed.value);
      this.mapName = parsed.value.name || 'custom';
      return new Response('ok');
    }

    if (url.pathname === '/internal/relay' && request.method === 'POST') {
      const body = await request.json();
      this.neighbors.set(body.from, { players: body.players || [], at: Date.now() });
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(
        JSON.stringify({
          base: this.base,
          zone: this.zone,
          sessions: this.sessions.size,
          neighbors: [...this.neighbors.keys()],
          tick: this.tick,
        }),
        { headers: { 'content-type': 'application/json' } }
      );
    }

    this.base = url.searchParams.get('room') || 'lobby';
    this.zone = [Number(url.searchParams.get('zx')) || 0, Number(url.searchParams.get('zz')) || 0];
    this.loadMap(url.searchParams.get('map') || (GAME_MAPS[this.base] ? this.base : null));

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const x = Number(url.searchParams.get('x')) || 0;
    const z = Number(url.searchParams.get('z')) || 0;

    const id = crypto.randomUUID().slice(0, 8);
    const nid = this.nextNid++;
    const session = {
      id,
      nid,
      ws: server,
      x: Math.max(-4000, Math.min(4000, x)),
      z: Math.max(-4000, Math.min(4000, z)),
      yaw: 0,
      seq: 0,
      input: { mx: 0, mz: 0, yaw: 0 },
      lastInputAt: 0,
      lastSeq: 0,
      lastHitAt: 0,
      name: 'player',
      color: 0x3a6ea5,
      hp: 100,
      weapons: new Map(),
      detector: new ShotPattern(),
      wallet: new Wallet(),
      opened: new Set(),
      rate: { count: 0, start: 0 },
    };
    this.sessions.set(id, session);

    server.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || event.data.length > LIMITS.messageBytes) return;
      const parsed = safeJsonParse(event.data);
      if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return;
      this.onMessage(session, parsed.value);
    });

    server.addEventListener('close', () => {
      this.sessions.delete(id);
      const leave = JSON.stringify({ type: 'leave', id });
      for (const s of this.sessions.values()) s.ws.send(leave);
      this.forceBroadcast();
    });

    server.send(
      JSON.stringify({
        type: 'welcome',
        id,
        nid,
        zoneSize: ZONE_SIZE,
        zone: this.zone,
        tickMs: TICK_MS,
        protocol: 2,
        serverTime: Date.now(),
      })
    );
    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(session, msg) {
    if (!takeToken(session.rate, Date.now())) return;
    // record clock drift for detection, do NOT block (a client clock can be legitimately wrong)
    if (Number.isFinite(Number(msg.clientTime))) session.clockSkew = Number(msg.clientTime) - Date.now();

    if (msg.type === 'input') {
      const now = Date.now();
      if (!acceptSeq(session, msg.seq)) return;
      const dt = session.lastInputAt ? Math.min(0.3, (now - session.lastInputAt) / 1000) : 0;
      session.lastInputAt = now;

      session.input = clampInput({ mx: msg.mx, mz: msg.mz, yaw: msg.yaw });
      session.seq = Number(msg.seq) || session.seq;
      if (msg.name) session.name = sanitizeName(msg.name, session.name);
      if (msg.color != null) session.color = msg.color;

      const before = { x: session.x, z: session.z };
      let remain = dt;
      while (remain > 0) {
        const h = Math.min(MAX_STEP, remain);
        stepPlayer(session, session.input, h);
        remain -= h;
      }

      // anti-cheat: block teleports and abnormal speed
      if (!acceptMove(before, { x: session.x, z: session.z }, Math.max(dt, 0.001))) {
        session.x = before.x;
        session.z = before.z;
        session.flags = (session.flags || 0) + 1;
        session.ws.send(JSON.stringify({ type: 'anticheat', reason: 'speed' }));
      } else if (this.collision.size) {
        // server-side collision: no walking through walls (the client may have disabled collision)
        const moved = this.collision.resolveMove(before, { x: session.x, z: session.z }, 0.35);
        if (moved.blocked) {
          session.x = moved.x;
          session.z = moved.z;
          session.flags = (session.flags || 0) + 1;
        }
      }

      // left the zone → ask the client to reconnect to the right zone
      const [zx, zz] = zoneOf(session.x, session.z);
      if (zx !== this.zone[0] || zz !== this.zone[1]) {
        session.ws.send(JSON.stringify({ type: 'rezone', zx, zz }));
        session.ws.close();
        return;
      }

      this.maybeBroadcast();
      return;
    }

    if (msg.type === 'chat') {
      if (!this.chatGuard.accept(session.nid)) {
        session.ws.send(
          JSON.stringify({ type: 'chat', channel: 'system', name: 'server', text: 'You are sending messages too fast.' })
        );
        return;
      }
      const text = sanitizeChat(msg.text);
      const channel = msg.channel === 'dm' ? 'dm' : msg.channel === 'all' ? 'all' : 'zone';
      const payload = { type: 'chat', channel, from: session.nid, name: session.name, text };

      if (channel === 'dm' && msg.to) {
        const target = [...this.sessions.values()].find((s) => s.name === msg.to);
        if (target) target.ws.send(JSON.stringify(payload));
        session.ws.send(JSON.stringify(payload));
        return;
      }

      const fromZone = zoneOf(session.x, session.z);
      for (const s of this.sessions.values()) {
        const z = zoneOf(s.x, s.z);
        if (channel === 'all' || adjacent(fromZone, z)) s.ws.send(JSON.stringify(payload));
      }
      return;
    }

    if (msg.type === 'hit') {
      if (!canHit(session, Date.now())) return;
      const target = [...this.sessions.values()].find((s) => s.nid === msg.target);
      if (!target) return;

      const ok = validHit({
        from: { x: session.x, z: session.z },
        to: { x: target.x, z: target.z },
        yaw: session.input?.yaw ?? 0,
        range: clampRange(msg.range),
      });

      if (!ok) {
        session.flags = (session.flags || 0) + 1;
        session.ws.send(JSON.stringify({ type: 'anticheat', reason: 'hit' }));
        return;
      }

      // Legacy `hit`: client damage is NOT used; it comes from the weapon id
      const legacy = weaponOf(typeof msg.weapon === 'string' ? msg.weapon : 'rifle');
      target.hp = Math.max(0, (target.hp ?? 100) - legacy.damage);
      const payload = { type: 'hit', from: session.nid, target: target.nid, hp: target.hp, damage: legacy.damage, weapon: legacy.id };
      for (const s of this.sessions.values()) s.ws.send(JSON.stringify(payload));
      return;
    }

    // Server-authoritative firing: the client only sends direction + weapon id; damage/range/LOS are the server's
    if (msg.type === 'fire') {
      const w = weaponOf(typeof msg.weapon === 'string' ? msg.weapon : 'rifle');
      let state = session.weapons.get(w.id);
      if (!state) {
        state = new WeaponState(w, Date.now());
        session.weapons.set(w.id, state);
      }

      const now = Date.now();
      if (!state.fire(now)) return;

      const dir = { x: -Math.sin(session.input.yaw), z: -Math.cos(session.input.yaw) };
      const targets = [...this.sessions.values()]
        .filter((s) => s.nid !== session.nid)
        .map((s) => ({ id: s.nid, pos: { x: s.x, z: s.z }, dead: (s.hp ?? 100) <= 0, ref: s }));

      const res = resolveShot({
        origin: { x: session.x, z: session.z },
        dir,
        targets,
        obstacles: this.collision.boxes.filter((b) => b.cover).map((b) => ({ min: { x: b.minX, z: b.minZ }, max: { x: b.maxX, z: b.maxZ } })),
        weapon: w,
        ignoreId: session.nid,
      });

      session.detector.record({ t: now, hit: res.hit });
      const flags = session.detector.flags();
      if (flags.length) {
        session.ws.send(JSON.stringify({ type: 'anticheat', reason: flags.join(',') }));
      }

      if (!res.hit) return;
      const target = res.target.ref;
      target.hp = Math.max(0, (target.hp ?? 100) - w.damage);
      const payload = {
        type: 'hit',
        from: session.nid,
        target: target.nid,
        hp: target.hp,
        damage: w.damage,
        weapon: w.id,
      };
      for (const s of this.sessions.values()) s.ws.send(JSON.stringify(payload));
      return;
    }

    if (msg.type === 'reload') {
      const w = weaponOf(typeof msg.weapon === 'string' ? msg.weapon : 'rifle');
      const state = session.weapons.get(w.id) || new WeaponState(w, Date.now());
      session.weapons.set(w.id, state);
      state.reload(Date.now());
      return;
    }

    // Loot: the server rolls (seed = player + crateId) → reopening cannot reroll or dupe
    if (msg.type === 'loot') {
      const crateId = String(msg.crateId || '').slice(0, 40);
      if (!crateId) return;
      const key = `loot:${crateId}`;
      if (session.opened.has(key)) {
        session.ws.send(
          JSON.stringify({ type: 'loot', crateId, ok: true, duplicate: true, drops: [], wallet: session.wallet.toJSON() })
        );
        return;
      }
      const table = msg.table === 'boss' ? 'boss' : 'crate';
      const drops = rollLoot(table, `${session.id}:${crateId}`);
      const res = session.wallet.applyLoot(key, drops);
      session.opened.add(key);
      session.ws.send(
        JSON.stringify({ type: 'loot', crateId, ok: res.ok, drops: res.applied ? drops : [], wallet: session.wallet.toJSON() })
      );
      return;
    }

    if (msg.type === 'wallet') {
      session.ws.send(JSON.stringify({ type: 'wallet', wallet: session.wallet.toJSON() }));
    }
  }

  maybeBroadcast() {
    const now = Date.now();
    if (now - this.lastBroadcast < TICK_MS) return;
    this.lastBroadcast = now;
    this.tick++;

    this.relay(now);
    this.sendSnapshots();
  }

  forceBroadcast() {
    this.tick++;
    this.sendSnapshots();
  }

  collectRemote() {
    const now = Date.now();
    const remote = [];
    for (const [key, entry] of this.neighbors) {
      if (now - entry.at > NEIGHBOR_TTL) continue;
      const [zx, zz] = key.split(':').slice(-2).map(Number);
      if (!adjacent(this.zone, [zx, zz])) continue;
      remote.push(...entry.players);
    }
    return remote;
  }

  sendSnapshots() {
    const local = [...this.sessions.values()].map(snap);
    const remote = this.collectRemote();

    for (const s of this.sessions.values()) {
      const players = [...local, ...remote];
      const z = zoneOf(s.x, s.z);
      const visible = players.filter((p) => adjacent(z, zoneOf(p.x, p.z)));
      s.ws.send(encodeSnapshot({ self: s.nid, tick: this.tick, players: visible }));
    }
  }

  relay(now) {
    if (now - this.lastRelay < RELAY_MS) return;
    this.lastRelay = now;

    const players = [...this.sessions.values()].map(snap);
    if (!players.length) return;

    const body = JSON.stringify({ from: this.key(this.zone[0], this.zone[1]), players });

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const id = this.env.ROOM.idFromName(this.key(this.zone[0] + dx, this.zone[1] + dz));
        const stub = this.env.ROOM.get(id);
        try {
          stub
            .fetch('https://do/internal/relay', { method: 'POST', body })
            .catch(() => {});
        } catch {
          /* ignore */
        }
      }
    }
  }
}

// keep the old export so wrangler.toml does not break
export { ZoneRoom as Room };
