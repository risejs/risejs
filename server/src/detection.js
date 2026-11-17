/**
 * Coarse detection: macros (fire rhythm too regular) and abnormal accuracy.
 * Flags and telemetry only; NO auto-ban. Pure and testable.
 */
export class ShotPattern {
  constructor({ maxShots = 40, minShots = 12, macroStdMs = 8, highAccuracy = 0.85, highShots = 20 } = {}) {
    this.maxShots = maxShots;
    this.minShots = minShots;
    this.macroStdMs = macroStdMs;
    this.highAccuracy = highAccuracy;
    this.highShots = highShots;
    this.shots = [];
  }

  record({ t, hit = false }) {
    this.shots.push({ t, hit });
    if (this.shots.length > this.maxShots) this.shots.shift();
    return this;
  }

  get count() {
    return this.shots.length;
  }

  get accuracy() {
    if (!this.shots.length) return 0;
    return this.shots.filter((s) => s.hit).length / this.shots.length;
  }

  intervals() {
    const out = [];
    for (let i = 1; i < this.shots.length; i++) out.push(this.shots[i].t - this.shots[i - 1].t);
    return out;
  }

  stdMs() {
    const list = this.intervals();
    if (list.length < 2) return Infinity;
    const mean = list.reduce((a, b) => a + b, 0) / list.length;
    const varSum = list.reduce((a, b) => a + (b - mean) ** 2, 0) / list.length;
    return Math.sqrt(varSum);
  }

  flags() {
    const out = [];
    if (this.shots.length >= this.minShots && this.stdMs() < this.macroStdMs) out.push('macro');
    if (this.shots.length >= this.highShots && this.accuracy > this.highAccuracy) out.push('high-accuracy');
    return out;
  }

  score() {
    let s = 0;
    if (this.flags().includes('macro')) s += 0.5;
    if (this.flags().includes('high-accuracy')) s += 0.4;
    return Math.min(1, s);
  }
}
