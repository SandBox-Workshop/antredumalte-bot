/**
 * États possibles d'une session de jeu.
 *
 * Ces valeurs correspondent directement à la contrainte `CHECK`
 * définie dans la table SQLite `sessions`.
 */
export type SessionStatus = "active" | "cancelled" | "completed" | "deleted";

/**
 * États possibles d'un membre au sein d'une session.
 *
 * Ces valeurs correspondent directement à la contrainte `CHECK`
 * définie dans la table SQLite `session_members`.
 */
export type SessionMemberStatus = "joined" | "maybe" | "left";

/**
 * Informations d'un jeu stockées avec une session.
 *
 * Le nom et l'emoji sont sauvegardés dans la base afin que
 * l'historique reste lisible même si le catalogue de jeux change.
 */
export type SessionGame = {
  id: string;
  name: string;
  emoji: string | null;
};

/**
 * Représentation complète d'une session active chargée depuis SQLite.
 */
export type GameSession = {
  id: number;

  messageId: string;
  guildId: string;
  channelId: string;

  game: SessionGame;

  when: string;
  description: string | null;

  creatorId: string;
  hostId: string;

  status: SessionStatus;

  /**
   * Utilisateurs ayant confirmé leur participation.
   */
  participants: Set<string>;

  /**
   * Utilisateurs ayant indiqué être potentiellement disponibles.
   */
  maybes: Set<string>;

  createdAt: string;
  updatedAt: string;

  cancelledAt: string | null;
  completedAt: string | null;
  deletedAt: string | null;
};

/**
 * Données nécessaires à la création d'une session.
 *
 * `messageId` n'est volontairement pas présent ici :
 * il est fourni séparément une fois le message Discord créé.
 */
export type CreateSessionInput = {
  guildId: string;
  channelId: string;

  game: {
    id: string;
    name: string;
    emoji?: string | null;
  };

  when: string;
  description?: string | null;

  creatorId: string;
};

/**
 * Données modifiables depuis le modal d'édition d'une session.
 */
export type UpdateSessionDetailsInput = {
  when: string;
  description?: string | null;
};

/**
 * Jeu pouvant remplacer celui d'une session existante.
 */
export type UpdateSessionGameInput = {
  id: string;
  name: string;
  emoji?: string | null;
};

/**
 * Entrée retournée dans l'historique des sessions.
 *
 * Contrairement à `GameSession`, l'historique ne charge pas
 * individuellement les membres : seuls les compteurs sont nécessaires.
 */
export type SessionHistoryEntry = {
  id: number;

  game: SessionGame;

  when: string;
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
