import * as THREE from 'three';

/**
 * Surface wear: computes `_edge` from geometry and patches materials to read `_edge`/`_cavity`.
 * Cavity needs an offline bake; the runtime only reads it when present.
 */

/** Convex edge weight from the angle between normals around a welded vertex. */
export function edgeWeights(geometry, { thresholdDeg = 35, weld = 1e-4 } = {}) {
  const pos = geometry.attributes.position;
  if (!pos) return new Float32Array(0);

  const index = geometry.index ? Array.from(geometry.index.array) : null;
  const triCount = index ? index.length / 3 : pos.count / 3;
  const keyOf = (i) => {
    const x = Math.round(pos.getX(i) / weld);
    const y = Math.round(pos.getY(i) / weld);
    const z = Math.round(pos.getZ(i) / weld);
    return `${x},${y},${z}`;
  };

  const normalsByKey = new Map();
  const keyByVertex = new Array(pos.count);
  const edgeUse = new Map();

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index[t * 3] : t * 3;
    const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
    const i2 = index ? index[t * 3 + 2] : t * 3 + 2;

    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (n.lengthSq() < 1e-20) continue;
    n.normalize();

    for (const vi of [i0, i1, i2]) {
      const k = keyOf(vi);
      keyByVertex[vi] = k;
      if (!normalsByKey.has(k)) normalsByKey.set(k, []);
      normalsByKey.get(k).push(n.clone());
    }

    const k0 = keyByVertex[i0];
    const k1 = keyByVertex[i1];
    const k2 = keyByVertex[i2];
    for (const [ka, kb] of [
      [k0, k1],
      [k1, k2],
      [k2, k0],
    ]) {
      const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      edgeUse.set(ek, (edgeUse.get(ek) || 0) + 1);
    }
  }

  const boundaryKeys = new Set();
  for (const [ek, count] of edgeUse) {
    if (count !== 1) continue;
    const [ka, kb] = ek.split('|');
    boundaryKeys.add(ka);
    boundaryKeys.add(kb);
  }

  const threshold = Math.cos((thresholdDeg * Math.PI) / 180);
  const weightByKey = new Map();
  for (const [k, normals] of normalsByKey) {
    if (boundaryKeys.has(k) || normals.length <= 1) {
      weightByKey.set(k, 1);
      continue;
    }
    let minDot = 1;
    for (let i = 0; i < normals.length; i++) {
      for (let j = i + 1; j < normals.length; j++) minDot = Math.min(minDot, normals[i].dot(normals[j]));
    }
    const angle = Math.acos(Math.max(-1, Math.min(1, minDot)));
    const deg = (angle * 180) / Math.PI;
    // smoothstep between threshold/2 and threshold
    const t = Math.max(0, Math.min(1, (deg - thresholdDeg / 2) / (thresholdDeg / 2)));
    weightByKey.set(k, t * t * (3 - 2 * t));
  }

  const out = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) out[i] = weightByKey.get(keyByVertex[i]) ?? 0;
  void threshold;
  return out;
}

export const WEAR_VERTEX_HEADER = `
attribute float _edge;
attribute float _cavity;
varying float vEdge;
varying float vCavity;
`;

export const WEAR_VERTEX_BODY = `
vEdge = _edge;
vCavity = _cavity;
`;

export const WEAR_FRAGMENT_HEADER = `
varying float vEdge;
varying float vCavity;
`;

export const WEAR_FRAGMENT_BODY = `
diffuseColor.rgb *= mix(1.0, 0.62, vEdge * WEAR_STRENGTH);
diffuseColor.rgb *= mix(0.78, 1.0, clamp(vCavity, 0.0, 1.0));
`;

/** Patches a material to read `_edge`/`_cavity` (the attributes must exist on the geometry). */
export function applySurfaceWear(material, { strength = 1 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WEAR_VERTEX_HEADER}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WEAR_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WEAR_FRAGMENT_HEADER}`)
      .replace('#include <dithering_fragment>', `${WEAR_FRAGMENT_BODY.replace('WEAR_STRENGTH', Number(strength).toFixed(3))}\n#include <dithering_fragment>`);
  };
  material.customProgramCacheKey = () => `rise-wear-${strength}`;
  material.userData = { ...(material.userData || {}), riseWear: { strength } };
  material.needsUpdate = true;
  return material;
}

/** Attaches wear to a mesh or subtree: computes `_edge` when missing; `_cavity` defaults to 1. */
export function attachSurfaceWear(root, { strength = 1, thresholdDeg = 35 } = {}) {
  let count = 0;
  root?.traverse?.((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.getAttribute('_edge')) {
      const w = edgeWeights(o.geometry, { thresholdDeg });
      o.geometry.setAttribute('_edge', new THREE.BufferAttribute(w, 1));
    }
    if (!o.geometry.getAttribute('_cavity')) {
      const n = o.geometry.getAttribute('position').count;
      o.geometry.setAttribute('_cavity', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && 'onBeforeCompile' in m) applySurfaceWear(m, { strength });
    count++;
  });
  return count;
}
