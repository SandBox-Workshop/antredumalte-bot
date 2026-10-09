import { EmbedBuilder } from "discord.js";

import type {
  GameSession,
  SessionHistoryEntry,
  SessionStatus,
} from "../../types/session.js";

/**
 * Données nécessaires à l'affichage d'une session active.
 *
 * Le type utilise uniquement les propriétés réellement consommées
 * par l'embed afin de pouvoir construire celui-ci aussi bien depuis
 * une session persistée que depuis une structure compatible.
 */
export type SessionEmbedData = Pick<
  GameSession,
  "game" | "when" | "description" | "hostId" | "participants" | "maybes"
>;

/**
 * Données nécessaires à l'affichage d'une session annulée.
 */
export type CancelledSessionEmbedData = Pick<
  GameSession,
  "game" | "when" | "description" | "hostId"
>;

/**
 * Données nécessaires à l'affichage d'une session terminée.
 */
export type CompletedSessionEmbedData = Pick<
  GameSession,
  "game" | "when" | "description" | "hostId" | "participants"
>;

type StatusDisplay = {
  emoji: string;
  label: string;
};

/**
 * Représentation visuelle de chaque statut de session.
 *
 * L'utilisation d'un `Record<SessionStatus, ...>` garantit que
 * TypeScript signalera immédiatement l'ajout futur d'un statut
 * qui n'aurait pas encore de représentation dans l'historique.
 */
const STATUS_DISPLAY: Record<SessionStatus, StatusDisplay> = {
  active: {
    emoji: "🟢",
    label: "Active",
  },

  cancelled: {
    emoji: "🚫",
    label: "Annulée",
  },

  completed: {
    emoji: "✅",
    label: "Terminée",
  },

  deleted: {
    emoji: "🗑️",
    label: "Supprimée",
  },
};

/**
 * Formate un ensemble d'identifiants Discord sous forme
 * de mentions affichables dans un embed.
 */
function formatUsers(userIds: ReadonlySet<string>): string {
  if (userIds.size === 0) {
    return "Personne";
  }

  return [...userIds].map((userId) => `<@${userId}>`).join("\n");
}

/**
 * Retourne les informations d'affichage associées
 * au statut d'une session.
 */
function getStatusDisplay(status: SessionStatus): StatusDisplay {
  return STATUS_DISPLAY[status];
}

/**
 * Convertit une date SQLite UTC en timestamp Unix Discord.
 *
 * SQLite produit ici des dates au format :
 *
 * `YYYY-MM-DD HH:MM:SS`
 *
 * Le suffixe `Z` indique explicitement à JavaScript que la date
 * doit être interprétée comme UTC.
 *
 * @returns Timestamp Unix en secondes ou `null` si la date est invalide.
 */
function sqliteDateToDiscordTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value.replace(" ", "T")}Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.floor(date.getTime() / 1000);
}

/**
 * Construit l'embed principal d'une session active.
 */
export function buildSessionEmbed({
  game,
  when,
  description,
  hostId,
  participants,
  maybes,
}: SessionEmbedData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${game.emoji ?? "🎮"} Session • ${game.name}`)
    .addFields(
      {
        name: "🕒 Quand",
        value: when,
        inline: true,
      },
      {
        name: "👑 Hôte",
        value: `<@${hostId}>`,
        inline: true,
      },
      {
        name: `✅ Participants (${participants.size})`,
        value: formatUsers(participants),
        inline: false,
      },
      {
        name: `🤔 Peut-être (${maybes.size})`,
        value: formatUsers(maybes),
        inline: false,
      },
    )
    .setFooter({
      text: "YOLO • Session de jeu",
    })
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Construit l'embed final d'une session annulée.
 */
export function buildCancelledSessionEmbed({
  game,
  when,
  description,
  hostId,
}: CancelledSessionEmbedData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`${game.emoji ?? "🎮"} Session annulée • ${game.name}`)
    .addFields(
      {
        name: "🕒 Prévue",
        value: when,
        inline: true,
      },
      {
        name: "🚫 Annulée par",
        value: `<@${hostId}>`,
        inline: true,
      },
    )
    .setFooter({
      text: "YOLO • Session annulée",
    })
    .setTimestamp();

  if (description) {
    embed.setDescription(
      `${description}\n\n🚫 **Cette session a été annulée.**`,
    );
  } else {
    embed.setDescription("🚫 **Cette session a été annulée.**");
  }

  return embed;
}

/**
 * Construit l'embed final d'une session terminée.
 */
export function buildCompletedSessionEmbed({
  game,
  when,
  description,
  hostId,
  participants,
}: CompletedSessionEmbedData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`${game.emoji ?? "🎮"} Session terminée • ${game.name}`)
    .addFields(
      {
        name: "🕒 Prévue",
        value: when,
        inline: true,
      },
      {
        name: "👑 Hôte",
        value: `<@${hostId}>`,
        inline: true,
      },
      {
        name: `✅ Participants (${participants.size})`,
        value: formatUsers(participants),
        inline: false,
      },
    )
    .setFooter({
      text: "YOLO • Session terminée",
    })
    .setTimestamp();

  if (description) {
    embed.setDescription(
      `${description}\n\n✅ **Cette session est terminée.**`,
    );
  } else {
    embed.setDescription("✅ **Cette session est terminée.**");
  }

  return embed;
}

/**
 * Construit l'historique des dernières sessions d'un serveur.
 */
export function buildSessionHistoryEmbed(
  sessions: SessionHistoryEntry[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📚 Historique des sessions")
    .setFooter({
      text: "YOLO • Historique",
    })
    .setTimestamp();

  if (sessions.length === 0) {
    embed.setDescription("Aucune session n'a encore été créée.");

    return embed;
  }

  const lines = sessions.map((session) => {
    const status = getStatusDisplay(session.status);

    const createdTimestamp = sqliteDateToDiscordTimestamp(session.createdAt);

    const createdText = createdTimestamp
      ? `<t:${createdTimestamp}:R>`
      : "date inconnue";

    const game = `${session.game.emoji ?? "🎮"} ${session.game.name}`;

    const participantWord =
      session.joinedCount > 1 ? "participants" : "participant";

    return [
      `${status.emoji} **${game}**`,
      `└ ${status.label} • ${session.joinedCount} ${participantWord}`,
      `└ 🕒 ${session.when}`,
      `└ 👑 <@${session.hostId}> • créée ${createdText}`,
    ].join("\n");
  });

  embed.setDescription(lines.join("\n\n"));

  return embed;
}
