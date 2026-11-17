/**
 * Server-layer anti-cheat test (run with `npm run server` in another terminal):
 *   node server/test-anticheat.mjs
 *
 * Scenarios:
 *  1. Fire 15 shots in a row → the server only accepts them at the rpm (no rapid fire)
 *  2. Shoot through a crate → 0 hits (LOS from the map)
 *  3. Wallet: grant once, spend twice with the same key → charged once (idempotent)
 *  4. Can a player grant to themselves when AUTH_REQUIRED=0? (dev: allowed; prod must return 403)
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
const ROOM = `ac-${Date.now()}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client(x, z, extra = '') {
  const url = `ws://127.0.0.1:8787/ws?room=${ROOM}&map=arena&x=${x}&z=${z}${extra}`;
  const ws = new WebSocket(url);
  const st = { ws, nid: null, id: null, hits: [], loot: [], wallet: null, ac: [], welcome: null };
  ws.addEventListener('message', (e) => {
    if (typeof e.data !== 'string') return;
    const m = JSON.parse(e.data);
    if (m.type === 'welcome') {
      st.id = m.id;
      st.nid = m.nid;
      st.welcome = m;
    } else if (m.type === 'hit') st.hits.push(m);
    else if (m.type === 'loot') st.loot.push(m);
    else if (m.type === 'wallet') st.wallet = m.wallet;
    else if (m.type === 'anticheat') st.ac.push(m.reason);
  });
  return new Promise((res) => ws.addEventListener('open', () => setTimeout(() => res(st), 250)));
}

const results = {};
const ok = (name, cond, detail) => {
  results[name] = { pass: !!cond, detail };
  if (!cond) process.exitCode = 1;
};

// 1) rapid fire: A at (0,0) shoots B at (0,-9), 15 shots within ~1 frame
{
  const a = await client(0, 0);
  const b = await client(0, -9);
  await wait(100);
  for (let i = 0; i < 15; i++) a.ws.send(JSON.stringify({ type: 'fire', weapon: 'rifle', seq: i + 1, clientTime: Date.now() }));
  await wait(400);
  const hits = b.hits.filter((h) => h.from === a.nid).length;
  ok('rapidFire ≤ 3 hit', hits <= 3, { hits });
  ok('damage server-side', b.hits.every((h) => h.damage === 22), b.hits[0] || null);
  a.ws.close();
  b.ws.close();
}

// 2) LOS: same aim direction, different positions
//    - control: A(0,20) → B(0,16), clear line ⇒ must hit
//    - obstructed: A(0,16) → B(0,12), crate at (0,14) ⇒ must miss
{
  const a = await client(0, 20);
  const b = await client(0, 16);
  await wait(100);
  for (let i = 0; i < 3; i++) {
    a.ws.send(JSON.stringify({ type: 'fire', weapon: 'rifle', seq: i + 1, clientTime: Date.now() }));
    await wait(120);
  }
  await wait(300);
  const control = b.hits.filter((h) => h.from === a.nid).length;
  ok('control: clear line hits', control >= 1, { control });
  a.ws.close();
  b.ws.close();
}
{
  const a = await client(0, 16);
  const b = await client(0, 12);
  await wait(100);
  for (let i = 0; i < 3; i++) {
    a.ws.send(JSON.stringify({ type: 'fire', weapon: 'rifle', seq: i + 1, clientTime: Date.now() }));
    await wait(120);
  }
  await wait(300);
  const hits = b.hits.filter((h) => h.from === a.nid).length;
  ok('LOS blocks shots through the crate', hits === 0, { hits });
  a.ws.close();
  b.ws.close();
}

// 3) loot: open the same crate twice → the second is a duplicate, the wallet does not grow
{
  const a = await client(0, 0);
  await wait(100);
  a.ws.send(JSON.stringify({ type: 'loot', crateId: 'crate-1' }));
  await wait(200);
  a.ws.send(JSON.stringify({ type: 'loot', crateId: 'crate-1' }));
  await wait(250);
  const first = a.loot[0];
  const second = a.loot[1];
  ok('first loot has drops', first?.ok === true && first.drops.length > 0, first?.drops);
  ok('second loot is a duplicate', second?.duplicate === true && second.drops.length === 0, second?.duplicate);
  const total = Object.values(second?.wallet?.items || {}).reduce((s, v) => s + v, 0);
  const firstTotal = Object.values(first?.wallet?.items || {}).reduce((s, v) => s + v, 0);
  ok('no item dupe', total === firstTotal, { firstTotal, total });
  a.ws.close();
}

// 4) D1 wallet: grant 100, spend 30 twice with the same key → charged once
{
  const game = 'actest';
  const player = `p-${Date.now()}`;
  const post = (body) =>
    fetch(`${BASE}/api/wallet/${game}/${player}/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

  const grant = await post({ key: 'g1', op: 'grant', amount: 100, reason: 'test' });
  const spend1 = await post({ key: 's1', op: 'spend', amount: 30 });
  const spend2 = await post({ key: 's1', op: 'spend', amount: 30 });
  const over = await post({ key: 's2', op: 'spend', amount: 1000 });

  ok('grant 100', grant.status === 200 && grant.body.gold === 100, grant.body);
  ok('spend 30', spend1.body.gold === 70, spend1.body);
  ok('repeated spend key → duplicate', spend2.body.duplicate === true && spend2.body.gold === 70, spend2.body);
  ok('spend above balance is blocked', over.body.ok === false && over.body.gold === 70, over.body);
}

console.log(JSON.stringify(results, null, 2));
const allPass = Object.values(results).every((r) => r.pass);
console.log(allPass ? 'PASS: anti-cheat server (rpm/LOS/loot/wallet)' : 'FAIL');
process.exit(allPass ? 0 : 1);
