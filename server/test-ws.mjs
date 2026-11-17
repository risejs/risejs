/**
 * Phase 2 test (binary snapshot): server authority + binary snapshots.
 *   node server/test-ws.mjs
 */
import { decodeSnapshot } from '../src/shared/snapshot.js';

const ROOM = `test-${Date.now()}`;
const URL = process.env.WS_URL || `ws://127.0.0.1:8787/ws?room=${ROOM}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name) {
  const ws = new WebSocket(URL);
  ws.binaryType = 'arraybuffer';
  const state = { name, ws, self: null, selfNid: null, snaps: [], chatted: [], left: [] };
  ws.addEventListener('message', (e) => {
    if (typeof e.data !== 'string') {
      const snap = decodeSnapshot(e.data);
      if (snap) state.snaps.push(snap);
      return;
    }
    const m = JSON.parse(e.data);
    if (m.type === 'welcome') {
      state.self = m.id;
      state.selfNid = m.nid;
    } else if (m.type === 'chat') state.chatted.push(m);
    else if (m.type === 'leave') state.left.push(m.id);
  });
  return new Promise((res) => ws.addEventListener('open', () => setTimeout(() => res(state), 200)));
}

function input(c, seq, mx, mz, yaw = 0) {
  c.ws.send(JSON.stringify({ type: 'input', seq, mx, mz, yaw, name: c.name }));
}

const a = await client('A');
const b = await client('B');

for (let i = 1; i <= 8; i++) {
  input(a, i, 1, 0, 0);
  await wait(60);
}
await wait(200);

const aSelf = a.snaps.at(-1)?.players.find((p) => p.nid === a.selfNid);
const bSeesA = b.snaps.at(-1)?.players.some((p) => p.nid === a.selfNid);
const aSeesB = a.snaps.at(-1)?.players.some((p) => p.nid === b.selfNid);

b.ws.send(JSON.stringify({ type: 'chat', text: 'hello' }));
await wait(150);

const bytes = a.snaps.length ? a.snaps[0].players.length * 11 + 7 : 0;

const result = {
  aSelf: aSelf ? { x: aSelf.x, z: aSelf.z, seq: aSelf.seq } : null,
  movedRight: aSelf ? aSelf.x > 0.8 : false,
  seqEcho: aSelf ? aSelf.seq === 8 : false,
  bSeesA,
  aSeesB,
  snapshots: a.snaps.length,
  bytesPerSnapshot: bytes,
  chatInZone: b.chatted.length,
};

b.ws.close();
await wait(250);
result.leaveReceived = a.left.includes(b.self);

console.log(JSON.stringify(result, null, 2));

const ok = result.movedRight && result.seqEcho && result.bSeesA && result.aSeesB && result.snapshots > 0;
console.log(ok ? 'PASS: authoritative + binary snapshot + interest' : 'FAIL');

a.ws.close();
process.exit(ok ? 0 : 1);
