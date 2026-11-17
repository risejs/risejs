import * as THREE from 'three';
import './nameplate.css';
import { projectToScreen } from './projection.js';
export { projectToScreen };

/**
 * Nameplate pack: a name and speech bubble above a character (DOM overlay).
 *
 *   app.use(nameplatePlugin);
 *   const plate = app.nameplates.add(entity, { name: 'Mara' });
 *   app.nameplates.say(plate, 'Hello', 3);
 */
export function nameplatePlugin(app, { maxDist = 70 } = {}) {
  const root = document.createElement('div');
  root.className = 'nameplates';
  app.hud.root.appendChild(root);

  const items = new Map();
  const v = new THREE.Vector3();
  const screen = {};

  function create(entity, { name = 'npc', offsetY = 2.1 } = {}) {
    const el = document.createElement('div');
    el.className = 'np';
    el.innerHTML = `<div class="np-name"></div><div class="np-bubble off"></div>`;
    el.querySelector('.np-name').textContent = name;
    root.appendChild(el);

    const item = { entity, name, el, nameEl: el.querySelector('.np-name'), bubble: el.querySelector('.np-bubble'), offsetY, t: 0, hay: 0 };
    items.set(entity, item);
    return item;
  }

  function say(item, text, seconds = 3) {
    if (!item) return;
    item.bubble.textContent = text;
    item.bubble.classList.remove('off');
    item.t = seconds;
  }

  function remove(item) {
    items.delete(item.entity);
    item.el.remove();
  }

  const off = app.events.on('frame', (dt) => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const item of items.values()) {
      const e = item.entity;
      if (!e?.mesh || !e.alive) {
        remove(item);
        continue;
      }

      const cam = app.camera;
      const pos = e.mesh.position;
      v.set(pos.x, pos.y + item.offsetY, pos.z);
      projectToScreen(cam, v, w, h, screen);

      const dist = cam.position.distanceTo(v);
      const show = screen.visible && dist < maxDist;
      item.el.style.display = show ? 'block' : 'none';
      if (!show) continue;

      item.el.style.transform = `translate(-50%, -100%) translate(${screen.x}px, ${screen.y}px)`;
      item.el.style.opacity = String(Math.max(0.25, Math.min(1, 1 - dist / maxDist)));

      if (item.t > 0) {
        item.t -= dt;
        item.hay += dt;
        item.bubble.style.transform = `translateX(-50%) translateY(${Math.sin(item.hay * 12) * 2}px)`;
        if (item.t <= 0) item.bubble.classList.add('off');
      }
    }
  });

  const api = {
    add: create,
    remove,
    say,
    sayById(id, text, seconds) {
      for (const item of items.values()) {
        if (item.entity.data?.nid === id || item.entity.id === id) say(item, text, seconds);
      }
    },
    items,
    dispose() {
      off();
      items.clear();
      root.remove();
      if (app.nameplates === api) app.nameplates = null;
    },
  };

  app.nameplates = api;
  return api;
}
