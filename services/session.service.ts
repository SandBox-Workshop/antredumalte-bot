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

function sqliteIntegerToNumber(value: number | bigint | null): number | null {
  if (value === null) {
    return null;
  }

  return Number(value);
}

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

    scheduledAt: sqliteIntegerToNumber(row.scheduled_at),

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

export function updateSessionDetails(
  messageId: string,
  { when, scheduledAt, description }: UpdateSessionDetailsInput,
): GameSession | null {
  const session = getSession(messageId);

  if (!session) {
    return null;
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

  return getSession(messageId);
}

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

    scheduledAt: sqliteIntegerToNumber(row.scheduled_at),

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
