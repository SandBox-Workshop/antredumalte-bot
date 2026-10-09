import { db } from "./database.service.js";

import type {
  CreateSessionInput,
  GameSession,
  SessionHistoryEntry,
  SessionMemberStatus,
  SessionStatus,
  UpdateSessionDetailsInput,
  UpdateSessionGameInput,
} from "../types/session.js";

/**
 * Représentation brute d'une ligne de la table `sessions`.
 *
 * Les noms utilisent volontairement le snake_case du schéma SQLite.
 * La conversion vers le modèle applicatif est effectuée dans
 * `hydrateSession`.
 */
type SessionRow = {
  id: number;

  message_id: string;
  guild_id: string;
  channel_id: string;

  game_id: string;
  game_name: string;
  game_emoji: string | null;

  when_text: string;
  description: string | null;

  creator_id: string;
  host_id: string;

  status: SessionStatus;

  created_at: string;
  updated_at: string;

  cancelled_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
};

/**
 * Représentation brute d'un membre chargé depuis SQLite.
 */
type SessionMemberRow = {
  user_id: string;
  status: SessionMemberStatus;
};

/**
 * Ligne utilisée par la requête d'historique.
 *
 * Les compteurs SQLite sont ajoutés à la structure standard
 * d'une session.
 */
type SessionHistoryRow = SessionRow & {
  joined_count: number | bigint;
  maybe_count: number | bigint;
};

/**
 * Recherche une session active à partir de son message Discord.
 */
function getSessionRow(messageId: string): SessionRow | null {
  const statement = db.prepare(`
    SELECT *
    FROM sessions
    WHERE message_id = ?
      AND status = 'active'
    LIMIT 1
  `);

  const row = statement.get(messageId) as SessionRow | undefined;

  return row ?? null;
}

/**
 * Charge les membres associés à une session.
 */
function getSessionMembers(sessionId: number): SessionMemberRow[] {
  const statement = db.prepare(`
    SELECT user_id, status
    FROM session_members
    WHERE session_id = ?
  `);

  return statement.all(sessionId) as SessionMemberRow[];
}

/**
 * Convertit une ligne SQLite en modèle métier `GameSession`.
 *
 * Les membres sont répartis dans deux ensembles afin de conserver
 * le comportement historique de la feature :
 *
 * - `participants` pour les membres inscrits ;
 * - `maybes` pour les membres potentiellement disponibles.
 */
function hydrateSession(row: SessionRow | null): GameSession | null {
  if (!row) {
    return null;
  }

  const members = getSessionMembers(row.id);

  const participants = new Set(
    members
      .filter((member) => member.status === "joined")
      .map((member) => member.user_id),
  );

  const maybes = new Set(
    members
      .filter((member) => member.status === "maybe")
      .map((member) => member.user_id),
  );

  return {
    id: row.id,

    messageId: row.message_id,
    guildId: row.guild_id,
    channelId: row.channel_id,

    game: {
      id: row.game_id,
      name: row.game_name,
      emoji: row.game_emoji,
    },

    when: row.when_text,
    description: row.description,

    creatorId: row.creator_id,
    hostId: row.host_id,

    status: row.status,

    participants,
    maybes,

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Insère ou met à jour le statut d'un membre dans une session.
 */
function updateMemberStatus(
  sessionId: number,
  userId: string,
  status: SessionMemberStatus,
): void {
  const statement = db.prepare(`
    INSERT INTO session_members (
      session_id,
      user_id,
      status
    )
    VALUES (?, ?, ?)

    ON CONFLICT(session_id, user_id)
    DO UPDATE SET
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `);

  statement.run(sessionId, userId, status);
}

/**
 * Met à jour la date de dernière modification d'une session.
 */
function touchSession(sessionId: number): void {
  const statement = db.prepare(`
    UPDATE sessions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(sessionId);
}

/**
 * Crée une nouvelle session et inscrit automatiquement son créateur.
 *
 * L'insertion de la session et celle du membre hôte sont réalisées
 * dans une même transaction afin d'éviter toute session partiellement
 * créée.
 */
export function createSession(
  messageId: string,
  session: CreateSessionInput,
): GameSession | null {
  db.exec("BEGIN IMMEDIATE");

  try {
    const insertSession = db.prepare(`
        INSERT INTO sessions (
          message_id,
          guild_id,
          channel_id,

          game_id,
          game_name,
          game_emoji,

          when_text,
          description,

          creator_id,
          host_id,

          status
        )
        VALUES (
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          'active'
        )
      `);

    const result = insertSession.run(
      messageId,
      session.guildId,
      session.channelId,

      session.game.id,
      session.game.name,
      session.game.emoji ?? null,

      session.when,
      session.description ?? null,

      session.creatorId,
      session.creatorId,
    );

    const sessionId = Number(result.lastInsertRowid);

    const insertHost = db.prepare(`
        INSERT INTO session_members (
          session_id,
          user_id,
          status
        )
        VALUES (?, ?, 'joined')
      `);

    insertHost.run(sessionId, session.creatorId);

    db.exec("COMMIT");
  } catch (error: unknown) {
    db.exec("ROLLBACK");

    throw error;
  }

  return getSession(messageId);
}

/**
 * Retourne une session active à partir de son message Discord.
 */
export function getSession(messageId: string): GameSession | null {
  return hydrateSession(getSessionRow(messageId));
}

/**
 * Inscrit un utilisateur à une session.
 */
export function joinSession(
  messageId: string,
  userId: string,
): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  updateMemberStatus(session.id, userId, "joined");

  touchSession(session.id);

  return getSession(messageId);
}

/**
 * Place un utilisateur dans la catégorie « peut-être ».
 */
export function maybeSession(
  messageId: string,
  userId: string,
): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  updateMemberStatus(session.id, userId, "maybe");

  touchSession(session.id);

  return getSession(messageId);
}

/**
 * Retire un utilisateur des participants actifs d'une session.
 *
 * L'entrée est conservée en base avec le statut `left` afin de
 * préserver l'historique de participation.
 */
export function leaveSession(
  messageId: string,
  userId: string,
): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  updateMemberStatus(session.id, userId, "left");

  touchSession(session.id);

  return getSession(messageId);
}

/**
 * Transfère le rôle d'hôte à un autre utilisateur.
 *
 * Le nouvel hôte est automatiquement marqué comme participant.
 */
export function transferSessionHost(
  messageId: string,
  newHostId: string,
): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  updateMemberStatus(session.id, newHostId, "joined");

  const statement = db.prepare(`
    UPDATE sessions
    SET
      host_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(newHostId, session.id);

  return getSession(messageId);
}

/**
 * Met à jour la date/description textuelle d'une session.
 */
export function updateSessionDetails(
  messageId: string,
  { when, description }: UpdateSessionDetailsInput,
): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  const statement = db.prepare(`
    UPDATE sessions
    SET
      when_text = ?,
      description = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(when, description || null, session.id);

  return getSession(messageId);
}

/**
 * Remplace le jeu associé à une session.
 */
export function updateSessionGame(
  messageId: string,
  game: UpdateSessionGameInput,
): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  const statement = db.prepare(`
    UPDATE sessions
    SET
      game_id = ?,
      game_name = ?,
      game_emoji = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(game.id, game.name, game.emoji ?? null, session.id);

  return getSession(messageId);
}

/**
 * Annule une session active.
 *
 * Le comportement historique est conservé : l'objet retourné reçoit
 * immédiatement le nouveau statut, tandis que les autres timestamps
 * proviennent de l'objet chargé avant l'UPDATE.
 */
export function cancelSession(messageId: string): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  const statement = db.prepare(`
    UPDATE sessions
    SET
      status = 'cancelled',
      cancelled_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(session.id);

  return {
    ...session,
    status: "cancelled",
  };
}

/**
 * Marque une session active comme terminée.
 *
 * Comme pour l'annulation, le comportement historique du service
 * est volontairement conservé pendant la migration TypeScript.
 */
export function completeSession(messageId: string): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  const statement = db.prepare(`
    UPDATE sessions
    SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(session.id);

  return {
    ...session,
    status: "completed",
  };
}

/**
 * Retourne les dernières sessions connues d'un serveur Discord.
 *
 * La limite est bornée entre 1 et 20 afin d'éviter qu'une commande
 * puisse déclencher une lecture d'historique disproportionnée.
 */
export function getSessionHistory(
  guildId: string,
  limit = 10,
): SessionHistoryEntry[] {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 20));

  const statement = db.prepare(`
    SELECT
      s.*,

      (
        SELECT COUNT(*)
        FROM session_members AS sm
        WHERE sm.session_id = s.id
          AND sm.status = 'joined'
      ) AS joined_count,

      (
        SELECT COUNT(*)
        FROM session_members AS sm
        WHERE sm.session_id = s.id
          AND sm.status = 'maybe'
      ) AS maybe_count

    FROM sessions AS s

    WHERE s.guild_id = ?

    ORDER BY s.id DESC

    LIMIT ?
  `);

  const rows = statement.all(guildId, safeLimit) as SessionHistoryRow[];

  return rows.map((row) => ({
    id: row.id,

    game: {
      id: row.game_id,
      name: row.game_name,
      emoji: row.game_emoji,
    },

    when: row.when_text,
    description: row.description,

    creatorId: row.creator_id,
    hostId: row.host_id,

    status: row.status,

    joinedCount: Number(row.joined_count),

    maybeCount: Number(row.maybe_count),

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
  }));
}
