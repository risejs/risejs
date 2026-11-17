import * as THREE from 'three';

/**
 * Debug pack: collider wireframes, scene statistics and a navmesh grid overlay.
 *
 *   app.use(debugPlugin);           // F6: colliders · F7: statistics · F8: navmesh
 */
export function debugPlugin(app) {
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
  const group = new THREE.Group();
  group.name = 'debug';
  group.visible = false;
  app.scene.add(group);

  const boxMat = new THREE.LineBasicMaterial({ color: 0x7fd18b, transparent: true, opacity: 0.7 });
  const helperGeo = new THREE.BoxGeometry(1, 1, 1);
  const helpers = [];

  const panel = document.createElement('div');
  panel.className = 'stats';
  panel.style.cssText = 'left:16px;bottom:84px;display:none;white-space:pre;font-size:10px;line-height:1.5';
  app.hud.root.appendChild(panel);

  const navGroup = new THREE.Group();
  navGroup.visible = false;
  app.scene.add(navGroup);

  function rebuild() {
    for (const h of helpers) {
      h.removeFromParent();
      h.geometry.dispose();
    }
    helpers.length = 0;

    for (const box of app.world.colliders) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      if (size.x <= 0 || size.y <= 0 || size.z <= 0) continue;

      const line = new THREE.LineSegments(new THREE.EdgesGeometry(helperGeo), boxMat);
      line.position.copy(center);
      line.scale.copy(size);
      group.add(line);
      helpers.push(line);
    }
    return helpers.length;
  }

  const freeNav = () => {
    for (const c of [...navGroup.children]) {
      c.geometry?.dispose();
      c.material?.dispose();
    }
    navGroup.clear();
  };

  function showNav(nav) {
    freeNav();
    if (!nav) return 0;

    const pos = [];
    for (let cz = 0; cz < nav.rows; cz++) {
      for (let cx = 0; cx < nav.cols; cx++) {
        if (!nav.isBlocked(cx, cz)) continue;
        const p = nav.toWorld(cx, cz);
        const h = nav.cell * 0.45;
        pos.push(p.x - h, 0.05, p.z - h, p.x + h, 0.05, p.z - h);
        pos.push(p.x + h, 0.05, p.z - h, p.x + h, 0.05, p.z + h);
        pos.push(p.x + h, 0.05, p.z + h, p.x - h, 0.05, p.z + h);
        pos.push(p.x - h, 0.05, p.z + h, p.x - h, 0.05, p.z - h);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    navGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.5 })));
    navGroup.visible = true;
    return pos.length / 6;
  }

  let last = 0;
  offs.push(app.events.on('frame', (dt) => {
    if (!panel.style.display || panel.style.display === 'none') return;
    last += dt;
    if (last < 0.25) return;
    last = 0;

    const info = app.renderer.info;
    const bodies = app.world.entities?.length ?? app.world.query?.()?.length ?? 0;
    panel.textContent = [
      `draw ${info.render.calls} · tri ${info.render.triangles}`,
      `geo ${info.memory.geometries} · tex ${info.memory.textures}`,
      `entity ${bodies} · collider ${app.world.colliders.length}`,
      `particle ${app.vfx?.activeParticles ?? 0}`,
      `fps ${(1 / Math.max(0.0001, dt)).toFixed(0)}`,
    ].join('\n');
  }));

  on(window, 'keydown', (e) => {
    if (e.code === 'F6') {
      e.preventDefault();
      group.visible = !group.visible;
      if (group.visible) rebuild();
    } else if (e.code === 'F7') {
      e.preventDefault();
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    } else if (e.code === 'F8') {
      e.preventDefault();
      navGroup.visible = !navGroup.visible;
      if (navGroup.visible && app.nav) showNav(app.nav);
    }
  });

  const api = {
    rebuild,
    showNav,
    get boxes() {
      return group.visible ? helpers.length : 0;
    },
    toggleColliders: (v) => {
      group.visible = v ?? !group.visible;
      if (group.visible) rebuild();
      return group.visible;
    },
    dispose() {
      runOffs();
      for (const h of helpers) h.geometry.dispose();
      helpers.length = 0;
      freeNav();
      group.removeFromParent();
      navGroup.removeFromParent();
      boxMat.dispose();
      helperGeo.dispose();
      panel.remove();
      if (app.debug === api) app.debug = null;
    },
  };

  app.debug = api;
  return api;
}
