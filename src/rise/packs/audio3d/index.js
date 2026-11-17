import * as THREE from 'three';

/**
 * Audio 3D pack: positional audio, kept out of the core.
 *
 *   app.use(audio3dPlugin);
 *   app.audio3d.playAt('hit', { x, y, z }, { gain: 0.15 });
 *   // the listener follows the camera every frame
 */
export function audio3dPlugin(app) {
  const bus = app.audio;
  if (!bus) throw new Error('[audio3d] requires audioPlugin to be installed first');

  const live = new Set();
  const timers = new Set();
  const ensure = () => {
    bus.unlock();
    return bus.ctx && bus.master ? bus : null;
  };

  function panner(pos) {
    const p = bus.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.maxDistance = 60;
    p.rolloffFactor = 1.3;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y ?? 0;
      p.positionZ.value = pos.z;
    } else {
      p.setPosition(pos.x, pos.y ?? 0, pos.z);
    }
    p.connect(bus.master);
    live.add(p);
    const t = setTimeout(() => {
      timers.delete(t);
      live.delete(p);
      try {
        p.disconnect();
      } catch {}
    }, 1500);
    timers.add(t);
    return p;
  }

  function tone({ freq = 440, dur = 0.1, type = 'sine', gain = 0.15, slide = 0, dest }) {
    const t = bus.ctx.currentTime;
    const osc = bus.ctx.createOscillator();
    const g = bus.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.1, gain = 0.12, hp = 800, dest }) {
    const t = bus.ctx.currentTime;
    const n = Math.floor(bus.ctx.sampleRate * dur);
    const buf = bus.ctx.createBuffer(1, n, bus.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = bus.ctx.createBufferSource();
    src.buffer = buf;
    const filter = bus.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = bus.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(dest);
    src.start(t);
  }

  const api = {
    get ready() {
      return !!bus.ctx;
    },

    /** Plays a sound at a world position. */
    playAt(kind, pos, opts = {}) {
      if (!ensure()) return false;
      const dest = panner(pos);

      switch (kind) {
        case 'step':
          noise({ dur: 0.07, gain: opts.gain ?? 0.1, hp: 1100, dest });
          break;
        case 'hit':
          noise({ dur: 0.14, gain: 0.18, hp: 280, dest });
          tone({ freq: 120, dur: 0.14, type: 'sine', gain: 0.16, slide: -60, dest });
          break;
        case 'ui':
          tone({ freq: 660, dur: 0.07, type: 'square', gain: 0.08, slide: -220, dest });
          break;
        default:
          tone({ freq: 440, dur: 0.1, gain: 0.12, dest });
      }
      return true;
    },

    /** Updates the listener from the camera. */
    setListener(camera) {
      if (!bus.ctx) return;
      const l = bus.ctx.listener;
      const p = camera.position;
      if (l.positionX) {
        l.positionX.value = p.x;
        l.positionY.value = p.y;
        l.positionZ.value = p.z;
        const v = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        l.forwardX.value = v.x;
        l.forwardY.value = v.y;
        l.forwardZ.value = v.z;
        l.upX.value = 0;
        l.upY.value = 1;
        l.upZ.value = 0;
      } else {
        l.setPosition(p.x, p.y, p.z);
        l.setOrientation(0, 0, -1, 0, 1, 0);
      }
    },
  };

  app.audio3d = api;
  const off = app.events.on('frame', () => api.setListener(app.camera));
  api.dispose = () => {
    off();
    timers.forEach(clearTimeout);
    timers.clear();
    for (const p of live) {
      try {
        p.disconnect();
      } catch {}
    }
    live.clear();
    if (app.audio3d === api) app.audio3d = null;
  };
  return api;
}
