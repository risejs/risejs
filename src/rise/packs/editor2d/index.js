import * as THREE from 'three';
import { Tilemap } from '../tilemap/index.js';

/**
 * 2D editor pack: paint tiles with the mouse, with level JSON save and load.
 *
 *   app.use(editor2dPlugin, { texture, cols, rows, data, solids, tile: 1 });
 *
 * Keys: 1..4 pick a tile · left mouse paints · right mouse erases · Ctrl+S save · Ctrl+O load
 */
export function editor2dPlugin(app, { texture, cols = 4, rows = 4, data, solids = [0, 1, 2], tile = 1, storageKey } = {}) {
  const key = storageKey || `rise.editor2d.${app.id}`;
  const state = { data: data.map((r) => r.slice()), tileId: 0, painting: false, erase: false };
  const group = new THREE.Group();
  app.scene.add(group);
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

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;z-index:25;cursor:crosshair';
  app.hud.root.appendChild(overlay);

  let built = null;

  const freeGroup = () => {
    group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    group.clear();
  };

  function rebuild() {
    freeGroup();
    const map = new Tilemap({ texture, cols, rows, tile, data: state.data, solids });
    built = map.build({ chunk: 32 });
    group.add(built.group);
  }

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  function cellAt(e) {
    ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ptr, app.camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const c = Math.floor(hit.x / tile);
    const r = state.data.length - 1 - Math.floor(hit.y / tile);
    if (r < 0 || r >= state.data.length || c < 0 || c >= state.data[0].length) return null;
    return { r, c };
  }

  function paint(e) {
    const cell = cellAt(e);
    if (!cell) return;
    const id = state.erase ? -1 : state.tileId;
    if (state.data[cell.r][cell.c] === id) return;
    state.data[cell.r][cell.c] = id;
    rebuild();
  }

  on(overlay, 'pointerdown', (e) => {
    if (!app.state.is('playing')) return;
    state.painting = true;
    state.erase = e.button === 2;
    paint(e);
  });
  on(window, 'pointerup', () => (state.painting = false));
  on(overlay, 'pointermove', (e) => {
    if (state.painting) paint(e);
  });
  on(overlay, 'contextmenu', (e) => e.preventDefault());

  on(window, 'keydown', (e) => {
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5)) - 1;
      if (n >= 0 && n < cols * rows) state.tileId = n;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.code === 'KeyS') {
      e.preventDefault();
      save();
    } else if (e.code === 'KeyO') {
      e.preventDefault();
      load();
    }
  });

  function save() {
    const payload = {
      version: 1,
      game: app.id,
      tiles: { cols, rows, tile, data: state.data },
      entities: [],
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      app.hud.setHint(`Saved map ${state.data[0].length}×${state.data.length}`);
    } catch (err) {
      console.warn('[editor2d] save failed', err);
    }
    return payload;
  }

  function load() {
    try {
      const payload = JSON.parse(localStorage.getItem(key) || 'null');
      if (payload?.tiles?.data) {
        state.data = payload.tiles.data.map((r) => r.slice());
        rebuild();
        app.hud.setHint('Map loaded');
      }
    } catch (err) {
      console.warn('[editor2d] load failed', err);
    }
  }

  rebuild();

  const api = {
    get data() {
      return state.data;
    },
    get built() {
      return built;
    },
    setTile(id) {
      state.tileId = id;
    },
    save,
    load,
    rebuild,
    dispose() {
      runOffs();
      overlay.remove();
      freeGroup();
      group.removeFromParent();
      if (app.editor2d === api) app.editor2d = null;
    },
  };

  app.editor2d = api;
  app.hud.setHint('1–4 PICK TILE · LEFT MOUSE PAINT · RIGHT MOUSE ERASE · CTRL+S/O');
  return api;
}
