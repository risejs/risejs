import * as THREE from 'three';

/**
 * Trigger zones: emit enter/exit once when the player's box goes in or out.
 *
 *   const t = new Triggers(events);
 *   t.add({ id:'checkpoint', box, onEnter: () => ... });
 *   t.update(playerBox);
 */
export class Triggers {
  constructor(events = null) {
    this.events = events;
    this.list = [];
    this.box = new THREE.Box3();
  }

  add({ id, box, onEnter = null, onExit = null, once = false }) {
    this.list.push({ id, box, onEnter, onExit, once, inside: false, fired: false });
    return this;
  }

  update(playerBox) {
    for (const t of this.list) {
      if (this._dead(t) && t.inside === false) continue;
      const inside = t.box.intersectsBox(playerBox);
      if (inside && !t.inside) {
        if (!(t.once && t.fired)) {
          t.onEnter?.(t);
          this.events?.emit('trigger:enter', { id: t.id });
          t.fired = true;
        }
        t.inside = true;
      } else if (!inside && t.inside) {
        t.onExit?.(t);
        this.events?.emit('trigger:exit', { id: t.id });
        t.inside = false;
      }
    }
  }

  _dead(t) {
    return t.once && t.fired && !t.inside;
  }
}
