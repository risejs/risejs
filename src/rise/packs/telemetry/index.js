import { TelemetryBuffer, summarize } from './core.js';

/**
 * Telemetry pack: collects lightweight events and sends batches when full, on an interval, or when the tab is hidden.
 *
 *   app.use(telemetryPlugin, { url: 'http://127.0.0.1:8787/api/events' });
 *   app.telemetry.event('level.start', { level: 'city' });
 */
export function telemetryPlugin(app, { url = '/api/events', flushMs = 15000, max = 50, token = null } = {}) {
  const buffer = new TelemetryBuffer({ url, flushMs, max });

  async function flush({ beacon = false } = {}) {
    const events = buffer.take();
    if (!events.length) return 0;

    const body = JSON.stringify({ game: app.game?.id || app.id, events });
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;

    try {
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        await fetch(url, { method: 'POST', headers, body, keepalive: true });
      }
    } catch {
      // offline: drop the batch, never block the game
    }
    return events.length;
  }

  const timer = setInterval(() => flush(), flushMs);
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

  on(window, 'beforeunload', () => flush({ beacon: true }));
  on(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush({ beacon: true });
  });

  on(window, 'error', (e) => {
    buffer.push('error', { msg: String(e.message || e.error || 'unknown'), src: e.filename || '' });
  });
  on(window, 'unhandledrejection', (e) => {
    buffer.push('error', { msg: String(e.reason?.message || e.reason || 'rejection') });
  });

  const api = {
    event: (type, data) => buffer.push(type, data),
    flush,
    summary: () => summarize(buffer.queue),
    get pending() {
      return buffer.size;
    },
    stop() {
      clearInterval(timer);
    },
    dispose() {
      clearInterval(timer);
      runOffs();
      if (app.telemetry === api) app.telemetry = null;
    },
  };

  app.telemetry = api;
  return api;
}
