-- D1 schema for Rise
CREATE TABLE IF NOT EXISTS saves (
  game TEXT NOT NULL,
  player TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (game, player)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT,
  player TEXT,
  type TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events (type, created_at);

-- Wallet + items (idempotent per key)
CREATE TABLE IF NOT EXISTS wallets (
  game TEXT NOT NULL,
  player TEXT NOT NULL,
  gold INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (game, player)
);

CREATE TABLE IF NOT EXISTS wallet_items (
  game TEXT NOT NULL,
  player TEXT NOT NULL,
  item TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game, player, item)
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  game TEXT NOT NULL,
  player TEXT NOT NULL,
  key TEXT NOT NULL,
  op TEXT NOT NULL,
  currency TEXT,
  amount INTEGER,
  item TEXT,
  qty INTEGER,
  reason TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (game, player, key)
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created ON wallet_ledger (created_at);
