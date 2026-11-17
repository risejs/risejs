/**
 * Chat filtering: masks blocked words, stops repeated messages, keeps an ignore list.
 * Pure, no DOM.
 */
export const DEFAULT_BLOCKED = ['dm', 'duma', 'vcl', 'fuck', 'shit', 'bitch', 'nigger'];

export function maskWords(text, blocked = DEFAULT_BLOCKED, char = '*') {
  if (!text) return '';
  let out = String(text);
  for (const w of blocked) {
    if (!w) continue;
    const re = new RegExp(`(${w.slice(0, 1)})[${w.slice(1).split('').join('')}]`, 'gi');
    out = out.replace(re, (m) => m[0] + char.repeat(Math.max(1, m.length - 1)));
  }
  return out;
}

/** Blocks a message that repeats the previous one within `windowMs`. */
export class SpamGuard {
  constructor({ windowMs = 8000, limit = 2 } = {}) {
    this.windowMs = windowMs;
    this.limit = limit;
    this.recent = [];
  }

  accept(text, now = Date.now()) {
    this.recent = this.recent.filter((r) => now - r.t < this.windowMs);
    const same = this.recent.filter((r) => r.text === text).length;
    if (same >= this.limit) return false;
    this.recent.push({ text, t: now });
    return true;
  }
}

export class IgnoreList {
  constructor(names = []) {
    this.names = new Set(names);
  }
  add(name) {
    this.names.add(String(name));
    return this;
  }
  remove(name) {
    this.names.delete(String(name));
    return this;
  }
  has(name) {
    return this.names.has(String(name));
  }
  list() {
    return [...this.names];
  }
}
