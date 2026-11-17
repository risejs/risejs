/**
 * Pure chat logic (no DOM): command parsing and rate limiting.
 */
export function parseChat(text, { defaultChannel = 'zone' } = {}) {
  const t = String(text || '').trim();
  if (!t) return null;

  if (t.startsWith('/w ') || t.startsWith('/dm ')) {
    const prefix = t.startsWith('/w ') ? 3 : 4;
    const rest = t.slice(prefix).trim();
    const [to, ...words] = rest.split(/\s+/);
    const body = words.join(' ').trim();
    if (!to || !body) return null;
    return { channel: 'dm', to, body };
  }
  if (t.startsWith('/all ')) return { channel: 'all', body: t.slice(5).trim() || null };
  if (t.startsWith('/zone ')) return { channel: 'zone', body: t.slice(6).trim() || null };

  return { channel: defaultChannel, body: t };
}

export class RateLimiter {
  constructor({ max = 5, window = 5000 } = {}) {
    this.max = max;
    this.window = window;
    this.stamps = [];
  }

  try(now = Date.now()) {
    this.stamps = this.stamps.filter((t) => now - t < this.window);
    if (this.stamps.length >= this.max) return false;
    this.stamps.push(now);
    return true;
  }
}
