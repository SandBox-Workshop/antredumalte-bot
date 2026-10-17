import { getGameById } from "./game.service.js";
import { db } from "./database.service.js";

import type {
  CreateSessionInput,
  GameSession,
  SessionCloseStatus,
  SessionGame,
  SessionHistoryEntry,
  SessionMemberStatus,
  SessionMutationFailureReason,
  SessionMutationResult,
  SessionStatus,
  UpdateSessionDetailsInput,
} from "../types/session.js";

type SessionRow = {
  id: number | bigint;

  message_id: string;
  guild_id: string;
  channel_id: string;

  game_id: string;

  scheduled_at: number | bigint;

  description: string | null;

  creator_id: string;
  host_id: string;

  role_id: string | null;

  status: SessionStatus;

  start_notified_at: number | bigint | null;
  closed_at: number | bigint | null;

  created_at: number | bigint;
  updated_at: number | bigint;
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

function sqliteIntegerToNumber(value: number | bigint): number;
function sqliteIntegerToNumber(value: number | bigint | null): number | null;
function sqliteIntegerToNumber(
  value: number | bigint | null,
): number | null {
  if (value === null) {
    return null;
  }

  return Number(value);
}

function resolveGame(gameId: string): SessionGame {
  const game = getGameById(gameId);

  if (game) {
    return {
      id: game.id,
      name: game.name,
      emoji: game.emoji ?? null,
    };
  }

  /*
   * Une session historique reste lisible même si l'entrée correspondante
   * a été retirée de games.json.
   */
  return {
    id: gameId,
    name: gameId,
    emoji: null,
  };
}

function mapSessionRow(row: SessionRow): SessionBase {
  return {
    id: sqliteIntegerToNumber(row.id),

    messageId: row.message_id,
    guildId: row.guild_id,
    channelId: row.channel_id,

    game: resolveGame(row.game_id),

    scheduledAt: sqliteIntegerToNumber(row.scheduled_at),

    description: row.description,

    creatorId: row.creator_id,
    hostId: row.host_id,

    roleId: row.role_id,

    status: row.status,

    startNotifiedAt: sqliteIntegerToNumber(row.start_notified_at),
    closedAt: sqliteIntegerToNumber(row.closed_at),

    createdAt: sqliteIntegerToNumber(row.created_at),
    updatedAt: sqliteIntegerToNumber(row.updated_at),
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

  const sessionId = sqliteIntegerToNumber(row.id);
  const members = getSessionMembers(sessionId);

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
      updated_at = unixepoch()
  `);

  statement.run(sessionId, userId, status);
}

function touchSession(sessionId: number): void {
  const statement = db.prepare(`
    UPDATE sessions
    SET updated_at = unixepoch()
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

        scheduled_at,
        description,

        creator_id,
        host_id,

        status
      )
      VALUES (
        ?, ?, ?,
        ?,
        ?, ?,
        ?, ?,
        'active'
      )
    `);

    const result = insertSession.run(
      messageId,
      session.guildId,
      session.channelId,

      session.gameId,

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
      updated_at = unixepoch()
    WHERE id = ?
  `);

  statement.run(newHostId, session.id);

  return mutationSuccess(getUpdatedActiveSession(messageId));
}

export function updateSessionDetails(
  messageId: string,
  actingUserId: string,
  { scheduledAt, description }: UpdateSessionDetailsInput,
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
      scheduled_at = ?,
      description = ?,
      updated_at = unixepoch()
    WHERE id = ?
  `);

  statement.run(scheduledAt, description || null, session.id);

  return mutationSuccess(getUpdatedActiveSession(messageId));
}

export function updateSessionGame(
  messageId: string,
  actingUserId: string,
  gameId: string,
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
      updated_at = unixepoch()
    WHERE id = ?
  `);

  statement.run(gameId, session.id);

  return mutationSuccess(getUpdatedActiveSession(messageId));
}

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
      closed_at = unixepoch(),
      updated_at = unixepoch()
    WHERE id = ?
  `);

  statement.run(status, session.id);

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

      scheduledAt: session.scheduledAt,

      description: session.description,

      creatorId: session.creatorId,
      hostId: session.hostId,

      roleId: session.roleId,

      status: session.status,

      startNotifiedAt: session.startNotifiedAt,
      closedAt: session.closedAt,

      joinedCount: Number(row.joined_count),
      maybeCount: Number(row.maybe_count),

      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  });
}
