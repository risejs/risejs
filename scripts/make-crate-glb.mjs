/**
 * Generates public/models/crate.glb: a 1 m box with normals and colours, no external asset needed.
 * Run: node scripts/make-crate-glb.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const pos = [];
const nrm = [];
const idx = [];

// 6 faces × 4 vertices
const faces = [
  { n: [0, 0, 1], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, 0, -1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
  { n: [1, 0, 0], v: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
  { n: [-1, 0, 0], v: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
  { n: [0, 1, 0], v: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
  { n: [0, -1, 0], v: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
];

for (const f of faces) {
  const base = pos.length / 3;
  for (const p of f.v) {
    pos.push(...p);
    nrm.push(...f.n);
  }
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const posBuf = Buffer.from(new Float32Array(pos).buffer);
const nrmBuf = Buffer.from(new Float32Array(nrm).buffer);
const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
const pad = (buf) => (buf.length % 4 === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]));

const bin = Buffer.concat([pad(posBuf), pad(nrmBuf), pad(idxBuf)]);
const json = {
  asset: { version: '2.0', generator: 'rise-framework make-crate-glb' },
  scenes: [{ nodes: [0] }],
  scene: 0,
  nodes: [{ mesh: 0, name: 'crate' }],
  meshes: [{ name: 'crate', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ name: 'crate', pbrMetallicRoughness: { baseColorFactor: [0.62, 0.45, 0.24, 1], metallicFactor: 0.05, roughnessFactor: 0.85 } }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: nrm.length / 3, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: idx.length, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
    { buffer: 0, byteOffset: pad(posBuf).length, byteLength: nrmBuf.length, target: 34962 },
    { buffer: 0, byteOffset: pad(posBuf).length + pad(nrmBuf).length, byteLength: idxBuf.length, target: 34963 },
  ],
  buffers: [{ byteLength: bin.length }],
};

const jsonRaw = Buffer.from(JSON.stringify(json), 'utf8');
const jsonBuf =
  jsonRaw.length % 4 === 0 ? jsonRaw : Buffer.concat([jsonRaw, Buffer.alloc(4 - (jsonRaw.length % 4), 0x20)]);
const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonBuf.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);

const glb = Buffer.concat([header, jsonHeader, jsonBuf, binHeader, bin]);
const out = resolve('public/models/crate.glb');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, glb);
console.log(`crate.glb: ${glb.length} bytes, ${idx.length / 3} triangles`);
