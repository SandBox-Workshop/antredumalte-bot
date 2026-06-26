import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { queryVRising } from "../../services/vrising.service.js";

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "inconnu";

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Affiche le statut du serveur V Rising");

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const state = await queryVRising({
      requestPlayers: true,
      requestRules: false,
    });

    const connectedPlayers =
      state.players.length > 0
        ? state.players
            .map((player) => {
              const duration = formatDuration(player.raw?.time);
              return `🧛 **${player.name}** — connecté depuis ${duration}`;
            })
            .join("\n")
        : state.numplayers > 0
          ? "Joueur(s) connecté(s), mais noms indisponibles."
          : "Aucun joueur connecté.";

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle(`🩸 ${state.name}`)
      .setDescription("🟢 Serveur en ligne")
      .addFields(
        {
          name: "👥 Joueurs",
          value: `**${state.numplayers}/${state.maxplayers}**`,
          inline: true,
        },
        {
          name: "📡 Ping",
          value: `**${state.ping} ms**`,
          inline: true,
        },
        {
          name: "🔒 Mot de passe",
          value: state.password ? "Oui" : "Non",
          inline: true,
        },
        {
          name: "🧛 Joueurs connectés",
          value: connectedPlayers,
          inline: false,
        },
        {
          name: "🌍 Connexion",
          value: `\`${state.connect}\``,
          inline: false,
        },
      )
      .setFooter({
        text: "Antre du Malt • V Rising",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle("🩸 V Rising Server")
      .setDescription("🔴 Le serveur est hors ligne ou inaccessible.")
      .addFields({
        name: "Erreur",
        value: `\`${error.message}\``,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
