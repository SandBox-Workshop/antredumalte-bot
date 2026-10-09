import {
  ActionRowBuilder,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ModalSubmitInteraction,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  type UserSelectMenuInteraction,
  UserSelectMenuBuilder,
} from "discord.js";

import { getEnabledGames, getGameById } from "../../services/game.service.js";

import {
  cancelSession,
  completeSession,
  getSession,
  joinSession,
  leaveSession,
  maybeSession,
  transferSessionHost,
  updateSessionDetails,
  updateSessionGame,
} from "../../services/session.service.js";

import type { GameSession } from "../../types/session.js";

import {
  buildCancelledSessionEmbed,
  buildCompletedSessionEmbed,
  buildSessionEmbed,
} from "./sessions.embed.js";

/**
 * Préfixes utilisés par les composants interactifs
 * de la feature sessions.
 */
const SESSION_PREFIX = "session:";
const TRANSFER_PREFIX = "session:transfer:";
const GAME_PREFIX = "session:game:";
const EDIT_PREFIX = "session:edit:";

/**
 * Garantit qu'une opération censée retourner une session
 * a effectivement produit une session valide.
 *
 * Lorsqu'une session existait immédiatement avant l'opération,
 * un résultat `null` représente un état inattendu. Lever une erreur
 * permet au gestionnaire global d'interactions de traiter proprement
 * cette situation plutôt que de transmettre `null` à un embed.
 */
function requireSession(
  session: GameSession | null,
  operation: string,
): GameSession {
  if (!session) {
    throw new Error(`Session introuvable après ${operation}.`);
  }

  return session;
}

/**
 * Extrait la partie variable d'un `customId`.
 *
 * @example
 * `session:game:123` avec `session:game:` retourne `123`.
 */
function getCustomIdValue(customId: string, prefix: string): string | null {
  if (!customId.startsWith(prefix)) {
    return null;
  }

  const value = customId.slice(prefix.length).trim();

  return value || null;
}

/**
 * Construit les boutons permanents affichés sous une session active.
 */
export function buildSessionButtons(): [
  ActionRowBuilder<ButtonBuilder>,
  ActionRowBuilder<ButtonBuilder>,
] {
  const participationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("session:join")
      .setLabel("Rejoindre")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("session:maybe")
      .setLabel("Peut-être")
      .setEmoji("🤔")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("session:leave")
      .setLabel("Quitter")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary),
  );

  const managementRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("session:edit")
      .setLabel("Modifier")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("session:game")
      .setLabel("Changer le jeu")
      .setEmoji("🎮")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("session:transfer")
      .setLabel("Changer d'hôte")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("session:complete")
      .setLabel("Terminer")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("session:cancel")
      .setLabel("Annuler")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),
  );

  return [participationRow, managementRow];
}

/**
 * Construit le menu permettant à l'hôte
 * de transférer sa session.
 */
function buildHostSelect(
  messageId: string,
): ActionRowBuilder<UserSelectMenuBuilder> {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`${TRANSFER_PREFIX}${messageId}`)
      .setPlaceholder("Choisir le nouvel hôte")
      .setMinValues(1)
      .setMaxValues(1),
  );
}

/**
 * Construit le menu de changement de jeu.
 *
 * Discord limite les menus de sélection à 25 options.
 */
function buildGameSelect(
  messageId: string,
  currentGameId: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = getEnabledGames()
    .slice(0, 25)
    .map((game) => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(game.name)
        .setValue(game.id)
        .setDefault(game.id === currentGameId);

      if (game.emoji) {
        option.setEmoji(game.emoji);
      }

      return option;
    });

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${GAME_PREFIX}${messageId}`)
      .setPlaceholder("Choisir un jeu")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options),
  );
}

/**
 * Construit le modal d'édition d'une session.
 */
function buildEditModal(session: GameSession): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${EDIT_PREFIX}${session.messageId}`)
    .setTitle("Modifier la session");

  const whenInput = new TextInputBuilder()
    .setCustomId("when")
    .setLabel("Quand ?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100)
    .setValue(session.when);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  if (session.description) {
    descriptionInput.setValue(session.description);
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(whenInput),

    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
  );

  return modal;
}

/**
 * Traite les boutons permanents d'une session.
 *
 * @returns `true` lorsque le bouton appartient à la feature sessions.
 */
export async function handleSessionButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith(SESSION_PREFIX)) {
    return false;
  }

  const messageId = interaction.message.id;

  const userId = interaction.user.id;

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.reply({
      content: "❌ Cette session n'existe plus ou n'est plus active.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const action = interaction.customId
    .slice(SESSION_PREFIX.length)
    .split(":")[0];

  if (
    userId === currentSession.hostId &&
    (action === "leave" || action === "maybe")
  ) {
    await interaction.reply({
      content:
        "👑 Tu es l'hôte de cette session. Transfère d'abord l'hôte ou annule la session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  switch (action) {
    case "join": {
      const session = requireSession(
        joinSession(messageId, userId),
        "l'inscription",
      );

      await interaction.update({
        embeds: [buildSessionEmbed(session)],
        components: buildSessionButtons(),
      });

      return true;
    }

    case "maybe": {
      const session = requireSession(
        maybeSession(messageId, userId),
        "la mise en attente",
      );

      await interaction.update({
        embeds: [buildSessionEmbed(session)],
        components: buildSessionButtons(),
      });

      return true;
    }

    case "leave": {
      const session = requireSession(
        leaveSession(messageId, userId),
        "le départ du participant",
      );

      await interaction.update({
        embeds: [buildSessionEmbed(session)],
        components: buildSessionButtons(),
      });

      return true;
    }

    case "edit": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut modifier cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      await interaction.showModal(buildEditModal(currentSession));

      return true;
    }

    case "game": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut changer le jeu.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      const games = getEnabledGames();

      if (games.length === 0) {
        await interaction.reply({
          content: "❌ Aucun jeu actif n'est disponible.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      await interaction.reply({
        content: "🎮 Choisis le nouveau jeu de la session :",
        components: [buildGameSelect(messageId, currentSession.game.id)],
        flags: MessageFlags.Ephemeral,
      });

      return true;
    }

    case "transfer": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut transférer la session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      if (currentSession.participants.size <= 1) {
        await interaction.reply({
          content:
            "❌ Il faut au moins un autre participant avant de pouvoir transférer l'hôte.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      await interaction.reply({
        content: "👑 Choisis le participant qui deviendra le nouvel hôte :",
        components: [buildHostSelect(messageId)],
        flags: MessageFlags.Ephemeral,
      });

      return true;
    }

    case "complete": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut terminer cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      const completedSession = requireSession(
        completeSession(messageId),
        "la clôture",
      );

      await interaction.update({
        embeds: [buildCompletedSessionEmbed(completedSession)],
        components: [],
      });

      return true;
    }

    case "cancel": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut annuler cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      const cancelledSession = requireSession(
        cancelSession(messageId),
        "l'annulation",
      );

      await interaction.update({
        embeds: [buildCancelledSessionEmbed(cancelledSession)],
        components: [],
      });

      return true;
    }

    default:
      return false;
  }
}

/**
 * Traite le menu de transfert d'hôte.
 */
export async function handleSessionHostSelect(
  interaction: UserSelectMenuInteraction,
): Promise<boolean> {
  const messageId = getCustomIdValue(interaction.customId, TRANSFER_PREFIX);

  if (!messageId) {
    return false;
  }

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.update({
      content: "❌ Cette session n'existe plus.",
      components: [],
    });

    return true;
  }

  if (interaction.user.id !== currentSession.hostId) {
    await interaction.update({
      content: "❌ Tu n'es plus l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  const newHostId = interaction.values[0];

  if (!newHostId) {
    await interaction.update({
      content: "❌ Aucun nouvel hôte n'a été sélectionné.",
      components: [],
    });

    return true;
  }

  if (newHostId === currentSession.hostId) {
    await interaction.update({
      content: "❌ Tu es déjà l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  if (!currentSession.participants.has(newHostId)) {
    await interaction.update({
      content: "❌ Le nouvel hôte doit d'abord rejoindre la session.",
      components: [],
    });

    return true;
  }

  if (!interaction.channel) {
    await interaction.update({
      content: "❌ Impossible de retrouver le salon de la session.",
      components: [],
    });

    return true;
  }

  const sessionMessage = await interaction.channel.messages.fetch(messageId);

  const session = requireSession(
    transferSessionHost(messageId, newHostId),
    "le transfert d'hôte",
  );

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });

  await interaction.update({
    content: `👑 <@${newHostId}> est maintenant l'hôte de la session.`,
    components: [],
  });

  return true;
}

/**
 * Traite le menu permettant de changer le jeu d'une session.
 */
export async function handleSessionGameSelect(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  const messageId = getCustomIdValue(interaction.customId, GAME_PREFIX);

  if (!messageId) {
    return false;
  }

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.update({
      content: "❌ Cette session n'existe plus ou n'est plus active.",
      components: [],
    });

    return true;
  }

  if (interaction.user.id !== currentSession.hostId) {
    await interaction.update({
      content: "❌ Tu n'es plus l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  const gameId = interaction.values[0];

  if (!gameId) {
    await interaction.update({
      content: "❌ Aucun jeu n'a été sélectionné.",
      components: [],
    });

    return true;
  }

  const game = getGameById(gameId);

  if (!game || !game.enabled) {
    await interaction.update({
      content: "❌ Ce jeu n'est plus disponible.",
      components: [],
    });

    return true;
  }

  if (game.id === currentSession.game.id) {
    await interaction.update({
      content: `ℹ️ La session utilise déjà **${game.name}**.`,
      components: [],
    });

    return true;
  }

  const session = requireSession(
    updateSessionGame(messageId, game),
    "le changement de jeu",
  );

  if (!interaction.channel) {
    await interaction.update({
      content: "❌ Impossible de retrouver le salon de la session.",
      components: [],
    });

    return true;
  }

  const sessionMessage = await interaction.channel.messages.fetch(messageId);

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });

  await interaction.update({
    content: `🎮 Jeu changé pour **${game.name}**.`,
    components: [],
  });

  return true;
}

/**
 * Traite le modal de modification d'une session.
 */
export async function handleSessionEditModal(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  const messageId = getCustomIdValue(interaction.customId, EDIT_PREFIX);

  if (!messageId) {
    return false;
  }

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.reply({
      content: "❌ Cette session n'existe plus ou n'est plus active.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  if (interaction.user.id !== currentSession.hostId) {
    await interaction.reply({
      content: "❌ Tu n'es plus l'hôte de cette session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const when = interaction.fields.getTextInputValue("when").trim();

  const description = interaction.fields
    .getTextInputValue("description")
    .trim();

  if (!when) {
    await interaction.reply({
      content: "❌ Le moment de la session ne peut pas être vide.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const session = requireSession(
    updateSessionDetails(messageId, {
      when,
      description,
    }),
    "la modification",
  );

  if (!interaction.channel) {
    await interaction.reply({
      content: "❌ Impossible de retrouver le salon de la session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const sessionMessage = await interaction.channel.messages.fetch(messageId);

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });

  await interaction.reply({
    content: "✅ Session modifiée.",
    flags: MessageFlags.Ephemeral,
  });

  return true;
}
