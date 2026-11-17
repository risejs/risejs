/**
 * Server-side economy: wallet + items, applying idempotent transactions.
 * Pure (no IO) so it can be tested; the D1 routes live in index.js.
 */

/** Sample loot table; the server rolls, the client must never send the result. */
export const LOOT_TABLE = {
  crate: [
    { id: 'scrap', weight: 60, min: 1, max: 3 },
    { id: 'ammo', weight: 30, min: 5, max: 12 },
    { id: 'medkit', weight: 8, min: 1, max: 1 },
    { id: 'keycard', weight: 2, min: 1, max: 1 },
  ],
  boss: [
    { id: 'scrap', weight: 30, min: 5, max: 9 },
    { id: 'medkit', weight: 30, min: 1, max: 2 },
    { id: 'keycard', weight: 25, min: 1, max: 1 },
    { id: 'relic', weight: 15, min: 1, max: 1 },
  ],
};

/** Deterministic RNG from a seed (mulberry32): same seed ⇒ same loot, which prevents rerolls. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Rolls once from the table; seed = `${player}:${crateId}` so reopening does not change the result. */
export function rollLoot(table, seedText, { count = 1 } = {}) {
  const rows = typeof table === 'string' ? LOOT_TABLE[table] : table;
  if (!Array.isArray(rows) || !rows.length) return [];
  const rng = seededRng(hashSeed(seedText));
  const total = rows.reduce((a, r) => a + Math.max(0, r.weight ?? 0), 0);
  const out = [];

  for (let i = 0; i < Math.max(1, Math.min(6, count)); i++) {
    let pick = rng() * total;
    let row = rows[rows.length - 1];
    for (const r of rows) {
      pick -= Math.max(0, r.weight ?? 0);
      if (pick <= 0) {
        row = r;
        break;
      }
    }
    const min = Math.max(1, row.min ?? 1);
    const max = Math.max(min, row.max ?? min);
    out.push({ id: row.id, qty: min + Math.floor(rng() * (max - min + 1)) });
  }
  return out;
}

export class Wallet {
  constructor({ balance = 0, items = {}, maxKeys = 500 } = {}) {
    this.balance = Math.max(0, Math.floor(balance));
    this.items = new Map(Object.entries(items));
    this.maxKeys = maxKeys;
    this.applied = new Set();
    this.order = [];
    this.ledger = [];
  }

  get size() {
    return this.applied.size;
  }

  itemCount(id) {
    return this.items.get(id) || 0;
  }

  _seen(key) {
    if (!key) return false;
    if (this.applied.has(key)) return true;
    this.applied.add(key);
    this.order.push(key);
    if (this.order.length > this.maxKeys) this.applied.delete(this.order.shift());
    return false;
  }

  _log(entry) {
    this.ledger.push(entry);
    if (this.ledger.length > 50) this.ledger.shift();
  }

  /** op: 'grant' | 'spend'. Returns { ok, applied, reason?, balance }. */
  apply({ key, op = 'grant', currency = 'gold', amount = 0, item = null, qty = 0, reason = '' } = {}) {
    const n = Math.floor(Number(amount) || 0);
    const q = Math.floor(Number(qty) || 0);

    if (key && this.applied.has(key)) return { ok: true, applied: false, duplicate: true, balance: this.balance };
    if (op === 'spend' && n > this.balance) return { ok: false, applied: false, reason: 'insufficient', balance: this.balance };
    if (item && op === 'spend' && q > this.itemCount(item)) {
      return { ok: false, applied: false, reason: 'no-item', balance: this.balance };
    }
    if (op !== 'grant' && op !== 'spend') return { ok: false, applied: false, reason: 'bad-op' };
    if (n < 0 || q < 0) return { ok: false, applied: false, reason: 'negative' };
    if (!n && !item) return { ok: false, applied: false, reason: 'empty' };

    const sign = op === 'spend' ? -1 : 1;
    if (n) this.balance = Math.max(0, this.balance + sign * n);
    if (item) this.items.set(item, Math.max(0, this.itemCount(item) + sign * q));

    if (key) this._seen(key);
    this._log({ key: key ?? null, op, currency, amount: n, item, qty: q, reason, at: null });
    return { ok: true, applied: true, balance: this.balance };
  }

  /** Adds rolled loot under a single key for the whole opening. */
  applyLoot(key, drops = []) {
    if (key && this.applied.has(key)) {
      return { ok: true, applied: false, duplicate: true, balance: this.balance, items: this.toJSON().items };
    }
    for (const d of drops) {
      const q = Math.floor(Number(d.qty) || 0);
      if (q <= 0) continue;
      this.items.set(d.id, this.itemCount(d.id) + q);
    }
    if (key) this._seen(key);
    this._log({ key: key ?? null, op: 'loot', drops, at: null });
    return { ok: true, applied: true, balance: this.balance, items: this.toJSON().items };
  }

  toJSON() {
    return { balance: this.balance, items: Object.fromEntries(this.items) };
  }

  static fromJSON(data = {}) {
    return new Wallet({ balance: data.balance ?? 0, items: data.items ?? {} });
  }
}
