/** Pure telemetry: builds events, batches them, summarizes. */
export function makeEvent(type, data = {}, now = Date.now()) {
  return { type: String(type).slice(0, 40), t: now, ...sanitize(data) };
}

function sanitize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 120);
  }
  return out;
}

export class TelemetryBuffer {
  constructor({ max = 50, url = '/api/events', flushMs = 15000 } = {}) {
    this.max = max;
    this.url = url;
    this.flushMs = flushMs;
    this.queue = [];
  }

  push(type, data, now = Date.now()) {
    this.queue.push(makeEvent(type, data, now));
    if (this.queue.length > this.max) this.queue.shift();
    return this.queue.length;
  }

  take() {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  get size() {
    return this.queue.length;
  }
}

export function summarize(events = []) {
  const counts = {};
  for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
  return {
    total: events.length,
    counts,
    span: events.length > 1 ? events[events.length - 1].t - events[0].t : 0,
  };
}
