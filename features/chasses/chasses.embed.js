import { EmbedBuilder } from "discord.js";

function groupByCastle(chasses) {
  return chasses.reduce((groups, chasse) => {
    const castle = chasse.chateau || "Sans château";

    if (!groups[castle]) {
      groups[castle] = [];
    }

    groups[castle].push(chasse);

    return groups;
  }, {});
}

function formatChasseLine(chasse) {
  const parts = [`• **${chasse.serviteur}**`];

  if (chasse.lieu) {
    parts.push(`→ ${chasse.lieu}`);
  }

  if (chasse.fin) {
    parts.push(`• Fin : ${chasse.fin}`);
  }

  if (chasse.note) {
    parts.push(`• ${chasse.note}`);
  }

  return parts.join(" ");
}

export function buildChassesEmbed(chasses) {
  const embed = new EmbedBuilder()
    .setColor(0x8b0000)
    .setTitle("🧛 Chasses serviteurs")
    .setFooter({
      text: "Antre du Malt • Google Sheets",
    })
    .setTimestamp();

  if (chasses.length === 0) {
    return embed.setDescription(
      "Aucun serviteur n'est actuellement en chasse.",
    );
  }

  embed.setDescription(
    `**${chasses.length}** serviteur(s) actuellement en chasse.`,
  );

  const grouped = groupByCastle(chasses);

  for (const [castle, castleChasses] of Object.entries(grouped)) {
    const value = castleChasses.map(formatChasseLine).join("\n");

    embed.addFields({
      name: `🏰 ${castle}`,
      value: value.slice(0, 1024),
      inline: false,
    });
  }

  return embed;
}
