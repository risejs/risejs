import * as THREE from 'three';

/**
 * Instancing with correct winding and anchor frames. The pure geometry logic lives here so it can be tested in Node.
 */

/** 3×3 determinant of a Matrix4 (three is column-major). */
export function determinant3(m) {
  const e = m.elements || m;
  const a = e[0], b = e[4], c = e[8];
  const d = e[1], f = e[5], g = e[9];
  const h = e[2], i = e[6], j = e[10];
  return a * (f * j - g * i) - b * (d * j - g * h) + c * (d * i - f * h);
}

/**
 * Classifies a transform for instancing batches.
 * - det < 0 → the winding is flipped; needs its own batch with flipped indices.
 * - mesh has tangents → batch by rotation/scale (three r186 WebGPU does not transform tangentLocal).
 */
export function classifyTransform(matrix, { tangent = false, eps = 1e-6, rotationKey = '' } = {}) {
  const det = determinant3(matrix);
  const mirrored = det < -eps;
  const degenerate = Math.abs(det) < eps;
  const key = tangent ? `t|${mirrored ? 'neg' : 'pos'}|${rotationKey}` : `n|${mirrored ? 'neg' : 'pos'}`;
  return { det, mirrored, degenerate, key };
}

/** Groups transforms by batch key, keeping first-seen order. */
export function groupInstances(items, { tangent = false, keyOf = null } = {}) {
  const groups = new Map();
  for (const item of items) {
    const cls = classifyTransform(item.matrix, { tangent, rotationKey: keyOf ? keyOf(item) : '' });
    if (cls.degenerate) continue;
    if (!groups.has(cls.key)) groups.set(cls.key, { key: cls.key, mirrored: cls.mirrored, items: [] });
    groups.get(cls.key).items.push(item);
  }
  return [...groups.values()];
}

/** Flips winding: [a,b,c] → [a,c,b]; triangle groups are kept. */
export function flipIndices(indices) {
  const out = new Array(indices.length);
  for (let i = 0; i + 2 < indices.length; i += 3) {
    out[i] = indices[i];
    out[i + 1] = indices[i + 2];
    out[i + 2] = indices[i + 1];
  }
  return out;
}

/**
 * Matrix that attaches a child to an anchor: world = parent * anchor * child.
 * Used for ports/anchors: the child is defined in the anchor's frame and does not need to know the parent.
 */
export function composeAnchor(parentMatrix, anchorMatrix, childMatrix = new THREE.Matrix4()) {
  return new THREE.Matrix4().multiplyMatrices(parentMatrix, anchorMatrix).multiply(childMatrix);
}

/**
 * Builds InstancedMesh objects per batch. Mirrored batches use geometry with flipped indices.
 * @returns {{meshes: THREE.InstancedMesh[], batches: {key:string, count:number, mirrored:boolean}[]}}
 */
export function buildInstanced(sourceMesh, items, { tangent = false, keyOf = null } = {}) {
  const batches = groupInstances(items, { tangent, keyOf });
  const meshes = [];
  const summary = [];

  for (const batch of batches) {
    const geometry = sourceMesh.geometry.clone();
    if (batch.mirrored) {
      if (!geometry.index) {
        // non-indexed geometry: swap vertices within each triangle
        const pos = geometry.attributes.position;
        for (let i = 0; i + 2 < pos.count; i += 3) {
          const ax = pos.getX(i + 1), ay = pos.getY(i + 1), az = pos.getZ(i + 1);
          pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
          pos.setXYZ(i + 2, ax, ay, az);
        }
        pos.needsUpdate = true;
        geometry.computeVertexNormals();
      } else {
        geometry.setIndex(flipIndices(Array.from(geometry.index.array)));
      }
    }

    const mesh = new THREE.InstancedMesh(geometry, sourceMesh.material, batch.items.length);
    mesh.castShadow = sourceMesh.castShadow;
    mesh.receiveShadow = sourceMesh.receiveShadow;
    batch.items.forEach((it, i) => mesh.setMatrixAt(i, it.matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
    summary.push({ key: batch.key, count: batch.items.length, mirrored: batch.mirrored });
  }

  return { meshes, batches: summary };
}
