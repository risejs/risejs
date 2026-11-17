/**
 * Rise server — Cloudflare Worker.
 *  - /ws                Durable Object room (realtime, zone-filtered)
 *  - /api/save/:g/:p    D1 persistence
 *  - /api/events        D1 telemetry (anticheat)
 *  - /api/blob/:key     R2 replay/blob
 *  - /api/rooms         lobby: room list + player counts
 */

export { ZoneRoom as Room } from './zone-room.js';
import { normalizeRoom, roomSummary, ROOM_TTL } from './rooms.js';
import { normalizeRoomName, validRoom, safeJsonParse } from './security.js';
import { signToken, verifyToken } from './auth.js';
import { applyWallet, readWallet, WALLET_SCHEMA } from './wallet-db.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,PUT,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });

const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

async function authorized(request, env, player) {
  if (env.AUTH_REQUIRED !== '1') return true;
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const res = await verifyToken(env.AUTH_SECRET || 'dev', token);
  return res.ok && res.player === player;
}

async function isAdmin(request, env) {
  return authorized(request, env, 'admin');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (env.AUTH_REQUIRED !== '1') {
      warnOnce('auth-off', '[rise-server] AUTH_REQUIRED=0: write/save APIs are open, use this for development only');
    }

    // Block unknown origins when ALLOWED_ORIGIN is configured (recommended when deployed)
    if (env.ALLOWED_ORIGIN) {
      const origin = request.headers.get('origin');
      if (origin && origin !== env.ALLOWED_ORIGIN) return json({ error: 'forbidden origin' }, 403);
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/ws') {
      const room = normalizeRoomName(url.searchParams.get('room'));
      const zx = Number(url.searchParams.get('zx')) || 0;
      const zz = Number(url.searchParams.get('zz')) || 0;

      // With auth on: the WebSocket needs a player and a valid HMAC token
      if (env.AUTH_REQUIRED === '1') {
        const player = url.searchParams.get('player') || '';
        const token = url.searchParams.get('token') || '';
        const res = player && token ? await verifyToken(env.AUTH_SECRET || 'dev', token) : { ok: false };
        if (!res.ok || res.player !== player) return json({ error: 'unauthorized' }, 401);
      }

      const id = env.ROOM.idFromName(`${room}:${zx}:${zz}`);
      return env.ROOM.get(id).fetch(request);
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'rise-server', zone: env.ZONE_SIZE ?? '64' });
    }

    // D1 migration (local/dev; production should run wrangler d1 migrations)
    if (url.pathname === '/api/admin/migrate' && request.method === 'POST') {
      await env.DB.batch([
        env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS saves (game TEXT NOT NULL, player TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (game, player))'
        ),
        env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT, player TEXT, type TEXT, payload TEXT, created_at INTEGER NOT NULL)'
        ),
        env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_events_type ON events (type, created_at)'),
        ...WALLET_SCHEMA.map((sql) => env.DB.prepare(sql)),
      ]);
      return json({ ok: true, migrated: true });
    }

    // ---- auth ----
    if (url.pathname === '/api/auth' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const player = String(body.player || '').slice(0, 40);
      if (!player) return json({ error: 'player required' }, 400);
      const ttlSec = Math.max(60, Number(env.AUTH_TTL_SEC) || 86400);
      const token = await signToken(env.AUTH_SECRET || 'dev', player, { ttlSec });
      return json({ ok: true, player, token, expiresIn: ttlSec, required: env.AUTH_REQUIRED === '1' });
    }

    // ---- D1: save ----
    if (url.pathname.startsWith('/api/save/')) {
      const [, , , game, player] = url.pathname.split('/');
      if (!game || !player) return json({ error: 'game/player required' }, 400);
      if (!(await authorized(request, env, player))) return json({ error: 'unauthorized' }, 401);

      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT data, updated_at FROM saves WHERE game = ? AND player = ?')
          .bind(game, player)
          .first();
        return json(row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : { data: null });
      }

      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        await env.DB.prepare(
          `INSERT INTO saves (game, player, data, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(game, player) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        )
          .bind(game, player, JSON.stringify(body.data ?? body), Date.now())
          .run();
        return json({ ok: true });
      }
      return json({ error: 'method' }, 405);
    }

    // ---- D1: telemetry ----
    if (url.pathname === '/api/events') {
      if (request.method === 'POST') {
        const raw = await request.text();
        if (raw.length > 64 * 1024) return json({ error: 'payload too large' }, 413);
        const parsed = safeJsonParse(raw);
        if (!parsed.ok || !parsed.value) return json({ error: 'invalid json' }, 400);

        const body = parsed.value;
        const list = Array.isArray(body.events) ? body.events.slice(0, 100) : [body];
        const stmt = env.DB.prepare('INSERT INTO events (game, player, type, payload, created_at) VALUES (?, ?, ?, ?, ?)');

        const inserts = list.map((e) =>
          stmt.bind(
            String(body.game ?? e.game ?? 'unknown').slice(0, 40),
            String(body.player ?? e.player ?? '').slice(0, 40) || null,
            String(e.type ?? 'unknown').slice(0, 40),
            JSON.stringify(e.payload ?? e).slice(0, 4000),
            Number(e.t) || Date.now()
          )
        );
        if (inserts.length) await env.DB.batch(inserts);
        return json({ ok: true, count: inserts.length });
      }
      if (env.AUTH_REQUIRED === '1' && !(await isAdmin(request, env))) {
        return json({ error: 'unauthorized' }, 401);
      }
      const rows = await env.DB.prepare(
        'SELECT game, player, type, payload, created_at FROM events ORDER BY id DESC LIMIT 50'
      ).all();
      return json({ events: rows.results ?? [] });
    }

    // ---- KV: session/cache ----
    if (url.pathname.startsWith('/api/kv/')) {
      const key = decodeURIComponent(url.pathname.slice('/api/kv/'.length));
      if (!key) return json({ error: 'key required' }, 400);

      if (env.AUTH_REQUIRED === '1') {
        const player = url.searchParams.get('player') || request.headers.get('x-player') || '';
        if (!(await authorized(request, env, player))) return json({ error: 'unauthorized' }, 401);
      }

      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.text();
        const ttl = Number(url.searchParams.get('ttl')) || undefined;
        await env.CACHE.put(key, body, ttl ? { expirationTtl: ttl } : undefined);
        return json({ ok: true, key });
      }
      if (request.method === 'DELETE') {
        await env.CACHE.delete(key);
        return json({ ok: true });
      }
      const value = await env.CACHE.get(key);
      return value === null ? json({ error: 'not found' }, 404) : json({ key, value });
    }

    // ---- Lobby: rooms + player counts (KV, 60 s TTL) ----
    if (url.pathname === '/api/rooms') {
      if (request.method === 'POST') {
        const parsed = safeJsonParse(await request.text());
        if (!parsed.ok || typeof parsed.value !== 'object') return json({ error: 'invalid json' }, 400);
        const body = parsed.value;
        const name = String(body.room ?? body.name ?? '');
        if (!validRoom(name)) return json({ error: 'invalid room name' }, 400);
        const room = normalizeRoom({ ...body, room: name, ts: Date.now() });
        room.players = Math.max(0, Math.min(64, room.players));
        room.max = Math.max(1, Math.min(64, room.max));
        await env.CACHE.put(`room:${room.name}`, JSON.stringify(room), { expirationTtl: ROOM_TTL });
        return json({ ok: true, room });
      }

      const listed = await env.CACHE.list({ prefix: 'room:' });
      const rooms = await Promise.all(
        (listed.keys || []).map(async (k) => {
          const raw = await env.CACHE.get(k.name);
          try {
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })
      );
      const alive = rooms.filter((r) => r && Date.now() - r.ts < ROOM_TTL * 1000);
      return json(roomSummary(alive));
    }

    // ---- R2: blob ----
    if (url.pathname.startsWith('/api/blob/')) {
      const key = decodeURIComponent(url.pathname.slice('/api/blob/'.length));
      if (!key) return json({ error: 'key required' }, 400);

      if (env.AUTH_REQUIRED === '1') {
        const player = url.searchParams.get('player') || request.headers.get('x-player') || '';
        if (!(await authorized(request, env, player))) return json({ error: 'unauthorized' }, 401);
      }

      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.arrayBuffer();
        const contentType = request.headers.get('content-type') || 'application/octet-stream';
        await env.BLOBS.put(key, body, { httpMetadata: { contentType } });
        return json({ ok: true, key, size: body.byteLength });
      }

      const obj = await env.BLOBS.get(key);
      if (!obj) return json({ error: 'not found' }, 404);
      return new Response(obj.body, {
        headers: {
          'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
          ...CORS,
        },
      });
    }

    // ---- Server wallet (idempotent) ----
    if (url.pathname.startsWith('/api/wallet/')) {
      const parts = url.pathname.split('/').filter(Boolean); // api, wallet, game, player, action
      const [, , game, player, action] = parts;
      if (!game || !player) return json({ error: 'game/player required' }, 400);

      if (request.method === 'GET') {
        if (!(await authorized(request, env, player))) return json({ error: 'unauthorized' }, 401);
        const wallet = await readWallet(env.DB, game, player);
        return json({ ok: true, ...wallet });
      }

      if (request.method === 'POST' && action === 'apply') {
        const parsed = safeJsonParse(await request.text());
        if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return json({ error: 'invalid json' }, 400);
        const body = parsed.value;
        const op = body.op === 'spend' ? 'spend' : 'grant';

        // Grant is admin only: players cannot add money or items to themselves
        const admin = op === 'grant' ? await isAdmin(request, env) : false;
        if (op === 'grant' && !admin) return json({ error: 'grant requires admin' }, 403);
        if (op === 'spend' && !(await authorized(request, env, player))) return json({ error: 'unauthorized' }, 401);

        const res = await applyWallet(env.DB, {
          game: String(game).slice(0, 40),
          player: String(player).slice(0, 40),
          key: body.key,
          op,
          currency: body.currency === 'gold' ? 'gold' : String(body.currency || 'gold').slice(0, 20),
          amount: Number(body.amount) || 0,
          item: body.item ? String(body.item).slice(0, 40) : null,
          qty: Number(body.qty) || 0,
          reason: body.reason,
        });
        return json(res, res.ok ? 200 : 400);
      }

      return json({ error: 'method' }, 405);
    }

    return json({ ok: true, hint: 'see /api/health' });
  },
};
