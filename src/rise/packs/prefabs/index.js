import { box } from '../../prefabs.js';
export { buildInstanced, classifyTransform, composeAnchor, determinant3, flipIndices, groupInstances } from './instances.js';
export { LodGroup, lodGroupFromManifest } from './lod-group.js';

/**
 * Prefab registry: maps an id to a builder, used by the level format.
 *
 *   app.use(prefabsPlugin);
 *   app.prefabs.register('crate', (e) => box({ size: e.size, position: e.pos, color: 0x8a5a2b }));
 *   applyLevel(app, level, { buildEntity: (e, a) => a.add(a.prefabs.build(e)) });
 */
export class PrefabRegistry {
  constructor() {
    this.map = new Map();
  }

  register(id, build) {
    this.map.set(id, build);
    return this;
  }

  has(id) {
    return this.map.has(id);
  }

  build(entity, app) {
    const fn = this.map.get(entity.prefab);
    if (!fn) {
      console.warn('[prefabs] not registered:', entity.prefab);
      return null;
    }
    return fn(entity, app);
  }
}

export function prefabsPlugin(app) {
  const registry = new PrefabRegistry();
  app.prefabs = registry;

  // default: box
  registry.register('box', (e) =>
    box({
      size: e.size ?? [1, 1, 1],
      position: e.pos ?? [0, 0, 0],
      rotationY: e.rotY ?? 0,
      color: e.color ?? 0x8a5a2b,
      tags: e.tags ?? [],
    })
  );

  registry.dispose = () => {
    registry.map.clear();
    if (app.prefabs === registry) app.prefabs = null;
  };
  return registry;
}
