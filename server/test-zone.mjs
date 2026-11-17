/**
 * Phase 4 test: two adjacent zones see each other through the relay (binary snapshots).
 *   node server/test-zone.mjs
 */
import { decodeSnapshot } from '../src/shared/snapshot.js';

const ROOM = `zone-${Date.now()}`;
const base = 'ws://127.0.0.1:8787/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(zx, zz, x, z, name) {
  const url = `${base}?room=${ROOM}&zx=${zx}&zz=${zz}&x=${x}&z=${z}`;
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  const st = { name, ws, self: null, selfNid: null, snaps: [], zone: [zx, zz] };
  ws.addEventListener('message', (e) => {
    if (typeof e.data !== 'string') {
      const snap = decodeSnapshot(e.data);
      if (snap) st.snaps.push(snap);
      return;
    }
    const m = JSON.parse(e.data);
    if (m.type === 'welcome') {
      st.self = m.id;
      st.selfNid = m.nid;
    }
  });
  return new Promise((r) => ws.addEventListener('open', () => setTimeout(() => r(st), 200)));
}

const a = await connect(0, 0, 0, 0, 'A');
const b = await connect(1, 0, 70, 0, 'B');

for (let i = 1; i <= 10; i++) {
  const msg = (seq) => JSON.stringify({ type: 'input', seq, mx: 0, mz: 0, yaw: 0, name: 'x' });
  a.ws.send(msg(i));
  b.ws.send(msg(i));
  await wait(60);
}

await wait(300);

const aLast = a.snaps.at(-1);
const bLast = b.snaps.at(-1);
const aSeesB = aLast?.players.some((p) => p.nid === b.selfNid);
const bSeesA = bLast?.players.some((p) => p.nid === a.selfNid);

const out = {
  aZone: a.zone,
  bZone: b.zone,
  aPlayers: aLast?.players.length ?? 0,
  bPlayers: bLast?.players.length ?? 0,
  aSeesB: !!aSeesB,
  bSeesA: !!bSeesA,
};

console.log(JSON.stringify(out, null, 2));
const ok = out.aSeesB && out.bSeesA;
console.log(ok ? 'PASS: zone shard + binary relay' : 'FAIL');

a.ws.close();
b.ws.close();
process.exit(ok ? 0 : 1);
