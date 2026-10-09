import { EmbedBuilder } from "discord.js";

function formatUsers(userIds) {
  if (!userIds || userIds.size === 0) {
    return "Personne";
  }

  return [...userIds].map((userId) => `<@${userId}>`).join("\n");
}

function getStatusDisplay(status) {
  switch (status) {
    case "active":
      return {
        emoji: "🟢",
        label: "Active",
      };

    case "cancelled":
      return {
        emoji: "🚫",
        label: "Annulée",
      };

    case "completed":
      return {
        emoji: "✅",
        label: "Terminée",
      };

    case "deleted":
      return {
        emoji: "🗑️",
        label: "Supprimée",
      };

    default:
      return {
        emoji: "❓",
        label: status,
      };
  }
}

function sqliteDateToDiscordTimestamp(value) {
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
  description,
  hostId,
  participants,
  maybes,
}) {
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
        name: `✅ Participants (${participants?.size ?? 0})`,
        value: formatUsers(participants),
        inline: false,
      },
      {
        name: `🤔 Peut-être (${maybes?.size ?? 0})`,
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
  description,
  hostId,
}) {
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

export function buildSessionHistoryEmbed(sessions) {
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
