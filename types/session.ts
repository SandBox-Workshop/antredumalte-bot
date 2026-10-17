export type SessionStatus = "active" | "cancelled" | "completed";

export type SessionCloseStatus = "cancelled" | "completed";

export type SessionMemberStatus = "joined" | "maybe" | "left";

export type SessionGame = {
  id: string;
  name: string;
  emoji: string | null;
};

/**
 * Représentation complète d'une session de jeu.
 *
 * Les informations d'affichage du jeu sont résolues depuis `games.json`.
 * SQLite ne conserve que `game_id`.
 */
export type GameSession = {
  id: number;

  messageId: string;
  guildId: string;
  channelId: string;

  game: SessionGame;

  /**
   * Date réelle de la session au format Unix, en secondes.
   */
  scheduledAt: number;

  description: string | null;

  creatorId: string;
  hostId: string;

  /**
   * Rôle Discord temporaire associé à la session.
   *
   * `null` tant que la feature de rôle temporaire ne l'a pas créé.
   */
  roleId: string | null;

  status: SessionStatus;

  /**
   * Timestamp Unix du message de début, ou `null` si pas encore envoyé.
   */
  startNotifiedAt: number | null;

  /**
   * Timestamp Unix de clôture, ou `null` tant que la session est active.
   */
  closedAt: number | null;

  participants: Set<string>;
  maybes: Set<string>;

  createdAt: number;
  updatedAt: number;
};

export type CreateSessionInput = {
  guildId: string;
  channelId: string;

  /**
   * Identifiant du jeu.
   *
   * Sa valeur correspond au GameDig type utilisé dans `games.json`.
   */
  gameId: string;

  scheduledAt: number;
  description?: string | null;

  creatorId: string;
};

export type UpdateSessionDetailsInput = {
  scheduledAt: number;
  description?: string | null;
};

export type SessionHistoryEntry = {
  id: number;

  game: SessionGame;

  scheduledAt: number;

  description: string | null;

  creatorId: string;
  hostId: string;

  roleId: string | null;

  status: SessionStatus;

  startNotifiedAt: number | null;
  closedAt: number | null;

  joinedCount: number;
  maybeCount: number;

  createdAt: number;
  updatedAt: number;
};

/**
 * Raisons métier pouvant empêcher une modification de session.
 */
export type SessionMutationFailureReason =
  | "session_not_found"
  | "not_host"
  | "host_cannot_leave"
  | "host_cannot_maybe"
  | "new_host_is_current_host"
  | "new_host_must_be_participant";

export type SessionMutationResult =
  | {
      ok: true;
      session: GameSession;
    }
  | {
      ok: false;
      reason: SessionMutationFailureReason;
    };
