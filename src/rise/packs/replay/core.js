/** Replay: records input per tick and plays it back; deterministic thanks to the seed. Pure. */

export function packInput(input = {}) {
  return [Math.round((input.mx ?? 0) * 100), Math.round((input.mz ?? 0) * 100), Math.round(((input.yaw ?? 0) / Math.PI) * 180)];
}

export function unpackInput(triple = [0, 0, 0]) {
  return { mx: triple[0] / 100, mz: triple[1] / 100, yaw: (triple[2] / 180) * Math.PI };
}

export class Recorder {
  constructor({ tickMs = 50, seed = 1, capacity = 3600 } = {}) {
    this.tickMs = tickMs;
    this.seed = seed;
    this.capacity = capacity;
    this.frames = [];
    this.startAt = null;
  }

  record(t, input) {
    if (this.startAt === null) this.startAt = t;
    if (this.frames.length >= this.capacity) this.frames.shift();
    this.frames.push([Math.round(((t - this.startAt) * 1000) / this.tickMs), ...packInput(input)]);
    return this.frames.length;
  }

  get durationMs() {
    if (!this.frames.length) return 0;
    return this.frames[this.frames.length - 1][0] * this.tickMs;
  }

  toJSON(meta = {}) {
    return { v: 1, tickMs: this.tickMs, seed: this.seed, durationMs: this.durationMs, meta, frames: this.frames };
  }

  static fromJSON(json) {
    const rec = new Recorder({ tickMs: json.tickMs, seed: json.seed, capacity: Math.max(1, json.frames.length) });
    rec.frames = json.frames.map((f) => [...f]);
    rec.startAt = 0;
    return rec;
  }
}

export class Playback {
  constructor(data) {
    this.data = data;
    this.frames = data.frames || [];
    this.time = 0;
    this.index = 0;
  }

  get done() {
    return this.index >= this.frames.length;
  }

  get durationMs() {
    return this.data.durationMs || 0;
  }

  /** Returns the input at time t (ms); keeps the last input when there is no newer frame. */
  at(tms) {
    const tick = tms / (this.data.tickMs || 50);
    let last = { mx: 0, mz: 0, yaw: 0 };
    let i = this.index;
    while (i < this.frames.length && this.frames[i][0] <= tick) {
      last = unpackInput(this.frames[i].slice(1));
      i++;
    }
    this.index = i;
    return last;
  }

  reset() {
    this.index = 0;
    this.time = 0;
  }
}
