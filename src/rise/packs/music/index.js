import { MOODS, chordFreqs, crossfade, duckGain, moodOf } from './core.js';
export { MOODS, chordFreqs, crossfade, duckGain, moodOf };

/**
 * Music pack: synthesized background music (no files needed) with fade and duck, or playback of a buffer.
 *
 *   app.use(musicPlugin);
 *   app.music.play('calm');
 *   app.music.duck(true);          // lower it while dialogue is open
 *   app.music.stop(1.5);
 */
export function musicPlugin(app, { volume = 0.5 } = {}) {
  let ctx = null;
  let master = null;
  let nodes = [];
  let current = null;
  let ducked = false;
  let unlock = null;
  let ownsCtx = false;
  let unavailable = false;

  function ensure() {
    if (ctx) return ctx;
    if (unavailable) return null;
    // No Web Audio (old browser, webview, headless WebKit…) → stay silent and do NOT crash the game.
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = app.audio?.ctx || (Ctx ? new Ctx() : null);
    } catch {
      ctx = null;
    }
    if (!ctx) {
      unavailable = true;
      console.warn('[rise] music: Web Audio is not available, skipping background music');
      return null;
    }
    if (!app.audio?.ctx) {
      ownsCtx = true;
      // AudioBus is still locked → unlock on the first gesture
      unlock = () => ctx.resume?.();
      window.addEventListener('pointerdown', unlock, { once: true });
    }
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(app.audio?.master || ctx.destination);
    return ctx;
  }

  function stopNodes(fade = 0.6) {
    if (!ctx || !nodes.length) return;
    const t = ctx.currentTime;
    for (const n of nodes) {
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setValueAtTime(n.gain.gain.value, t);
      n.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
      n.osc.stop(t + fade + 0.05);
    }
    nodes = [];
  }

  function play(moodName = 'calm', { fade = 1.2, buffer = null } = {}) {
    current = moodName;
    if (!ensure()) return api;
    const mood = moodOf(moodName);

    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(master);
      src.start();
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
      nodes.push({ osc: src, gain });
      return api;
    }

    stopNodes(0.3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood.cutoff;
    filter.Q.value = 0.8;

    const bus = ctx.createGain();
    bus.gain.value = mood.gain;
    filter.connect(bus).connect(master);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = mood.lfo;
    lfoGain.gain.value = mood.cutoff * 0.35;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    for (const freq of chordFreqs(mood.root, mood.notes)) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        gain.gain.value = 0;
        osc.connect(gain).connect(filter);
        osc.start();
        gain.gain.linearRampToValueAtTime(1 / (mood.notes.length * 2), ctx.currentTime + fade);
        nodes.push({ osc, gain });
      }
    }
    nodes.push({ osc: lfo, gain: lfoGain });

    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + Math.min(0.8, fade));
    return api;
  }

  function stop(fade = 0.8) {
    if (!ctx) return api;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
    stopNodes(fade);
    current = null;
    return api;
  }

  function duck(on, { fade = 0.25 } = {}) {
    ducked = !!on;
    if (!ctx) return api;
    const target = volume * (ducked ? 0.35 : 1);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + fade);
    return api;
  }

  const api = {
    play,
    stop,
    duck,
    get mood() {
      return current;
    },
    get ducked() {
      return ducked;
    },
    dispose() {
      while (offs.length) offs.pop()();
      if (unlock) window.removeEventListener('pointerdown', unlock, { once: true });
      unlock = null;
      for (const n of nodes) {
        try {
          n.osc.stop();
        } catch {}
        try {
          n.osc.disconnect();
          n.gain.disconnect();
        } catch {}
      }
      nodes = [];
      try {
        master?.disconnect();
      } catch {}
      if (ownsCtx) {
        try {
          ctx?.close?.()?.catch?.(() => {});
        } catch {}
      }
      ctx = master = null;
      current = null;
      if (app.music === api) app.music = null;
    },
  };

  // duck automatically while dialogue or the VN is open
  const offs = [
    app.events.on('dialogue:start', () => duck(true)),
    app.events.on('dialogue:end', () => duck(false)),
    app.events.on('vn:node', () => duck(true)),
    app.events.on('vn:end', () => duck(false)),
  ];

  app.music = api;
  return api;
}
