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

import {
  addSessionRoleToMember,
  createSessionRole,
  deleteSessionRoleById,
} from "../../features/sessions/sessions.roles.js";

import { gameLabel } from "../../utils/discord-presentation.js";
import { resolveSessionSchedule } from "../../utils/session-date.js";

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
          .setName("date")
          .setDescription("Date au format JJ/MM/AAAA")
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(10),
      )

      .addStringOption((option) =>
        option
          .setName("heure")
          .setDescription("Heure au format HH:MM")
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(5),
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
      name: gameLabel(game),
      value: game.id,
    })),
  );
}

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
  const date = interaction.options.getString("date", true);
  const time = interaction.options.getString("heure", true);
  const description = interaction.options.getString("description");

  const game = getGameById(gameId);

  if (!game || !game.enabled) {
    await interaction.reply({
      content: "❌ Ce jeu n'est pas disponible pour créer une session.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const schedule = resolveSessionSchedule(date, time);

  if (!schedule.ok) {
    await interaction.reply({
      content: schedule.message,
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const { scheduledAt } = schedule;

  const participants = new Set<string>([interaction.user.id]);
  const maybes = new Set<string>();

  const embed = buildSessionEmbed({
    game,
    scheduledAt,
    description,

    hostId: interaction.user.id,

    status: "active",

    participants,
    maybes,
  });

  await interaction.reply({
    embeds: [embed],
    components: buildSessionButtons(),
  });

  const message = await interaction.fetchReply();

  let roleId: string | null = null;

  try {
    const role = await createSessionRole(
      interaction.client,
      interaction.guildId,
      game.name,
      message.id,
    );

    roleId = role.id;

    await addSessionRoleToMember(
      interaction.client,
      interaction.guildId,
      role.id,
      interaction.user.id,
    );

    const createdSession = createSession(message.id, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,

      gameId: game.id,
      roleId: role.id,

      scheduledAt,
      description,

      creatorId: interaction.user.id,
    });

    if (!createdSession) {
      throw new Error("La session n'a pas pu être relue après sa création.");
    }
  } catch (error: unknown) {
    console.error("[sessions] Impossible de créer la session.", error);

    if (roleId) {
      try {
        await deleteSessionRoleById(
          interaction.client,
          interaction.guildId,
          roleId,
          `Échec de création de la session ${message.id}`,
        );
      } catch (roleDeleteError: unknown) {
        console.error(
          "[sessions] Impossible de supprimer le rôle après l'échec de création.",
          roleDeleteError,
        );
      }
    }

    try {
      await message.delete();
    } catch (deleteError: unknown) {
      console.error(
        "[sessions] Impossible de supprimer le message après l'échec de création.",
        deleteError,
      );

      try {
        await message.edit({
          content:
            "❌ Cette session n'a pas pu être créée et n'est pas active.",
          embeds: [],
          components: [],
        });
      } catch (editError: unknown) {
        console.error(
          "[sessions] Impossible de neutraliser le message de session.",
          editError,
        );
      }
    }

    await interaction.followUp({
      content:
        "❌ Impossible de créer la session ou son rôle temporaire. Vérifie notamment que le bot peut gérer les rôles.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

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
