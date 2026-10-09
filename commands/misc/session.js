import { MessageFlags, SlashCommandBuilder } from "discord.js";

import {
  getGameById,
  searchEnabledGames,
} from "../../services/game.service.js";

import {
  createSession,
  getSessionHistory,
} from "../../services/session.service.js";

import {
  buildSessionEmbed,
  buildSessionHistoryEmbed,
} from "../../features/sessions/sessions.embed.js";

import { buildSessionButtons } from "../../features/sessions/sessions.buttons.js";

export const data = new SlashCommandBuilder()
  .setName("session")
  .setDescription("Gestion des sessions de jeu")

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
  )

  .addSubcommand((subcommand) =>
    subcommand
      .setName("history")
      .setDescription("Affiche l'historique des sessions")

      .addIntegerOption((option) =>
        option
          .setName("limite")
          .setDescription("Nombre de sessions à afficher")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20),
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

async function createGameSession(interaction) {
  if (!interaction.guildId || !interaction.channelId) {
    await interaction.reply({
      content: "❌ Les sessions doivent être créées dans un serveur Discord.",
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const participants = new Set([interaction.user.id]);

  const maybes = new Set();

  const embed = buildSessionEmbed({
    game,
    when,
    description,

    hostId: interaction.user.id,

    participants,
    maybes,
  });

  await interaction.reply({
    embeds: [embed],
    components: [buildSessionButtons()],
  });

  const message = await interaction.fetchReply();

  createSession(message.id, {
    guildId: interaction.guildId,

    channelId: interaction.channelId,

    game,
    when,
    description,

    creatorId: interaction.user.id,
  });
}

async function showSessionHistory(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content:
        "❌ L'historique est uniquement disponible dans un serveur Discord.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const limit = interaction.options.getInteger("limite") ?? 10;

  const sessions = getSessionHistory(interaction.guildId, limit);

  const embed = buildSessionHistoryEmbed(sessions);

  await interaction.reply({
    embeds: [embed],
  });
}

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "create":
      await createGameSession(interaction);
      return;

    case "history":
      await showSessionHistory(interaction);
      return;

    default:
      await interaction.reply({
        content: "❌ Sous-commande inconnue.",
        flags: MessageFlags.Ephemeral,
      });
  }
}
