CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  set_name TEXT,
  set_number TEXT,
  rarity TEXT,
  card_condition TEXT,
  imagen_base64 TEXT NOT NULL,
  raw_description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at);
