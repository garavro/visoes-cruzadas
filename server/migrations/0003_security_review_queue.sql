-- V9.1 — fila segura de revisão de mapas.
-- Não apaga nem altera mapas existentes.

CREATE TABLE IF NOT EXISTS map_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed TEXT NOT NULL,
  generator_version INTEGER NOT NULL,
  map_hash TEXT NOT NULL UNIQUE,
  map_json TEXT NOT NULL,
  player_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  positive_votes INTEGER NOT NULL DEFAULT 0,
  negative_votes INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_map_submissions_status_time
  ON map_submissions(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_map_submissions_player_count
  ON map_submissions(player_count, status);

CREATE TABLE IF NOT EXISTS map_submission_votes (
  map_hash TEXT NOT NULL,
  player_id TEXT NOT NULL,
  room_code TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (map_hash, player_id)
);

CREATE INDEX IF NOT EXISTS idx_map_submission_votes_hash_vote
  ON map_submission_votes(map_hash, vote);
