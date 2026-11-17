/**
 * IntegrityGuard: client-side anomaly detection.
 *
 * This is an *early detection* layer, not a complete anti-cheat: anything the client
 * can check, the client can also change. Real cheat prevention needs server validation
 * (see docs/anticheat.md).
 *
 * Catches: speed hacks (abnormal dt), teleports, speed above the threshold, impossible coordinates,
 * NaN/Infinity, input spam.
 */
export class IntegrityGuard {
  constructor({ player, events, input, limits = {} } = {}) {
    this.player = player;
    this.events = events;
    this.input = input;
    this.limits = {
      maxSpeed: limits.maxSpeed ?? 12,
      maxStep: limits.maxStep ?? 3.5,
      maxInputPerSec: limits.maxInputPerSec ?? 160,
      bounds: limits.bounds ?? 600,
      maxDt: limits.maxDt ?? 0.35,
      ...limits,
    };

    this.last = null;
    this.flags = [];
    this.sampleTime = 0;
    this.inputSamples = 0;
    this.enabled = true;
  }

  flag(type, detail) {
    const item = { type, detail, at: performance.now() };
    this.flags.push(item);
    if (this.flags.length > 50) this.flags.shift();
    this.events?.emit('anticheat:flag', item);
    return item;
  }

  update(dt) {
    if (!this.enabled || !this.player) return;
    const p = this.player;
    const { x, y, z } = p.pos;
    const lim = this.limits;

    // skip the first few frames to avoid false alarms while the page loads
    this.warmup = (this.warmup || 0) + 1;
    if (this.warmup < 30) {
      this.last = { x, y, z };
      if (this.input) this.input.activity = 0;
      return;
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      this.flag('invalid-position', { x, y, z });
      return;
    }

    if (Math.abs(x) > lim.bounds || Math.abs(z) > lim.bounds || y < -50) {
      this.flag('out-of-bounds', { x, y, z });
    }

    if (dt > lim.maxDt && !document.hidden) {
      this.flag('time-anomaly', { dt });
    }

    if (this.last) {
      const dist = Math.hypot(x - this.last.x, z - this.last.z);
      const speed = dt > 0 ? dist / dt : 0;

      if (dist > lim.maxStep) this.flag('teleport', { dist });
      if (speed > lim.maxSpeed) this.flag('speed', { speed: +speed.toFixed(2) });
    }

    this.last = { x, y, z };

    // input spam: count events in a 1 s window
    this.sampleTime += dt;
    this.inputSamples += this.input?.activity ?? 0;
    if (this.input) this.input.activity = 0;

    if (this.sampleTime >= 1) {
      const rate = this.inputSamples / this.sampleTime;
      if (rate > lim.maxInputPerSec) this.flag('input-flood', { rate: Math.round(rate) });
      this.sampleTime = 0;
      this.inputSamples = 0;
    }
  }

  /** Summary to send to the server or telemetry. */
  report() {
    return { flags: this.flags.slice(-20), count: this.flags.length };
  }

  reset() {
    this.last = null;
    this.flags = [];
  }
}
