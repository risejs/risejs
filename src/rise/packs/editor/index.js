import * as THREE from 'three';
import { box } from '../../prefabs.js';

/**
 * Editor pack: place and delete objects on a grid, with JSON save and load.
 *
 *   app.use(editorPlugin, { cell: 1, storageKey: 'rise.editor.demo' });
 *
 * Keys: E place · Q delete · R rotate 90° · T change size · Ctrl+S save · Ctrl+O load
 */
export function editorPlugin(app, { cell = 1, storageKey } = {}) {
  const key = storageKey || `rise.editor.${app.id}`;

  let size = 2;
  let rotation = 0;
  let ghost = null;
  const offs = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    offs.push(() => t.removeEventListener(type, fn, o));
  };
  const runOffs = () => {
    while (offs.length) {
      try {
        offs.pop()();
      } catch {}
    }
  };

  offs.push(app.events.once('app:ready', () => init()));

  function init() {
    ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35, depthWrite: false })
    );
    ghost.visible = false;
    app.scene.add(ghost);

    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2(0, 0);
    const hitPoint = new THREE.Vector3();

    const editorMeshes = () => app.world.query('editor').map((e) => e.mesh);

    offs.push(app.events.on('frame', () => {
      if (!app.state.is('playing')) return;

      ray.setFromCamera(pointer, app.camera);
      const hits = ray.intersectObjects(editorMeshes(), false);

      let placed = false;
      if (hits.length) {
        hitPoint.copy(hits[0].point);
        placed = true;
      } else if (ray.ray.intersectPlane(ground, hitPoint)) {
        placed = true;
      }

      if (placed) {
        const x = Math.round(hitPoint.x / cell) * cell;
        const z = Math.round(hitPoint.z / cell) * cell;
        ghost.position.set(x, size / 2, z);
        ghost.scale.set(size, size, size);
        ghost.rotation.y = rotation;
        ghost.visible = true;
        ghost.userData.at = { x, z };
      } else {
        ghost.visible = false;
      }

      const pressed = app.input.pressedCodes;

      if (app.input.justPressed('interact') && ghost.visible) {
        const { x, z } = ghost.userData.at;
        addBox(x, z, size, rotation);
        app.audio.play('ui');
      }

      if (pressed.has('KeyQ') && hits.length) {
        const entity = app.world.query('editor').find((e) => e.mesh === hits[0].object);
        if (entity) {
          app.world.remove(entity);
          app.player.rebuildColliders();
          app.audio.play('error');
        }
      }

      if (pressed.has('KeyR')) {
        rotation = (rotation + Math.PI / 2) % (Math.PI * 2);
        pressed.delete('KeyR');
      }

      if (pressed.has('KeyT')) {
        size = size >= 4 ? 1 : size + 1;
        pressed.delete('KeyT');
      }
    }));

    on(window, 'keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.code === 'KeyS') {
        e.preventDefault();
        save();
      } else if (e.code === 'KeyO') {
        e.preventDefault();
        load();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        exportFile();
      } else if (e.code === 'KeyI') {
        e.preventDefault();
        importFile();
      }
    });

    app.hud.setHint('E PLACE · Q DELETE · R ROTATE · T SIZE · CTRL+S SAVE · CTRL+O LOAD · CTRL+E EXPORT · CTRL+I IMPORT');
    app.events.emit('editor:ready', api);
  }

  function addBox(x, z, s, rot) {
    const entity = box({
      size: [s, s, s],
      position: [x, s / 2, z],
      rotationY: rot,
      color: 0x8a5a2b,
      tags: ['editor'],
    });
    app.add(entity);
    app.player?.rebuildColliders();
    return entity;
  }

  function save() {
    const payload = serialize();
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      app.hud.setHint(`Saved ${payload.length} objects · Ctrl+O load · Ctrl+E export file`);
    } catch (err) {
      console.warn('[editor] save failed', err);
    }
    return payload;
  }

  function serialize() {
    return app.world.query('editor').map((e) => ({
      p: [e.mesh.position.x, e.mesh.position.y, e.mesh.position.z].map((v) => +v.toFixed(2)),
      s: +e.mesh.geometry.parameters.width.toFixed(2),
      r: +e.mesh.rotation.y.toFixed(3),
    }));
  }

  /** Downloads a `.level.json` file (objects format). */
  function exportFile(filename = `level-${Date.now()}.json`) {
    const payload = serialize();
    const blob = new Blob([JSON.stringify({ version: 1, objects: payload }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.hud.setHint(`Exported ${payload.length} objects → ${filename}`);
    return payload;
  }

  /** Imports from an object or a JSON string (for a file input or the console). */
  function importData(input) {
    let data = input;
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch {
        app.hud.setHint('Invalid JSON file');
        return [];
      }
    }
    const payload = Array.isArray(data) ? data : data?.objects || [];
    clear();
    let count = 0;
    for (const item of payload) {
      if (!Array.isArray(item.p) || item.p.length < 3) continue;
      const [x, y, z] = item.p.map(Number);
      if (![x, y, z].every(Number.isFinite)) continue;
      const s = Number.isFinite(Number(item.s)) ? Math.max(0.2, Math.min(20, Number(item.s))) : 1;
      const r = Number.isFinite(Number(item.r)) ? Number(item.r) : 0;
      const entity = addBox(x, z, s, r);
      entity.mesh.position.set(x, y, z);
      entity.collider?.setFromObject(entity.mesh);
      count++;
    }
    app.hud.setHint(`Imported ${count} objects`);
    return payload;
  }

  function importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) importData(await file.text());
    });
    input.click();
  }

  function load() {
    let payload = [];
    try {
      payload = JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      payload = [];
    }
    clear();
    for (const item of payload) {
      const entity = addBox(item.p[0], item.p[2], item.s, item.r);
      entity.mesh.position.set(item.p[0], item.p[1], item.p[2]);
      entity.collider?.setFromObject(entity.mesh);
    }
    app.hud.setHint(`Loaded ${payload.length} objects`);
    return payload;
  }

  function clear() {
    for (const e of app.world.query('editor')) app.world.remove(e);
    app.player?.rebuildColliders();
  }

  const api = {
    get size() {
      return size;
    },
    get rotation() {
      return rotation;
    },
    save,
    load,
    clear,
    serialize,
    exportFile,
    importData,
    importFile,
    exportJson: () => JSON.stringify({ version: 1, objects: serialize() }),
    dispose() {
      runOffs();
      if (ghost) {
        ghost.removeFromParent();
        ghost.geometry.dispose();
        ghost.material.dispose();
        ghost = null;
      }
      if (app.editor === api) app.editor = null;
    },
  };

  app.editor = api;
  return api;
}
