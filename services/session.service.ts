import { db } from "./database.service.js";

import type {
  CreateSessionInput,
  GameSession,
  SessionCloseStatus,
  SessionHistoryEntry,
  SessionMemberStatus,
  SessionMutationFailureReason,
  SessionMutationResult,
  SessionStatus,
  UpdateSessionDetailsInput,
  UpdateSessionGameInput,
} from "../types/session.js";

type SessionRow = {
  id: number;

  message_id: string;
  guild_id: string;
  channel_id: string;

  game_id: string;
  game_name: string;
  game_emoji: string | null;

  when_text: string;
  scheduled_at: number | bigint | null;

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

type SessionMemberRow = {
  user_id: string;
  status: SessionMemberStatus;
};

type SessionHistoryRow = SessionRow & {
  joined_count: number | bigint;
  maybe_count: number | bigint;
};

type SessionBase = Omit<GameSession, "participants" | "maybes">;

function sqliteIntegerToNumber(value: number | bigint | null): number | null {
  if (value === null) {
    return null;
  }

  return Number(value);
}

function mapGame(row: SessionRow): GameSession["game"] {
  return {
    id: row.game_id,
    name: row.game_name,
    emoji: row.game_emoji,
  };
}

function mapSessionRow(row: SessionRow): SessionBase {
  return {
    id: row.id,

    messageId: row.message_id,
    guildId: row.guild_id,
    channelId: row.channel_id,

    game: mapGame(row),

    when: row.when_text,
    scheduledAt: sqliteIntegerToNumber(row.scheduled_at),

    description: row.description,

    creatorId: row.creator_id,
    hostId: row.host_id,

    status: row.status,

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
  };
}

function getSessionRow(
  messageId: string,
  activeOnly = true,
): SessionRow | null {
  const statement = db.prepare(
    activeOnly
      ? `
          SELECT *
          FROM sessions
          WHERE message_id = ?
            AND status = 'active'
          LIMIT 1
        `
      : `
          SELECT *
          FROM sessions
          WHERE message_id = ?
          LIMIT 1
        `,
  );

  const row = statement.get(messageId) as SessionRow | undefined;

  return row ?? null;
}

function getSessionMembers(sessionId: number): SessionMemberRow[] {
  const statement = db.prepare(`
    SELECT user_id, status
    FROM session_members
    WHERE session_id = ?
  `);

  return statement.all(sessionId) as SessionMemberRow[];
}

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
    ...mapSessionRow(row),
    participants,
    maybes,
  };
}

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

function touchSession(sessionId: number): void {
  const statement = db.prepare(`
    UPDATE sessions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(sessionId);
}

function mutationFailure(
  reason: SessionMutationFailureReason,
): SessionMutationResult {
  return {
    ok: false,
    reason,
  };
}

function mutationSuccess(session: GameSession): SessionMutationResult {
  return {
    ok: true,
    session,
  };
}

function getUpdatedActiveSession(messageId: string): GameSession {
  const session = getSession(messageId);

  if (!session) {
    throw new Error(
      `Session active introuvable après mise à jour : ${messageId}.`,
    );
  }

  return session;
}

function getUpdatedSession(messageId: string): GameSession {
  const session = hydrateSession(getSessionRow(messageId, false));

  if (!session) {
    throw new Error(`Session introuvable après mise à jour : ${messageId}.`);
  }

  return session;
}

function requireHost(
  session: GameSession,
  userId: string,
): SessionMutationResult | null {
  if (session.hostId !== userId) {
    return mutationFailure("not_host");
  }

  return null;
}

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
        scheduled_at,
        description,

        creator_id,
        host_id,

        status
      )
      VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
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
      session.scheduledAt,
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

export function getSession(messageId: string): GameSession | null {
  return hydrateSession(getSessionRow(messageId));
}

/**
 * Modifie l'état de participation d'un membre.
 *
 * La règle interdisant à l'hôte de quitter ou passer en "peut-être"
 * vit ici afin qu'elle s'applique à tous les futurs appelants du service.
 */
export function setMemberStatus(
  messageId: string,
  userId: string,
  status: SessionMemberStatus,
): SessionMutationResult {
  const session = getSession(messageId);

  if (!session) {
    return mutationFailure("session_not_found");
  }

  if (session.hostId === userId) {
    if (status === "left") {
      return mutationFailure("host_cannot_leave");
    }

    if (status === "maybe") {
      return mutationFailure("host_cannot_maybe");
    }
  }

  updateMemberStatus(session.id, userId, status);
  touchSession(session.id);

  return mutationSuccess(getUpdatedActiveSession(messageId));
}

export function transferSessionHost(
  messageId: string,
  actingUserId: string,
  newHostId: string,
): SessionMutationResult {
  const session = getSession(messageId);

  if (!session) {
    return mutationFailure("session_not_found");
  }

  const hostFailure = requireHost(session, actingUserId);

  if (hostFailure) {
    return hostFailure;
  }

  if (newHostId === session.hostId) {
    return mutationFailure("new_host_is_current_host");
  }

  if (!session.participants.has(newHostId)) {
    return mutationFailure("new_host_must_be_participant");
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

  return mutationSuccess(getUpdatedActiveSession(messageId));
}

export function updateSessionDetails(
  messageId: string,
  actingUserId: string,
  { when, scheduledAt, description }: UpdateSessionDetailsInput,
): SessionMutationResult {
  const session = getSession(messageId);

  if (!session) {
    return mutationFailure("session_not_found");
  }

  const hostFailure = requireHost(session, actingUserId);

  if (hostFailure) {
    return hostFailure;
  }

  const statement = db.prepare(`
    UPDATE sessions
    SET
      when_text = ?,
      scheduled_at = ?,
      description = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(when, scheduledAt, description || null, session.id);

  return mutationSuccess(getUpdatedActiveSession(messageId));
}

export function updateSessionGame(
  messageId: string,
  actingUserId: string,
  game: UpdateSessionGameInput,
): SessionMutationResult {
  const session = getSession(messageId);

  if (!session) {
    return mutationFailure("session_not_found");
  }

  const hostFailure = requireHost(session, actingUserId);

  if (hostFailure) {
    return hostFailure;
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

  return mutationSuccess(getUpdatedActiveSession(messageId));
}

/**
 * Clôt une session active.
 *
 * Seul l'hôte courant peut effectuer cette mutation.
 */
export function closeSession(
  messageId: string,
  actingUserId: string,
  status: SessionCloseStatus,
): SessionMutationResult {
  const session = getSession(messageId);

  if (!session) {
    return mutationFailure("session_not_found");
  }

  const hostFailure = requireHost(session, actingUserId);

  if (hostFailure) {
    return hostFailure;
  }

  const statement = db.prepare(`
    UPDATE sessions
    SET
      status = ?,
      cancelled_at = CASE
        WHEN ? = 'cancelled' THEN CURRENT_TIMESTAMP
        ELSE cancelled_at
      END,
      completed_at = CASE
        WHEN ? = 'completed' THEN CURRENT_TIMESTAMP
        ELSE completed_at
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statement.run(status, status, status, session.id);

  return mutationSuccess(getUpdatedSession(messageId));
}

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

  return rows.map((row) => {
    const session = mapSessionRow(row);

    return {
      id: session.id,

      game: session.game,

      when: session.when,
      scheduledAt: session.scheduledAt,

      description: session.description,

      creatorId: session.creatorId,
      hostId: session.hostId,

      status: session.status,

      joinedCount: Number(row.joined_count),
      maybeCount: Number(row.maybe_count),

      createdAt: session.createdAt,
      updatedAt: session.updatedAt,

      cancelledAt: session.cancelledAt,
      completedAt: session.completedAt,
      deletedAt: session.deletedAt,
    };
  });
}
