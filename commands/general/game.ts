import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { addGame } from "../../services/game.service.js";

export const data = new SlashCommandBuilder()
  .setName("game")
  .setDescription("Gestion du catalogue de jeux")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Ajoute un jeu au catalogue")
      .addStringOption((option) =>
        option
          .setName("nom")
          .setDescription("Nom du jeu")
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(100),
      )
      .addStringOption((option) =>
        option
          .setName("emoji")
          .setDescription("Emoji affiché pour le jeu")
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(100),
      ),
  );

async function addGameCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "❌ Cette commande doit être utilisée dans un serveur.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content:
        "❌ Tu dois avoir la permission **Gérer le serveur** pour ajouter un jeu.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const name = interaction.options.getString("nom", true);
  const emoji = interaction.options.getString("emoji", true);

  try {
    const result = addGame(name, emoji);

    if (!result.ok) {
      if (result.reason === "duplicate-name") {
        await interaction.reply({
          content:
            `ℹ️ **${result.game.name}** existe déjà dans le catalogue ` +
            `avec l'ID \`${result.game.id}\`.`,
          flags: MessageFlags.Ephemeral,
        });

        return;
      }

      await interaction.reply({
        content:
          `❌ L'ID technique \`${result.game.id}\` est déjà utilisé ` +
          `par **${result.game.name}**.`,
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    const sourceText =
      result.idSource === "gamedig"
        ? "ID GameDig détecté automatiquement"
        : "jeu non trouvé dans GameDig, ID généré automatiquement";

    await interaction.reply({
      content: [
        `✅ ${result.game.emoji} **${result.game.name}** ajouté au catalogue.`,
        `🆔 \`${result.game.id}\` — ${sourceText}.`,
        "🟢 Le jeu est activé et utilisable immédiatement dans les sessions.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    console.error("[games] Impossible d'ajouter le jeu au catalogue.", error);

    await interaction.reply({
      content: "❌ Impossible d'ajouter ce jeu au catalogue.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "add":
      await addGameCommand(interaction);
      return;

    default:
      await interaction.reply({
        content: "❌ Sous-commande inconnue.",
        flags: MessageFlags.Ephemeral,
      });
  }
}
