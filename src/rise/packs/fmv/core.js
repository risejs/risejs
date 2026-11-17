/**
 * Pure FMV logic (no DOM): timeline, QTE and branch graph.
 * Testable in Node.
 */
/** The subtitle cue visible at time t, from [{ start, end, text }]. */
export function activeCue(cues = [], t = 0) {
  for (const c of cues) {
    if (t >= c.start && t < c.end) return c;
  }
  return null;
}

/** Parses simple WebVTT into an array of cues. */
export function parseVtt(text = '') {
  const cues = [];
  const blocks = String(text).replace(/\r\n/g, '\n').split(/\n{2,}/);
  const toSec = (s) => {
    const m = s.trim().match(/(\d+):(\d{2}):(\d{2})[.,](\d{3})/) || s.trim().match(/(\d{2}):(\d{2})[.,](\d{3})/);
    if (!m) return 0;
    if (m.length === 5) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
    return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 1000;
  };

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;
    const [a, b] = timeLine.split('-->');
    const textLines = lines.slice(lines.indexOf(timeLine) + 1);
    if (!textLines.length) continue;
    cues.push({ start: toSec(a), end: toSec(b), text: textLines.join('\n') });
  }
  return cues;
}

export class Timeline {
  constructor(cues = []) {
    this.cues = cues.map((c) => ({ ...c, fired: false }));
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    const fired = [];
    for (const c of this.cues) {
      if (!c.fired && this.time >= c.t) {
        c.fired = true;
        fired.push(c);
      }
    }
    return fired;
  }

  get progress() {
    return this.time;
  }

  reset() {
    this.cues.forEach((c) => (c.fired = false));
    this.time = 0;
  }
}

export class QTE {
  constructor({ at = 1, window = 0.8, key = 'KeyE' } = {}) {
    this.at = at;
    this.window = window;
    this.key = key;
    this.state = 'idle'; // idle → open → hit | miss
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'idle' && this.time >= this.at) this.state = 'open';
    if (this.state === 'open' && this.time > this.at + this.window) this.state = 'miss';
    return this.state;
  }

  press(code) {
    if (this.state === 'open' && code === this.key) {
      this.state = 'hit';
      return true;
    }
    return false;
  }

  reset() {
    this.state = 'idle';
    this.time = 0;
  }
}

export class BranchGraph {
  constructor(nodes = {}, start = null) {
    this.nodes = nodes;
    this.start = start;
    this.id = start;
  }

  current() {
    return this.nodes[this.id] ?? null;
  }

  choose(index) {
    const node = this.current();
    const choice = node?.choices?.[index];
    if (!choice) return null;
    this.id = choice.next;
    return this.current();
  }

  go(id) {
    this.id = id;
    return this.current();
  }
}
