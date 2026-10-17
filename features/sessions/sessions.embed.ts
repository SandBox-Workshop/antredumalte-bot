import type {
  GameSession,
  SessionHistoryEntry,
  SessionStatus,
} from "../../types/session.js";
import { DISCORD_THEME } from "../../config/discord-theme.js";
import {
  createEmbed,
  gameLabel,
} from "../../utils/discord-presentation.js";
import { discordTimeUnix } from "../../utils/discord-time.js";

export type SessionEmbedData = Pick<
  GameSession,
  | "game"
  | "scheduledAt"
  | "description"
  | "hostId"
  | "status"
  | "participants"
  | "maybes"
>;

type StatusDisplay = {
  emoji: string;
  label: string;
  title: string;
  footer: string;
  color: number;
  whenField: string;
  hostField: string;
  endText: string | null;
  showParticipants: boolean;
  showMaybes: boolean;
};

const STATUS_DISPLAY: Record<SessionStatus, StatusDisplay> = {
  active: {
    emoji: "🟢",
    label: "Active",
    title: "Session",
    footer: "Session de jeu",
    color: DISCORD_THEME.colors.primary,
    whenField: "🕒 Quand",
    hostField: "👑 Hôte",
    endText: null,
    showParticipants: true,
    showMaybes: true,
  },

  cancelled: {
    emoji: "🚫",
    label: "Annulée",
    title: "Session annulée",
    footer: "Session annulée",
    color: DISCORD_THEME.colors.danger,
    whenField: "🕒 Prévue",
    hostField: "🚫 Annulée par",
    endText: "🚫 **Cette session a été annulée.**",
    showParticipants: false,
    showMaybes: false,
  },

  completed: {
    emoji: "✅",
    label: "Terminée",
    title: "Session terminée",
    footer: "Session terminée",
    color: DISCORD_THEME.colors.success,
    whenField: "🕒 Prévue",
    hostField: "👑 Hôte",
    endText: "✅ **Cette session est terminée.**",
    showParticipants: true,
    showMaybes: false,
  },
};

function formatUsers(userIds: ReadonlySet<string>): string {
  if (userIds.size === 0) {
    return "Personne";
  }

  return [...userIds].map((userId) => `<@${userId}>`).join("\n");
}

function formatSessionWhen(scheduledAt: number): string {
  return [
    discordTimeUnix(scheduledAt, "F"),
    discordTimeUnix(scheduledAt, "R"),
  ].join("\n");
}

/**
 * Construit l'embed d'une session quel que soit son statut.
 */
export function buildSessionEmbed(session: SessionEmbedData) {
  const display = STATUS_DISPLAY[session.status];
  const gameEmoji = session.game.emoji || "🎮";

  const embed = createEmbed({
    title: `${gameEmoji} ${display.title} • ${session.game.name}`,
    color: display.color,
    footer: display.footer,
  }).addFields(
    {
      name: display.whenField,
      value: formatSessionWhen(session.scheduledAt),
      inline: true,
    },
    {
      name: display.hostField,
      value: `<@${session.hostId}>`,
      inline: true,
    },
  );

  if (display.showParticipants) {
    embed.addFields({
      name: `✅ Participants (${session.participants.size})`,
      value: formatUsers(session.participants),
      inline: false,
    });
  }

  if (display.showMaybes) {
    embed.addFields({
      name: `🤔 Peut-être (${session.maybes.size})`,
      value: formatUsers(session.maybes),
      inline: false,
    });
  }

  const descriptionParts: string[] = [];

  if (session.description) {
    descriptionParts.push(session.description);
  }

  if (display.endText) {
    descriptionParts.push(display.endText);
  }

  if (descriptionParts.length > 0) {
    embed.setDescription(descriptionParts.join("\n\n"));
  }

  return embed;
}

export function buildSessionHistoryEmbed(
  sessions: SessionHistoryEntry[],
) {
  const embed = createEmbed({
    title: "📚 Historique des sessions",
    color: DISCORD_THEME.colors.primary,
    footer: "Historique",
  });

  if (sessions.length === 0) {
    embed.setDescription("Aucune session n'a encore été créée.");

    return embed;
  }

  const lines = sessions.map((session) => {
    const status = STATUS_DISPLAY[session.status];

    const participantWord =
      session.joinedCount > 1 ? "participants" : "participant";

    return [
      `${status.emoji} **${gameLabel(session.game)}**`,
      `└ ${status.label} • ${session.joinedCount} ${participantWord}`,
      `└ 🕒 ${discordTimeUnix(session.scheduledAt, "F")}`,
      `└ 👑 <@${session.hostId}> • créée ${discordTimeUnix(
        session.createdAt,
        "R",
      )}`,
    ].join("\n");
  });

  embed.setDescription(lines.join("\n\n"));

  return embed;
}
