/**
 * Binary snapshot shared by client and server.
 *
 * Header: [type u8=1][self u16][tick u16][count u16] = 7 bytes
 * Entity: [nid u16][x i16][y i16][z i16][yaw u8][seq u16] = 11 bytes
 * → 11 bytes per player, coordinates in 1 cm steps, ±327 m.
 */
export const SNAPSHOT = 1;
const HEADER = 7;
const ENTITY = 11;

const clampI16 = (v) => Math.max(-32768, Math.min(32767, Math.round(v)));

export function encodeSnapshot({ self = 0, tick = 0, players = [] }) {
  const buf = new ArrayBuffer(HEADER + players.length * ENTITY);
  const view = new DataView(buf);
  let o = 0;

  view.setUint8(o, SNAPSHOT);
  o += 1;
  view.setUint16(o, self, true);
  o += 2;
  view.setUint16(o, tick, true);
  o += 2;
  view.setUint16(o, players.length, true);
  o += 2;

  for (const p of players) {
    view.setUint16(o, p.nid ?? 0, true);
    o += 2;
    view.setInt16(o, clampI16(p.x * 100), true);
    o += 2;
    view.setInt16(o, clampI16((p.y ?? 0) * 100), true);
    o += 2;
    view.setInt16(o, clampI16(p.z * 100), true);
    o += 2;
    view.setUint8(o, Math.round((((p.yaw ?? 0) % (Math.PI * 2)) / (Math.PI * 2)) * 255) & 255);
    o += 1;
    view.setUint16(o, p.seq ?? 0, true);
    o += 2;
  }

  return buf;
}

export function decodeSnapshot(buffer) {
  const view = buffer instanceof DataView ? buffer : new DataView(buffer);
  if (view.getUint8(0) !== SNAPSHOT) return null;

  let o = 1;
  const self = view.getUint16(o, true);
  o += 2;
  const tick = view.getUint16(o, true);
  o += 2;
  const count = view.getUint16(o, true);
  o += 2;

  const players = [];
  for (let i = 0; i < count; i++) {
    if (o + ENTITY > view.byteLength) break;
    players.push({
      nid: view.getUint16(o, true),
      x: view.getInt16(o + 2, true) / 100,
      y: view.getInt16(o + 4, true) / 100,
      z: view.getInt16(o + 6, true) / 100,
      yaw: (view.getUint8(o + 8) / 255) * Math.PI * 2,
      seq: view.getUint16(o + 9, true),
    });
    o += ENTITY;
  }

  return { self, tick, players };
}
