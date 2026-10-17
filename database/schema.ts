import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

export const DATABASE_VERSION = 2;

export const DATABASE_URL = new URL("../data/yolo.sqlite", import.meta.url);

export const DATABASE_PATH = fileURLToPath(DATABASE_URL);

type UserVersionRow = {
  user_version: number | bigint;
};

/**
 * Configure les options SQLite communes au bot et aux scripts.
 */
export function configureDatabase(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);
}

function getDatabaseVersion(database: DatabaseSync): number {
  const row = database.prepare("PRAGMA user_version").get() as
    | UserVersionRow
    | undefined;

  return row ? Number(row.user_version) : 0;
}

function tableExists(database: DatabaseSync, tableName: string): boolean {
  const row = database
    .prepare(
      `
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1
      `,
    )
    .get(tableName);

  return row !== undefined;
}

/**
 * Crée le schéma SQLite V2.
 *
 * `games.json` reste la source de vérité des jeux :
 * la base ne conserve que `game_id`.
 */
export function createDatabaseSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      message_id TEXT NOT NULL UNIQUE,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,

      game_id TEXT NOT NULL,

      scheduled_at INTEGER NOT NULL
        CHECK (scheduled_at > 0),

      description TEXT,

      creator_id TEXT NOT NULL,
      host_id TEXT NOT NULL,

      role_id TEXT UNIQUE,

      status TEXT NOT NULL DEFAULT 'active'
        CHECK (
          status IN (
            'active',
            'cancelled',
            'completed'
          )
        ),

      start_notified_at INTEGER,
      closed_at INTEGER,

      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
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

      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

      PRIMARY KEY (session_id, user_id),

      FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_sessions_guild_status
      ON sessions(guild_id, status);

    CREATE INDEX IF NOT EXISTS idx_sessions_status_scheduled
      ON sessions(status, scheduled_at);

    CREATE INDEX IF NOT EXISTS idx_session_members_status
      ON session_members(session_id, status);

    PRAGMA user_version = ${DATABASE_VERSION};
  `);
}

/**
 * Initialise une base vide ou valide une base déjà créée en V2.
 *
 * Une ancienne base est volontairement refusée : ce projet utilise
 * `pnpm db:reset` pour repartir proprement pendant le développement.
 */
export function initializeDatabaseSchema(database: DatabaseSync): void {
  const version = getDatabaseVersion(database);
  const hasSessionsTable = tableExists(database, "sessions");

  if (version === 0 && !hasSessionsTable) {
    createDatabaseSchema(database);
    return;
  }

  if (version === DATABASE_VERSION) {
    createDatabaseSchema(database);
    return;
  }

  if (version === 0 && hasSessionsTable) {
    throw new Error(
      "Ancienne base SQLite détectée. Arrête le bot puis exécute `pnpm db:reset`.",
    );
  }

  throw new Error(
    `Version SQLite non supportée : ${version}. Version attendue : ${DATABASE_VERSION}.`,
  );
}
