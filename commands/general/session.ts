import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

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

/**
 * Définition de la commande `/session`.
 *
 * Cette commande constitue le point d'entrée utilisateur
 * de la fonctionnalité de sessions de jeu.
 *
 * Sous-commandes disponibles :
 *
 * - `/session create` : crée une nouvelle session ;
 * - `/session history` : affiche les dernières sessions du serveur.
 */
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

/**
 * Fournit les suggestions de jeux disponibles à Discord.
 *
 * Seule l'option `jeu` utilise l'autocomplétion.
 * Discord accepte au maximum 25 suggestions ; cette limite est
 * déjà appliquée par `searchEnabledGames`.
 *
 * @param interaction Interaction d'autocomplétion reçue.
 */
export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name !== "jeu") {
    await interaction.respond([]);

    return;
  }

  const games = searchEnabledGames(String(focused.value));

  await interaction.respond(
    games.map((game) => ({
      name: `${game.emoji || "🎮"} ${game.name}`,
      value: game.id,
    })),
  );
}

/**
 * Crée une nouvelle session de jeu.
 *
 * Le message Discord est créé avant l'enregistrement SQLite
 * afin de pouvoir utiliser son identifiant comme référence
 * persistante de la session.
 */
async function createGameSession(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
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

  const participants = new Set<string>([interaction.user.id]);

  const maybes = new Set<string>();

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
    components: buildSessionButtons(),
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

/**
 * Affiche l'historique des sessions du serveur courant.
 */
async function showSessionHistory(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
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

/**
 * Exécute la sous-commande `/session` demandée.
 *
 * @param interaction Interaction Discord associée à la commande.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
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
