import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const databaseUrl = new URL("../data/yolo.sqlite", import.meta.url);
const databasePath = fileURLToPath(databaseUrl);

mkdirSync(dirname(databasePath), {
  recursive: true,
});

export const db = new DatabaseSync(databasePath, {
  timeout: 5000,
});

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    message_id TEXT NOT NULL UNIQUE,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,

    game_id TEXT NOT NULL,
    game_name TEXT NOT NULL,
    game_emoji TEXT,

    when_text TEXT NOT NULL,
    description TEXT,

    creator_id TEXT NOT NULL,
    host_id TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'active'
      CHECK (
        status IN (
          'active',
          'cancelled',
          'completed',
          'deleted'
        )
      ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    cancelled_at TEXT,
    completed_at TEXT,
    deleted_at TEXT
  ) STRICT;

  CREATE TABLE IF NOT EXISTS session_members (
    session_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,

    status TEXT NOT NULL
      CHECK (
        status IN (
          'joined',
          'maybe',
          'left'
        )
      ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (session_id, user_id),

    FOREIGN KEY (session_id)
      REFERENCES sessions(id)
      ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_sessions_guild
    ON sessions(guild_id);

  CREATE INDEX IF NOT EXISTS idx_sessions_status
    ON sessions(status);

  CREATE INDEX IF NOT EXISTS idx_sessions_message
    ON sessions(message_id);

  CREATE INDEX IF NOT EXISTS idx_session_members_session
    ON session_members(session_id);
`);
