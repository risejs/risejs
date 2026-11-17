import * as THREE from 'three';
import { dayCycle } from './core.js';
export { dayCycle };

/**
 * Weather pack: instanced rain/snow plus a day–night cycle (lerps sun/fog/ambient).
 *
 *   app.use(weatherPlugin, { rain: 900 });
 *   app.weather.set('rain');         // clear | rain | snow
 *   app.weather.time = 0.4;          // 0..1 over a day
 */
export function weatherPlugin(app, { rain = 900, radius = 26, height = 18 } = {}) {
  const { scene, config } = app;

  const geo = new THREE.BoxGeometry(0.03, 0.5, 0.03);
  const mat = new THREE.MeshBasicMaterial({ color: 0x9fc6e8, transparent: true, opacity: 0.55, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, rain);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);

  const snowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const snowMat = new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.8, depthWrite: false });
  const snow = new THREE.InstancedMesh(snowGeo, snowMat, Math.floor(rain / 3));
  snow.frustumCulled = false;
  snow.count = 0;
  scene.add(snow);

  const items = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const e = new THREE.Euler();

  let mode = 'clear';
  let intensity = 0;
  let target = 0;
  const state = { time: 0.28, speed: 0.004, frozen: false };

  const sun = app.lights?.sun || scene.getObjectByName('sun');
  const hemi = app.lights?.fill || scene.getObjectByName('hemi') || null;
  // original values, restored on dispose
  const orig = {
    sunY: sun?.position?.y,
    sunI: sun?.intensity,
    hemiI: hemi?.intensity,
    fog: scene.fog ? scene.fog.color.getHex() : 0,
    density: scene.fog?.density,
  };

  function spawn(i, kind) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    items[i] = {
      x: Math.cos(a) * r,
      y: Math.random() * height,
      z: Math.sin(a) * r,
      v: kind === 'snow' ? 1.2 + Math.random() * 0.8 : 9 + Math.random() * 5,
      drift: (Math.random() - 0.5) * (kind === 'snow' ? 0.6 : 0.2),
      kind,
    };
  }

  function ensure(kind) {
    const count = kind === 'snow' ? snow.count : mesh.count;
    const limit = kind === 'snow' ? snow.instanceMatrix.count : mesh.instanceMatrix.count;
    if (count < limit) {
      spawn(count, kind);
      if (kind === 'snow') snow.count = count + 1;
      else mesh.count = count + 1;
    }
  }

  function set(next = 'clear') {
    mode = next;
    target = next === 'clear' ? 0 : 1;
    if (next !== 'snow') snow.count = 0;
    if (next !== 'rain') mesh.count = 0;
    return mode;
  }

  const api = {
    set,
    get mode() {
      return mode;
    },
    get state() {
      return state;
    },
    set time(v) {
      state.time = ((v % 1) + 1) % 1;
    },
    get time() {
      return state.time;
    },
  };

  const off = app.events.on('frame', (dt) => {
    intensity += (target - intensity) * Math.min(1, dt * 2.4);

    if (!state.frozen) state.time = (state.time + dt * state.speed) % 1;
    const c = dayCycle(state.time);

    if (sun?.isLight) {
      sun.position.y = Math.max(2, c.sunY);
      sun.intensity = c.sunIntensity * (1 - intensity * 0.65);
    }
    if (hemi?.isLight) hemi.intensity = c.ambient * (1 - intensity * 0.25);
    if (scene.fog) {
      scene.fog.color.setHex(c.fog);
      if ('density' in scene.fog) scene.fog.density = c.fogDensity * (1 + intensity * 0.6);
    }

    const active = mode === 'snow' ? 'snow' : mode === 'rain' ? 'rain' : null;
    if (!active) return;

    const want = Math.round((mode === 'snow' ? rain / 3 : rain) * intensity);
    const inst = mode === 'snow' ? snow : mesh;
    while (inst.count < want) ensure(mode);
    if (inst.count > want) inst.count = want;

    const cam = app.camera.position;
    for (let i = 0; i < inst.count; i++) {
      const it = items[i];
      it.y -= it.v * dt;
      it.x += it.drift * dt;
      if (it.y < 0) {
        it.y = height;
        it.x = (Math.random() - 0.5) * radius * 2;
        it.z = (Math.random() - 0.5) * radius * 2;
      }
      p.set(cam.x + it.x, cam.y + it.y - height * 0.4, cam.z + it.z);
      e.set(it.kind === 'snow' ? it.x : 0.18, 0, 0.06);
      q.setFromEuler(e);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  api.dispose = () => {
    off();
    for (const o of [mesh, snow]) {
      o.removeFromParent();
      o.geometry.dispose();
      o.material.dispose();
      o.dispose?.();
    }
    if (sun?.isLight && orig.sunY !== undefined) {
      sun.position.y = orig.sunY;
      sun.intensity = orig.sunI;
    }
    if (hemi?.isLight) hemi.intensity = orig.hemiI;
    if (scene.fog) {
      scene.fog.color.setHex(orig.fog);
      if (orig.density !== undefined) scene.fog.density = orig.density;
    }
    if (app.weather === api) app.weather = null;
  };

  app.weather = api;
  return api;
}
