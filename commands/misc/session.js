import { SlashCommandBuilder } from "discord.js";

import {
  getGameById,
  searchEnabledGames,
} from "../../services/game.service.js";

import { buildSessionEmbed } from "../../features/sessions/sessions.embed.js";
import { buildSessionButtons } from "../../features/sessions/sessions.buttons.js";
import { createSession } from "../../features/sessions/sessions.state.js";

export const data = new SlashCommandBuilder()
  .setName("session")
  .setDescription("Organise une session de jeu")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("Crée une nouvelle session")
      .addStringOption((option) =>
        option
          .setName("jeu")
          .setDescription("Jeu de la session")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("quand")
          .setDescription("Exemple : ce soir 21h, samedi 20h30...")
          .setRequired(true)
          .setMaxLength(100),
      )
      .addStringOption((option) =>
        option
          .setName("description")
          .setDescription("Petit message pour la session")
          .setRequired(false)
          .setMaxLength(500),
      ),
  );

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused(true);

  if (focused.name !== "jeu") {
    await interaction.respond([]);
    return;
  }

  const games = searchEnabledGames(focused.value);

  await interaction.respond(
    games.map((game) => ({
      name: `${game.emoji ?? "🎮"} ${game.name}`,
      value: game.id,
    })),
  );
}

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand !== "create") {
    await interaction.reply({
      content: "❌ Sous-commande inconnue.",
      flags: 64,
    });

    return;
  }

  const gameId = interaction.options.getString("jeu", true);
  const when = interaction.options.getString("quand", true);
  const description = interaction.options.getString("description");

  const game = getGameById(gameId);

  if (!game || !game.enabled) {
    await interaction.reply({
      content: "❌ Ce jeu n'est pas disponible pour créer une session.",
      flags: 64,
    });

    return;
  }

  const participants = new Set([interaction.user.id]);
  const maybes = new Set();

  const embed = buildSessionEmbed({
    game,
    when,
    description,
    creatorId: interaction.user.id,
    participants,
    maybes,
  });

  await interaction.reply({
    embeds: [embed],
    components: [buildSessionButtons()],
  });

  const message = await interaction.fetchReply();

  createSession(message.id, {
    game,
    when,
    description,
    creatorId: interaction.user.id,
  });
}
