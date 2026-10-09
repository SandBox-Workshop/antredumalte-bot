import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

/**
 * Emplacement de la base SQLite persistante du bot.
 *
 * Le chemin est résolu relativement au projet afin que la base
 * reste stockée dans `data/yolo.sqlite`.
 */
const DATABASE_URL = new URL("../data/yolo.sqlite", import.meta.url);

const DATABASE_PATH = fileURLToPath(DATABASE_URL);

/**
 * Garantit l'existence du dossier contenant la base avant
 * l'ouverture de SQLite.
 */
mkdirSync(dirname(DATABASE_PATH), {
  recursive: true,
});

/**
 * Connexion SQLite partagée par les services de persistance.
 *
 * `DatabaseSync` est volontairement utilisé ici : les opérations
 * effectuées par le bot sont petites et transactionnelles, et cette
 * API évite d'ajouter une dépendance SQLite externe.
 */
export const db = new DatabaseSync(DATABASE_PATH, {
  timeout: 5000,
});

/**
 * Initialisation du schéma.
 *
 * Cette opération est idempotente et peut être exécutée à chaque
 * démarrage du bot.
 *
 * WAL améliore la robustesse des accès concurrents tandis que
 * les clés étrangères garantissent notamment la suppression
 * des membres lorsqu'une session disparaît.
 */
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
