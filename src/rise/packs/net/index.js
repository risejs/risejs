import * as THREE from 'three';
import './chat.css';
import { decodeSnapshot } from '../../../shared/snapshot.js';
import { Character } from '../../player/character.js';
import { Entity } from '../../world.js';

/**
 * Networking pack: server-authoritative movement with client prediction and reconciliation.
 *
 * The client sends input at 20 Hz; the server simulates and returns snapshots at 20 Hz.
 * The client runs its own Player (prediction) and snaps to the server position when the error exceeds 0.75 m.
 */
export class NetClient {
  constructor({ url, room = 'lobby', name = 'player', color = 0x3a6ea5, zone = [0, 0], start = [0, 0], token = null, player = null, map = null, onSnapshot, onStatus, onChat, onLeave, onHit, onWallet }) {
    this.url = url;
    this.room = String(room).replace(/[^\w-]/g, '').slice(0, 40) || 'lobby';
    this.name = name;
    this.color = color;
    this.zone = zone;
    this.start = start;
    this.token = token;
    this.player = player || name;
    this.clockOffset = 0;
    this.lastTick = 0;
    this.protocol = 1;
    this.onSnapshot = onSnapshot;
    this.onStatus = onStatus;
    this.onChat = onChat;
    this.onLeave = onLeave;
    this.onHit = onHit;
    this.onWallet = onWallet;
    this.wallet = null;
    this.fireSeq = 0;

    this.status = 'idle';
    this.selfId = null;
    this.selfNid = null;
    this.ws = null;
    this.retry = 0;
    this.disposed = false;
    this._retryTimer = null;
    this.chatLog = [];
    this.stats = { sent: 0, snaps: 0, corrections: 0, lastError: 0 };
  }

  connect() {
    if (this.ws || this.disposed) return;
    this.lastTick = 0;
    this.clockOffset = 0;
    const u = new URL(this.url);
    u.searchParams.set('room', this.room);

    if (this.startProvider) {
      const p = this.startProvider();
      this.start = [p[0], p[1]];
      this.zone = [Math.floor(p[0] / 64), Math.floor(p[1] / 64)];
    }

    u.searchParams.set('zx', String(this.zone[0] ?? 0));
    u.searchParams.set('zz', String(this.zone[1] ?? 0));
    u.searchParams.set('x', String(Math.round(this.start[0] ?? 0)));
    u.searchParams.set('z', String(Math.round(this.start[1] ?? 0)));
    if (this.map) u.searchParams.set('map', this.map);
    if (this.token) {
      u.searchParams.set('player', this.player);
      u.searchParams.set('token', this.token);
    }

    this.status = 'connecting';
    this.onStatus?.(this.status);

    const ws = new WebSocket(u);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.status = 'open';
      this.retry = 0;
      this.onStatus?.(this.status);
    });

    ws.addEventListener('message', (e) => {
      if (this.disposed) return;
      if (typeof e.data !== 'string') {
        const snap = decodeSnapshot(e.data);
        if (snap) {
          // guards against replayed or out-of-order packets: the tick must increase
          if (this.lastTick && snap.tick <= this.lastTick) return;
          this.lastTick = snap.tick;
          this.stats.snaps++;
          this.onSnapshot?.(snap);
        }
        return;
      }

      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        this.selfId = msg.id;
        this.selfNid = msg.nid;
        this.protocol = msg.protocol || 1;
        if (Number.isFinite(msg.serverTime)) this.clockOffset = Date.now() - msg.serverTime;
      } else if (msg.type === 'rezone') {
        ws.close();
      } else if (msg.type === 'leave') this.onLeave?.(msg.id);
      else if (msg.type === 'chat') {
        this.chatLog.push(msg);
        if (this.chatLog.length > 30) this.chatLog.shift();
        this.onChat?.(msg);
      } else if (msg.type === 'hit') {
        this.onHit?.(msg);
      } else if (msg.type === 'loot' || msg.type === 'wallet') {
        this.wallet = msg.wallet || this.wallet;
        this.onWallet?.(msg);
      }
    });

    ws.addEventListener('close', () => {
      if (this.disposed) return;
      this.status = 'closed';
      this.ws = null;
      this.onStatus?.(this.status);
      this._retryTimer = setTimeout(() => this.connect(), Math.min(8000, 800 * 2 ** this.retry++));
    });

    ws.addEventListener('error', () => this.onStatus?.('error'));
  }

  send(data) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(data));
    this.stats.sent++;
    return true;
  }

  sendInput({ seq, mx, mz, yaw }) {
    return this.send({ type: 'input', seq, mx, mz, yaw, name: this.name, color: this.color, clientTime: Date.now() });
  }

  sendChat(text) {
    return this.send({ type: 'chat', text });
  }

  /** Fire: the server computes damage, range and line of sight; the client only sends the weapon id. */
  fire(weapon = 'rifle') {
    return this.send({ type: 'fire', weapon, seq: ++this.fireSeq, clientTime: Date.now() });
  }

  reload(weapon = 'rifle') {
    return this.send({ type: 'reload', weapon, clientTime: Date.now() });
  }

  /** Open a crate: the server rolls (no result is accepted from the client); idempotent per crateId. */
  loot(crateId, table = 'crate') {
    return this.send({ type: 'loot', crateId: String(crateId), table });
  }

  wallet() {
    return this.send({ type: 'wallet' });
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }

  /** Close for good: cancels the reconnect timer, closes the socket and does not reconnect. */
  dispose() {
    this.disposed = true;
    clearTimeout(this._retryTimer);
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {}
  }
}

function createPeer(app, peer, map) {
  const color = 0x335577 + ((peer.nid * 97) % 0x777777);
  const character = new Character({ color });
  const entity = new Entity({ mesh: character.group, tags: ['remote'], autoCollider: false, data: { nid: peer.nid } });
  entity.mesh.position.set(peer.x, peer.y ?? 0, peer.z);
  app.world.add(entity);

  const rec = {
    id: peer.nid,
    character,
    entity,
    plate: app.nameplates?.add?.(entity, { name: peer.name || `P${peer.nid}` }) || null,
    target: new THREE.Vector3(peer.x, peer.y ?? 0, peer.z),
    targetYaw: peer.yaw ?? 0,
    lastSeen: performance.now(),
    speed: 0,
  };
  map.set(peer.nid, rec);
  return rec;
}

export function netPlugin(app, options = {}) {
  const { url, room = 'arena', name = 'player', color = 0x3a6ea5, token = null, player = null, map = null } = options;
  if (!url) throw new Error('[net] missing url');

  const peers = new Map();
  const offs = [];
  const pending = [];
  let seq = 0;
  let sendAcc = 0;
  let lastTick = 0;

  const client = new NetClient({
    url,
    room,
    name,
    color,
    token,
    player,
    map,
    onSnapshot(msg) {
      lastTick = msg.tick;
      const now = performance.now();
      const seen = new Set();

      for (const p of msg.players) {
        if (p.nid === client.selfNid) {
          // reconciliation: compare with the position predicted at that seq
          const pred = pending.find((x) => x.seq === p.seq);
          if (pred) {
            const err = Math.hypot(pred.x - p.x, pred.z - p.z);
            client.stats.lastError = +err.toFixed(2);
            if (err > 0.75) {
              app.player.pos.x = p.x;
              app.player.pos.z = p.z;
              client.stats.corrections++;
            }
            for (let i = pending.length - 1; i >= 0; i--) if (pending[i].seq <= p.seq) pending.splice(i, 1);
          }
          continue;
        }

        seen.add(p.nid);
        const rec = peers.get(p.nid) || createPeer(app, p, peers);
        rec.target.set(p.x, p.y ?? 0, p.z);
        rec.targetYaw = p.yaw ?? 0;
        rec.lastSeen = now;
      }

      for (const [id, rec] of peers) {
        if (!seen.has(id) && now - rec.lastSeen > 1500) {
          app.world.remove(rec.entity);
          if (rec.plate) app.nameplates?.remove?.(rec.plate);
          peers.delete(id);
        }
      }
    },
    onStatus(status) {
      app.events.emit('net:status', status);
    },
    onChat(msg) {
      app.events.emit('net:chat', msg);
    },
    onHit(msg) {
      app.events.emit('net:hit', msg);
    },
    onWallet(msg) {
      app.events.emit('net:wallet', msg);
    },
    onLeave(id) {
      const rec = peers.get(id);
      if (rec) {
        app.world.remove(rec.entity);
        if (rec.plate) app.nameplates?.remove?.(rec.plate);
        peers.delete(id);
      }
    },
  });

  app.net = client;
  offs.push(
    app.events.once('app:ready', () => {
      client.startProvider = () => [app.player.pos.x, app.player.pos.z];
      client.connect();
    })
  );
  const chat = options.chat === false ? null : createChat(app, client);
  if (chat) app.netChat = chat;

  offs.push(app.events.on('frame', (dt) => {
    if (!app.player) return;
    const player = app.player;
    const input = app.input;

    // input intent → world direction (prediction keeps using Player.update)
    sendAcc += dt;
    if (sendAcc >= 0.05) {
      sendAcc = 0;
      const f = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
      const s = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      const mx = -sin * f + cos * s;
      const mz = -cos * f - sin * s;

      seq++;
      pending.push({ seq, x: player.pos.x, z: player.pos.z });
      if (pending.length > 60) pending.shift();
      client.sendInput({ seq, mx, mz, yaw: player.yaw });
    }

    for (const rec of peers.values()) {
      const pos = rec.entity.mesh.position;
      const before = pos.clone();
      pos.lerp(rec.target, 1 - Math.exp(-10 * dt));

      const diff = ((rec.targetYaw - rec.entity.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      rec.entity.mesh.rotation.y += diff * Math.min(1, dt * 10);

      const moved = before.distanceTo(pos);
      rec.speed += ((dt > 0 ? moved / dt : 0) - rec.speed) * Math.min(1, dt * 6);
      rec.character.update(dt, rec.speed, rec.targetYaw, false, false);
    }
  }));

  const closeSocket = client.dispose.bind(client);
  client.dispose = () => {
    while (offs.length) {
      try {
        offs.pop()();
      } catch {}
    }
    closeSocket();
    for (const rec of peers.values()) {
      app.world.remove(rec.entity);
      if (rec.plate) app.nameplates?.remove?.(rec.plate);
    }
    peers.clear();
    pending.length = 0;
    chat?.dispose();
    if (app.net === client) app.net = null;
    if (chat && app.netChat === chat) app.netChat = null;
  };

  return client;
}

/** Minimal chat UI: T opens, Enter sends, Esc closes. */
function createChat(app, client) {
  const el = document.createElement('div');
  el.className = 'net-chat off';
  el.innerHTML = `<div class="net-chat-log"></div><input class="net-chat-input" maxlength="120" placeholder="Type a message…" />`;
  app.hud.root.appendChild(el);

  const log = el.querySelector('.net-chat-log');
  const input = el.querySelector('.net-chat-input');
  let open = false;
  const offs = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    offs.push(() => t.removeEventListener(type, fn, o));
  };
  const runOffs = () => {
    while (offs.length) {
      try {
        offs.pop()();
      } catch {}
    }
  };
  let timer = null;

  const toggle = (v) => {
    open = v;
    el.classList.toggle('off', !v);
    if (v) timer = setTimeout(() => input.focus(), 0);
    else input.blur();
  };

  on(
    window,
    'keydown',
    (e) => {
      if (!open && e.code === 'KeyT' && app.state.is('playing')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggle(true);
        return;
      }
      if (!open) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggle(false);
        return;
      }
      // keep WASD from reaching the game while typing
      e.stopImmediatePropagation();
    },
    true
  );

  on(input, 'keydown', (e) => {
    if (e.code === 'Enter') {
      const text = input.value.trim();
      if (text) client.sendChat(text);
      input.value = '';
      toggle(false);
      e.stopImmediatePropagation();
    }
  });

  offs.push(app.events.on('net:chat', (msg) => {
    const line = document.createElement('div');
    line.className = 'net-chat-line';
    line.textContent = `${msg.name || '?'}: ${msg.text}`;
    log.appendChild(line);
    while (log.children.length > 8) log.firstChild.remove();
  }));

  return {
    toggle,
    get isOpen() {
      return open;
    },
    dispose() {
      runOffs();
      clearTimeout(timer);
      el.remove();
    },
  };
}
