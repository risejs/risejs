import * as THREE from 'three';
import { Character } from '../../player/character.js';
import { Entity } from '../../world.js';
import { Npc } from './patrol.js';
export { Npc };

const _dir = new THREE.Vector3();
const _wp = new THREE.Vector3();

/**
 * NPC plugin: installs `app.spawnNpc` (patrolling NPCs). The core does not own this gameplay behavior.
 *
 *   app.use(npcPlugin);
 *   app.spawnNpc({ path: [[0,0,0],[10,0,0]], speed: 1.4 });
 */
export function npcPlugin(app) {
  const spawn = (opts) => app.world.add(new Npc(opts));
  app.spawnNpc = spawn;
  return () => {
    if (app.spawnNpc === spawn) app.spawnNpc = null;
  };
}

/**
 * NPC AI: patrol → detect → chase → return.
 *
 *   const guard = new NpcAgent({ path: [[0,0,0],[10,0,0]], sight: 14 });
 *   app.world.add(guard);
 *
 * Needs ctx.player every frame (world.update passes it in).
 */
export class NpcAgent extends Entity {
  constructor({
    path = [[0, 0, 0]],
    speed = 1.6,
    chaseSpeed = 3.4,
    sight = 14,
    lose = 20,
    color = 0x5c4630,
    name = 'npc',
    nav = null,
  } = {}) {
    const character = new Character({ color });
    super({ mesh: character.group, tags: ['npc'], autoCollider: false, data: { name } });

    this.character = character;
    this.path = path.map((p) => new THREE.Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0));
    this.home = this.path[0].clone();
    this.index = this.path.length > 1 ? 1 : 0;

    this.speed = speed;
    this.chaseSpeed = chaseSpeed;
    this.sight = sight;
    this.lose = lose;

    this.state = 'patrol';
    this.target = null;
    this.heading = 0;
    this.wait = 0;
    this.nav = nav;
    this.waypoints = [];
    this.repath = 0;

    this.mesh.position.copy(this.home);
  }

  /** Walks to a point; follows an A* path when a navmesh is available. */
  goTo(point) {
    if (!this.nav) {
      this.waypoints = [{ x: point.x, z: point.z }];
      return this.waypoints;
    }
    this.waypoints = this.nav.findPath(this.mesh.position, point);
    return this.waypoints;
  }

  _follow(dt, speed) {
    const wp = this.waypoints[0];
    if (!wp) return 0;
    _wp.set(wp.x, this.mesh.position.y, wp.z);
    const d = this._moveToward(_wp, speed, dt);
    if (d < 0.35) this.waypoints.shift();
    return speed;
  }

  _moveToward(point, speed, dt) {
    _dir.subVectors(point, this.mesh.position);
    _dir.y = 0;
    const distSq = _dir.lengthSq();
    if (distSq < 0.04) return Math.sqrt(distSq);
    const dist = Math.sqrt(distSq);
    _dir.multiplyScalar(1 / dist);
    this.mesh.position.addScaledVector(_dir, Math.min(speed * dt, dist));
    this.heading = Math.atan2(_dir.x, _dir.z);
    return dist;
  }

  update(dt, ctx) {
    const player = ctx?.player;
    const dPlayer = player ? this.mesh.position.distanceTo(player.pos) : Infinity;

    if (this.state === 'patrol' && dPlayer < this.sight) {
      this.state = 'chase';
    } else if (this.state === 'chase' && dPlayer > this.lose) {
      this.state = 'return';
    }

    let moved = 0;

    if (this.state === 'chase' && player) {
      if (this.nav) {
        this.repath -= dt;
        if (this.repath <= 0) {
          this.goTo(player.pos);
          this.repath = 0.4;
        }
        moved = this._follow(dt, this.chaseSpeed);
      } else {
        moved = this._moveToward(player.pos, this.chaseSpeed, dt);
      }
    } else if (this.state === 'return') {
      if (this.nav) {
        this.repath -= dt;
        if (this.repath <= 0 && !this.waypoints.length) {
          this.goTo(this.home);
          this.repath = 0.5;
        }
        moved = this._follow(dt, this.speed);
        if (!this.waypoints.length && this.mesh.position.distanceTo(this.home) < 0.8) this.state = 'patrol';
      } else {
        const d = this._moveToward(this.home, this.speed, dt);
        if (d < 0.6) this.state = 'patrol';
        moved = d > 0.2 ? this.speed : 0;
      }
    } else {
      const target = this.path[this.index] || this.home;
      if (this.wait > 0) this.wait -= dt;
      else {
        const d = this._moveToward(target, this.speed, dt);
        moved = d > 0.2 ? this.speed : 0;
        if (d < 0.25) {
          this.index = (this.index + 1) % this.path.length;
          this.wait = 0.8;
        }
      }
    }

    this.character.update(dt, moved, this.heading, false, false);
  }
}
