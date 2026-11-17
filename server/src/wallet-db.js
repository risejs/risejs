/**
 * D1 wallet: idempotent at the SQL level.
 *
 * Principle: `wallet_ledger` is the only "gate". Every transaction must INSERT its key
 * into the ledger before changing a balance; a duplicate key is skipped. If a later step fails
 * (not enough money), the key is deleted so the next attempt still counts.
 *
 * Spend uses an UPDATE guarded by `gold >= ?`, so the wallet cannot go negative even with parallel requests.
 */
const clampInt = (v, max = 1e9) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

export async function readWallet(db, game, player) {
  const [wallet, items] = await Promise.all([
    db.prepare('SELECT gold FROM wallets WHERE game = ? AND player = ?').bind(game, player).first(),
    db.prepare('SELECT item, qty FROM wallet_items WHERE game = ? AND player = ?').bind(game, player).all(),
  ]);
  return {
    gold: wallet?.gold ?? 0,
    items: Object.fromEntries((items.results ?? []).map((r) => [r.item, r.qty])),
  };
}

export async function applyWallet(db, { game, player, key, op = 'grant', currency = 'gold', amount = 0, item = null, qty = 0, reason = '' }) {
  const n = clampInt(amount);
  const q = clampInt(qty);
  const k = String(key || '').slice(0, 80);
  if (!k) return { ok: false, reason: 'key-required' };
  if (op !== 'grant' && op !== 'spend') return { ok: false, reason: 'bad-op' };
  if (!n && !item) return { ok: false, reason: 'empty' };
  if (currency !== 'gold' && n) return { ok: false, reason: 'bad-currency' };

  const now = Date.now();
  const gate = await db
    .prepare(
      'INSERT OR IGNORE INTO wallet_ledger (game, player, key, op, currency, amount, item, qty, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(game, player, k, op, currency, n, item, q, String(reason).slice(0, 120), now)
    .run();

  if (!gate.meta || gate.meta.changes === 0) {
    const wallet = await readWallet(db, game, player);
    return { ok: true, applied: false, duplicate: true, ...wallet };
  }

  await db
    .prepare('INSERT OR IGNORE INTO wallets (game, player, gold, updated_at) VALUES (?, ?, 0, ?)')
    .bind(game, player, now)
    .run();

  if (n) {
    const sql =
      op === 'grant'
        ? 'UPDATE wallets SET gold = gold + ?, updated_at = ? WHERE game = ? AND player = ?'
        : 'UPDATE wallets SET gold = gold - ?, updated_at = ? WHERE game = ? AND player = ? AND gold >= ?';
    const stmt =
      op === 'grant'
        ? db.prepare(sql).bind(n, now, game, player)
        : db.prepare(sql).bind(n, now, game, player, n);
    const res = await stmt.run();
    if (op === 'spend' && (!res.meta || res.meta.changes === 0)) {
      await db.prepare('DELETE FROM wallet_ledger WHERE game = ? AND player = ? AND key = ?').bind(game, player, k).run();
      const wallet = await readWallet(db, game, player);
      return { ok: false, applied: false, reason: 'insufficient', ...wallet };
    }
  }

  if (item) {
    const insert = db
      .prepare('INSERT OR IGNORE INTO wallet_items (game, player, item, qty) VALUES (?, ?, ?, 0)')
      .bind(game, player, item);
    const update =
      op === 'grant'
        ? db.prepare('UPDATE wallet_items SET qty = qty + ? WHERE game = ? AND player = ? AND item = ?').bind(q, game, player, item)
        : db
            .prepare('UPDATE wallet_items SET qty = qty - ? WHERE game = ? AND player = ? AND item = ? AND qty >= ?')
            .bind(q, game, player, item, q);

    await insert.run();
    const res = await update.run();
    if (op === 'spend' && (!res.meta || res.meta.changes === 0)) {
      await db.prepare('DELETE FROM wallet_ledger WHERE game = ? AND player = ? AND key = ?').bind(game, player, k).run();
      const wallet = await readWallet(db, game, player);
      return { ok: false, applied: false, reason: 'no-item', ...wallet };
    }
  }

  const wallet = await readWallet(db, game, player);
  return { ok: true, applied: true, ...wallet };
}

export const WALLET_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS wallets (game TEXT NOT NULL, player TEXT NOT NULL, gold INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (game, player))',
  'CREATE TABLE IF NOT EXISTS wallet_items (game TEXT NOT NULL, player TEXT NOT NULL, item TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (game, player, item))',
  'CREATE TABLE IF NOT EXISTS wallet_ledger (game TEXT NOT NULL, player TEXT NOT NULL, key TEXT NOT NULL, op TEXT NOT NULL, currency TEXT, amount INTEGER, item TEXT, qty INTEGER, reason TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (game, player, key))',
  'CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created ON wallet_ledger (created_at)',
];
