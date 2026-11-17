/**
 * Byte-budgeted LRU cache with a preview of what would be evicted.
 * Pure logic: the caller passes the time, so tests can use a fake clock.
 */
export class ByteCache {
  constructor({ budget = 64 * 1024 * 1024 } = {}) {
    this.budget = budget;
    this.map = new Map();
    this.seq = 0;
  }

  put(key, value, { size = null, retained = false, at = 0 } = {}) {
    const bytes = Number(size ?? value?.byteLength ?? value?.length ?? 0);
    if (!(bytes >= 0)) throw new Error('[cache] invalid size');
    const entry = { key, value, bytes, retained, lastUsed: at, seq: ++this.seq };
    this.map.set(key, entry);
    return entry;
  }

  get(key, at = 0) {
    const e = this.map.get(key);
    if (!e) return null;
    e.lastUsed = at;
    return e.value;
  }

  touch(key, at = 0) {
    const e = this.map.get(key);
    if (e) e.lastUsed = at;
    return !!e;
  }

  retain(key, retained = true) {
    const e = this.map.get(key);
    if (!e) return false;
    e.retained = retained;
    return true;
  }

  has(key) {
    return this.map.has(key);
  }

  delete(key) {
    return this.map.delete(key);
  }

  get size() {
    return this.map.size;
  }

  get bytes() {
    let n = 0;
    for (const e of this.map.values()) n += e.bytes;
    return n;
  }

  report() {
    let protectedBytes = 0;
    for (const e of this.map.values()) if (e.retained) protectedBytes += e.bytes;
    return {
      entries: this.map.size,
      totalBytes: this.bytes,
      protectedBytes,
      reclaimableBytes: this.bytes - protectedBytes,
      budget: this.budget,
      budgetMet: this.bytes <= this.budget,
    };
  }

  /**
   * Evicts down to the budget. `dryRun` only returns the plan and deletes nothing.
   * Retained entries are never evicted; if the cache is still over budget, budgetMet is false.
   */
  clean(budget = this.budget, { dryRun = false, at = 0 } = {}) {
    const before = this.report();
    if (before.totalBytes <= budget) {
      return { removed: [], released: 0, remaining: before.totalBytes, budgetMet: true, dryRun, report: before };
    }

    const candidates = [...this.map.values()]
      .filter((e) => !e.retained)
      .sort((a, b) => a.lastUsed - b.lastUsed || a.seq - b.seq);

    const removed = [];
    let total = before.totalBytes;
    let released = 0;

    for (const e of candidates) {
      if (total <= budget) break;
      removed.push(e.key);
      total -= e.bytes;
      released += e.bytes;
      if (!dryRun) this.map.delete(e.key);
      void at;
    }

    const remaining = dryRun ? before.totalBytes : this.bytes;
    return {
      removed,
      released,
      remaining,
      budgetMet: remaining <= budget,
      dryRun,
      report: dryRun ? before : this.report(),
    };
  }

  clear({ keepRetained = true } = {}) {
    let removed = 0;
    for (const [k, e] of [...this.map]) {
      if (keepRetained && e.retained) continue;
      this.map.delete(k);
      removed++;
    }
    return removed;
  }
}

/** Splits bytes into small pieces so they can be evicted gradually when over budget (if needed). */
export function splitBudget(budget, parts = 4) {
  const each = Math.floor(budget / Math.max(1, parts));
  return Array.from({ length: parts }, () => each);
}
