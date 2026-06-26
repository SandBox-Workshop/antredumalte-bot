import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { queryVRising } from "../../services/vrising.service.js";

function formatBool(value) {
  if (value === "True" || value === true) return "Oui";
  if (value === "False" || value === false) return "Non";
  return value ?? "Inconnu";
}

function formatCastleHeartDamageMode(value) {
  const modes = {
    CanBeDestroyedByPlayers: "Destructible par les joueurs",
    CanBeSeizedOrDestroyedByPlayers: "Capturable ou destructible",
    OnlyDecay: "Seulement par décrépitude",
    Never: "Jamais",
  };

  return modes[value] ?? value ?? "Inconnu";
}

export const data = new SlashCommandBuilder()
  .setName("infos")
  .setDescription("Affiche les infos détaillées du serveur V Rising");

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const state = await queryVRising({
      requestPlayers: false,
      requestRules: true,
    });

    const rules = state.raw?.rules ?? {};

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle(`📜 Infos serveur — ${state.name}`)
      .setDescription(rules.desc0 ?? "Aucune description.")
      .addFields(
        {
          name: "📅 Jours serveur",
          value: rules["days-runningv2"] ?? "Inconnu",
          inline: true,
        },
        {
          name: "🩸 Blood Bound",
          value: formatBool(rules["blood-bound-enabled"]),
          inline: true,
        },
        {
          name: "🏰 Cœur de château",
          value: formatCastleHeartDamageMode(rules["castle-heart-damage-mode"]),
          inline: false,
        },
        {
          name: "🔐 Mot de passe",
          value: state.password ? "Oui" : "Non",
          inline: true,
        },
        {
          name: "👥 Slots",
          value: `${state.numplayers}/${state.maxplayers}`,
          inline: true,
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
      .setTitle("📜 Infos serveur")
      .setDescription("🔴 Impossible de récupérer les infos détaillées.")
      .addFields({
        name: "Erreur",
        value: `\`${error.message}\``,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
