import * as THREE from 'three';
import { SurfaceMap } from './world/surface.js';

/** An object in the world: mesh + collider + tags + its own data. */
export class Entity {
  /**
   * @param {object} o
   * @param {THREE.Object3D} o.mesh
   * @param {string[]} [o.tags]
   * @param {boolean} [o.autoCollider]  compute the Box3 when added to the world
   * @param {THREE.Box3|null} [o.collider]
   * @param {object} [o.data]  arbitrary gameplay data
   */
  constructor({ mesh, tags = [], autoCollider = true, collider = null, data = {} }) {
    this.mesh = mesh;
    this.tags = new Set(tags);
    this.autoCollider = autoCollider;
    this.collider = collider;
    this.data = data;
    this.alive = true;
  }

  update(_dt, _ctx) {}

  has(tag) {
    return this.tags.has(tag);
  }

  dispose() {
    this.alive = false;
    this.mesh.parent?.remove(this.mesh);
  }
}

/**
 * World: scene root + entity list + colliders shared by the player and NPCs.
 * Holds no game content; the game adds entities or calls setStatic().
 */
export class World {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'world';
    this.staticRoot = null;
    this.entities = [];
    this.colliders = [];
    this.surface = new SurfaceMap();
    this.heightfield = null;
  }

  /** Attaches a static world the game has already built (with colliders + surface). */
  setStatic(root, colliders = [], surface = null) {
    if (this.staticRoot) this.root.remove(this.staticRoot);
    this.staticRoot = root;
    this.root.add(root);
    if (colliders?.length) this.colliders.push(...colliders);
    if (surface) this.surface = surface;
    this.root.updateMatrixWorld(true);
    return this;
  }

  add(entity) {
    if (!entity || !entity.mesh) throw new Error('[rise] an entity must have a mesh');
    this.root.add(entity.mesh);
    if (entity.autoCollider && !entity.collider) {
      this.root.updateMatrixWorld(true);
      entity.collider = new THREE.Box3().setFromObject(entity.mesh);
    }
    if (entity.collider) this.colliders.push(entity.collider);
    this.entities.push(entity);
    return entity;
  }

  remove(entity) {
    const i = this.entities.indexOf(entity);
    if (i >= 0) this.entities.splice(i, 1);
    if (entity.collider) {
      const c = this.colliders.indexOf(entity.collider);
      if (c >= 0) this.colliders.splice(c, 1);
    }
    entity.dispose();
  }

  /** Filters entities by tag. */
  query(tag) {
    return this.entities.filter((e) => e.alive && (!tag || e.tags.has(tag)));
  }

  update(dt, ctx) {
    this.updateStatic?.(dt, ctx);
    for (const e of this.entities) if (e.alive) e.update(dt, ctx);
  }

  surfaceAt(x, z) {
    return this.surface.at(x, z);
  }
}
