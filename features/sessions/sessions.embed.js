import { EmbedBuilder } from "discord.js";

function formatUsers(userIds) {
  if (!userIds || userIds.size === 0) {
    return "Personne";
  }

  return [...userIds].map((userId) => `<@${userId}>`).join("\n");
}

export function buildSessionEmbed({
  game,
  when,
  description,
  creatorId,
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
        value: `<@${creatorId}>`,
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
  creatorId,
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
        value: `<@${creatorId}>`,
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
