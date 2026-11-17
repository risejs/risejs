import * as THREE from 'three';
import { Entity } from '../../world.js';
import { budgetCheck, collidersOf, anchorsOf, lodIndexFor, shapeBounds, validateManifest } from './manifest.js';
import { glbInfo, needsKtx2, needsMeshopt, isQuantized, ktx2Plan } from './loader-info.js';
export { budgetCheck, collidersOf, anchorsOf, lodIndexFor, shapeBounds, validateManifest, roleMatches, hasRole, findByRole } from './manifest.js';
export { glbInfo, needsKtx2, needsMeshopt, isQuantized, ktx2Plan } from './loader-info.js';

/**
 * glTF pack: loads external models, bakes colliders and registers prefabs.
 *
 *   await preloadGltf('/models/crate.glb');
 *   app.use(prefabsPlugin);
 *   await registerGltfPrefab(app.prefabs, 'crate', '/models/crate.glb', { scale: 1 });
 */
const cache = new Map();

export async function loadGltf(url, { loader = null, ktx2 = null } = {}) {
  if (cache.has(url)) return cache.get(url);

  const promise = (async () => {
    if (loader) return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`[gltf] ${res.status} ${url}`);
    const buffer = await res.arrayBuffer();
    const info = glbInfo(buffer);

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gl = new GLTFLoader();

    if (needsMeshopt(info)) {
      const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
      gl.setMeshoptDecoder(MeshoptDecoder);
    }

    const plan = ktx2Plan(info, ktx2 || {});
    if (plan.needed) {
      if (!plan.ok) throw new Error(`[gltf] asset needs KTX2: ${plan.reason}`);
      const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
      const k = new KTX2Loader().setTranscoderPath(plan.transcoderPath).detectSupport(ktx2.renderer);
      gl.setKTX2Loader(k);
    }

    if (isQuantized(info)) {
      // three keeps the node scale to dequantise; do not copy raw geometry into a new mesh
      console.info('[gltf] quantized asset (KHR_mesh_quantization): keep the node transforms as they are');
    }

    const base = new URL(url, globalThis.location?.href || 'http://localhost/');
    base.pathname = base.pathname.replace(/[^/]*$/, '');

    return new Promise((resolve, reject) => gl.parse(buffer, base.href, resolve, reject));
  })();

  cache.set(url, promise);
  promise.catch(() => cache.delete(url));
  return promise;
}

export function preloadGltf(url, opts) {
  return loadGltf(url, opts);
}

/** A Box3 per mesh, for baking colliders or debugging. */
export function collidersFromGltf(root, { scale = 1 } = {}) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) return;
    if (scale !== 1) {
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3()).multiplyScalar(scale);
      box.setFromCenterAndSize(c, s);
    }
    out.push(box);
  });
  return out;
}

/** Merges several Box3 into one bounding box, a simple collider for a prefab. */
export function mergeBoxes(boxes) {
  const out = new THREE.Box3();
  for (const b of boxes) out.union(b);
  return out;
}

/**
 * Attaches an AnimationMixer to a glTF that has animations.
 * Returns { mixer, actions, play, update }, or null when there are no clips.
 */
export function attachAnimations(gltf, root, { clips = null, loop = true } = {}) {
  const list = clips || gltf?.animations || [];
  if (!list.length || !root) return null;

  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();

  for (const clip of list) {
    const action = mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    actions.set(clip.name || `clip${actions.size}`, action);
  }

  let current = null;
  const play = (name) => {
    const next = actions.get(name) || actions.values().next().value;
    if (!next || next === current) return next || null;
    current?.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
    current = next;
    return next;
  };

  return {
    mixer,
    actions,
    play,
    update: (dt) => mixer.update(dt),
    get names() {
      return [...actions.keys()];
    },
  };
}

/**
 * Creates a synchronous builder for PrefabRegistry from a loaded glTF.
 * The collider is the bounding box of the whole model (enough for prototypes).
 */
export function prefabFromGltf(gltf, { scale = 1, tags = [], name = 'gltf' } = {}) {
  const build = (entity, app) => {
    const mesh = gltf.scene.clone(true);
    mesh.scale.setScalar(scale);
    mesh.position.fromArray(entity.pos ?? [0, 0, 0]);
    mesh.rotation.y = entity.rotY ?? 0;
    mesh.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    const e = new Entity({ mesh, tags, autoCollider: true, data: { name } });
    if (entity.tags) entity.tags.forEach((t) => e.tags.add(t));

    const anim = entity.clips ? attachAnimations({ animations: entity.clips }, mesh) : attachAnimations(gltf, mesh);
    if (anim) {
      e.animation = anim;
      e.update = (dt) => anim.update(dt);
    }
    return e;
  };
  return build;
}

export async function registerGltfPrefab(registry, id, url, opts = {}) {
  const gltf = await loadGltf(url, opts);
  registry.register(id, prefabFromGltf(gltf, { ...opts, name: id }));
  return gltf;
}

/**
 * Loads a glTF and its `rise.asset.json` manifest, if present. It still works without a manifest,
 * but colliders, anchors, ports and LOD will be empty and the caller falls back to Box3.
 */
export async function loadAsset(url, { manifestUrl = null, loader = null, ktx2 = null } = {}) {
  const gltf = await loadGltf(url, { loader, ktx2 });
  let manifest = null;
  let warnings = [];

  const sidecar = manifestUrl || url.replace(/\.(glb|gltf)(\?.*)?$/i, '.rise.asset.json');
  try {
    const res = await fetch(sidecar);
    if (res.ok) {
      const raw = await res.json();
      const check = validateManifest(raw);
      if (check.ok) manifest = raw;
      else warnings.push(check);
    }
  } catch {
    // a missing sidecar file is normal
  }

  return {
    gltf,
    manifest,
    warnings,
    colliders: manifest ? collidersOf(manifest) : [],
    anchors: manifest ? anchorsOf(manifest) : [],
    lod: manifest?.lod || null,
    budget: manifest ? budgetCheck(manifest.budget, {}) : null,
  };
}

/** Applies manifest colliders to an entity (falls back to Box3 when there are none). */
export function applyManifestColliders(entity, manifest) {
  if (!manifest) {
    entity.collider = new THREE.Box3().setFromObject(entity.mesh);
    return [entity.collider];
  }
  const boxes = [];
  for (const c of collidersOf(manifest)) {
    const b = shapeBounds(c.shape, c.transform);
    if (!b) continue;
    boxes.push(new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)));
  }
  entity.collider = boxes[0] || new THREE.Box3().setFromObject(entity.mesh);
  return boxes;
}
