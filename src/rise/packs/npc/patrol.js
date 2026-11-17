import * as THREE from 'three';
import { Character } from '../../player/character.js';
import { Entity } from '../../world.js';

const _dir = new THREE.Vector3();

/**
 * An NPC that patrols a list of points and pauses at each one.
 *
 *   app.spawnNpc({ path: [[0,0,-20], [20,0,-20]], speed: 1.4, color: 0x2f4b6b });
 */
export class Npc extends Entity {
  constructor({ path = [], speed = 1.4, pause = 1.2, color, name = 'npc' }) {
    const character = new Character({ color });
    const mesh = character.group;

    super({ mesh, tags: ['npc'], autoCollider: false, data: { name, speed, path } });

    this.character = character;
    this.path = path.map((p) => new THREE.Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0));
    this.index = this.path.length > 1 ? 1 : 0;
    this.speed = speed;
    this.pause = pause;
    this.waiting = 0;
    this.heading = 0;

    if (this.path.length) mesh.position.copy(this.path[0]);
  }

  update(dt) {
    if (!this.path.length) return;

    const target = this.path[this.index];
    const pos = this.mesh.position;

    if (this.waiting > 0) {
      this.waiting -= dt;
    } else {
      const dir = _dir.subVectors(target, pos);
      dir.y = 0;
      const distSq = dir.lengthSq();
      const dist = Math.sqrt(distSq);

      if (dist < 0.25) {
        this.index = (this.index + 1) % this.path.length;
        this.waiting = this.pause;
      } else {
        dir.normalize();
        pos.addScaledVector(dir, Math.min(this.speed * dt, dist));
        this.heading = Math.atan2(dir.x, dir.z);
      }
    }

    this.character.update(dt, this.waiting > 0 ? 0 : this.speed, this.heading, false, false);
  }
}
