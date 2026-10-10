export type SessionStatus = "active" | "cancelled" | "completed" | "deleted";

export type SessionMemberStatus = "joined" | "maybe" | "left";

export type SessionGame = {
  id: string;
  name: string;
  emoji: string | null;
};

/**
 * Représentation complète d'une session de jeu.
 */
export type GameSession = {
  id: number;

  messageId: string;
  guildId: string;
  channelId: string;

  game: SessionGame;

  /**
   * Ancienne valeur textuelle conservée
   * pour compatibilité.
   */
  when: string;

  /**
   * Date réelle de la session au format Unix.
   *
   * `null` pour les anciennes sessions.
   */
  scheduledAt: number | null;

  description: string | null;

  creatorId: string;
  hostId: string;

  status: SessionStatus;

  participants: Set<string>;
  maybes: Set<string>;

  createdAt: string;
  updatedAt: string;

  cancelledAt: string | null;
  completedAt: string | null;
  deletedAt: string | null;
};

export type CreateSessionInput = {
  guildId: string;
  channelId: string;

  game: {
    id: string;
    name: string;
    emoji?: string | null;
  };

  when: string;

  scheduledAt: number;

  description?: string | null;

  creatorId: string;
};

export type UpdateSessionDetailsInput = {
  when: string;
  scheduledAt: number;
  description?: string | null;
};

export type UpdateSessionGameInput = {
  id: string;
  name: string;
  emoji?: string | null;
};

export type SessionHistoryEntry = {
  id: number;

  game: SessionGame;

  when: string;
  scheduledAt: number | null;

  description: string | null;

  creatorId: string;
  hostId: string;

  status: SessionStatus;

  joinedCount: number;
  maybeCount: number;

  createdAt: string;
  updatedAt: string;

  cancelledAt: string | null;
  completedAt: string | null;
  deletedAt: string | null;
};
