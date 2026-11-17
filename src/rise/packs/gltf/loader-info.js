import * as THREE from 'three';

/** Reads a GLB/glTF header and reports the extensions the loader needs. Pure, testable in Node. */
export function glbInfo(buffer) {
  if (!buffer || buffer.byteLength < 12) return null;
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

  if (magic !== 'glTF') {
    try {
      const json = JSON.parse(new TextDecoder().decode(bytes));
      return summarize(json);
    } catch {
      return null;
    }
  }

  const view = new DataView(buffer);
  let offset = 12;
  let json = null;
  while (offset + 8 <= buffer.byteLength) {
    const len = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + len > buffer.byteLength) break;
    if (type === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + len)));
      break;
    }
    offset = start + len;
  }
  return json ? summarize(json) : null;
}

function summarize(json) {
  return {
    version: json.asset?.version || null,
    generator: json.asset?.generator || null,
    extensionsUsed: json.extensionsUsed || [],
    extensionsRequired: json.extensionsRequired || [],
    meshes: json.meshes?.length || 0,
    animations: json.animations?.length || 0,
    materials: json.materials?.length || 0,
  };
}

export function needsMeshopt(info) {
  const list = [...(info?.extensionsUsed || []), ...(info?.extensionsRequired || [])];
  return list.includes('EXT_meshopt_compression');
}

export function needsKtx2(info) {
  const list = [...(info?.extensionsUsed || []), ...(info?.extensionsRequired || [])];
  return list.includes('KHR_texture_basisu');
}

/** Quantization: three handles it; consumers only need a warning not to copy raw geometry. */
export function isQuantized(info) {
  const list = [...(info?.extensionsUsed || []), ...(info?.extensionsRequired || [])];
  return list.includes('KHR_mesh_quantization');
}

/** KTX2 needs a transcoder and a renderer for detectSupport. Returns a plan instead of guessing. */
export function ktx2Plan(info, { transcoderPath = null, renderer = null } = {}) {
  const needed = needsKtx2(info);
  if (!needed) return { needed: false, ok: true };
  if (!transcoderPath) return { needed: true, ok: false, reason: 'missing transcoderPath (for example /basis/)' };
  if (!renderer) return { needed: true, ok: false, reason: 'missing renderer for detectSupport' };
  return { needed: true, ok: true, transcoderPath };
}
