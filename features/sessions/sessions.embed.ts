import { EmbedBuilder } from "discord.js";

import type {
  GameSession,
  SessionHistoryEntry,
  SessionStatus,
} from "../../types/session.js";

export type SessionEmbedData = Pick<
  GameSession,
  | "game"
  | "when"
  | "scheduledAt"
  | "description"
  | "hostId"
  | "participants"
  | "maybes"
>;

export type CancelledSessionEmbedData = Pick<
  GameSession,
  "game" | "when" | "scheduledAt" | "description" | "hostId"
>;

export type CompletedSessionEmbedData = Pick<
  GameSession,
  "game" | "when" | "scheduledAt" | "description" | "hostId" | "participants"
>;

type StatusDisplay = {
  emoji: string;
  label: string;
};

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

function formatUsers(userIds: ReadonlySet<string>): string {
  if (userIds.size === 0) {
    return "Personne";
  }

  return [...userIds].map((userId) => `<@${userId}>`).join("\n");
}

/**
 * Affichage natif Discord du moment de la session.
 *
 * Discord adapte automatiquement l'heure au fuseau
 * de l'utilisateur qui regarde le message.
 */
function formatSessionWhen(
  scheduledAt: number | null,
  fallbackWhen: string,
): string {
  if (scheduledAt === null) {
    return fallbackWhen;
  }

  return [`<t:${scheduledAt}:F>`, `<t:${scheduledAt}:R>`].join("\n");
}

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

export function buildSessionEmbed({
  game,
  when,
  scheduledAt,
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
        value: formatSessionWhen(scheduledAt, when),
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

export function buildCancelledSessionEmbed({
  game,
  when,
  scheduledAt,
  description,
  hostId,
}: CancelledSessionEmbedData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`${game.emoji ?? "🎮"} Session annulée • ${game.name}`)
    .addFields(
      {
        name: "🕒 Prévue",
        value: formatSessionWhen(scheduledAt, when),
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

export function buildCompletedSessionEmbed({
  game,
  when,
  scheduledAt,
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
        value: formatSessionWhen(scheduledAt, when),
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
    const status = STATUS_DISPLAY[session.status];

    const createdTimestamp = sqliteDateToDiscordTimestamp(session.createdAt);

    const createdText = createdTimestamp
      ? `<t:${createdTimestamp}:R>`
      : "date inconnue";

    const game = `${session.game.emoji ?? "🎮"} ${session.game.name}`;

    const participantWord =
      session.joinedCount > 1 ? "participants" : "participant";

    const plannedText =
      session.scheduledAt !== null
        ? `<t:${session.scheduledAt}:F>`
        : session.when;

    return [
      `${status.emoji} **${game}**`,
      `└ ${status.label} • ${session.joinedCount} ${participantWord}`,
      `└ 🕒 ${plannedText}`,
      `└ 👑 <@${session.hostId}> • créée ${createdText}`,
    ].join("\n");
  });

  embed.setDescription(lines.join("\n\n"));

  return embed;
}
