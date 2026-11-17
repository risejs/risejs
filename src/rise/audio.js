/**
 * Minimal audio bus: synthesised with WebAudio, no files loaded.
 * Unlocked on the first gesture (browser autoplay policy).
 *
 *   app.audio.play('ui')       // UI click
 *   app.audio.play('step')     // footstep
 *   app.audio.play('hit')      // impact
 *   app.audio.play('error')    // invalid action
 *
 * 3D audio lives in the `audio3d` pack (opt-in).
 */
export class AudioBus {
  constructor({ enabled = true, volume = 0.5 } = {}) {
    this.enabled = enabled;
    this.volume = volume;
    this.ctx = null;
    this.master = null;
    this._lastStep = 0;
  }

  unlock() {
    if (!this.enabled || this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  _tone({ freq = 440, dur = 0.08, type = 'sine', gain = 0.2, slide = 0 }) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.08, gain = 0.15, hp = 800 } = {}) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  play(kind, opts = {}) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    switch (kind) {
      case 'ui':
        this._tone({ freq: 660, dur: 0.06, type: 'square', gain: 0.06, slide: -220 });
        break;
      case 'step': {
        const now = performance.now();
        if (now - this._lastStep < 140) return;
        this._lastStep = now;
        this._noise({ dur: 0.06, gain: opts.gain ?? 0.06, hp: 1200 });
        break;
      }
      case 'jump':
        this._tone({ freq: 320, dur: 0.12, type: 'triangle', gain: 0.08, slide: 180 });
        break;
      case 'hit':
        this._noise({ dur: 0.12, gain: 0.14, hp: 300 });
        this._tone({ freq: 120, dur: 0.12, type: 'sine', gain: 0.12, slide: -60 });
        break;
      case 'error':
        this._tone({ freq: 180, dur: 0.14, type: 'sawtooth', gain: 0.08, slide: -60 });
        break;
      default:
        this._tone({ freq: 440, dur: 0.08, gain: 0.08 });
    }
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
