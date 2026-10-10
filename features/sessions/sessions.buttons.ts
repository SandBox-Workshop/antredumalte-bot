import {
  ActionRowBuilder,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type Message,
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
  formatSessionDateInput,
  formatSessionLegacyWhen,
  formatSessionTimeInput,
  parseSessionDateTime,
} from "../../utils/session-date.js";

import {
  buildCancelledSessionEmbed,
  buildCompletedSessionEmbed,
  buildSessionEmbed,
} from "./sessions.embed.js";

const SESSION_PREFIX = "session:";
const TRANSFER_PREFIX = "session:transfer:";
const GAME_PREFIX = "session:game:";
const EDIT_PREFIX = "session:edit:";

/**
 * Garantit qu'une opération métier a retourné
 * une session valide.
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
 * Extrait la valeur située après un préfixe de customId.
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
 * Retrouve le message Discord public associé à une session.
 *
 * Les interactions du panneau de gestion sont éphémères.
 * Elles ne proviennent donc plus directement du message public.
 */
async function fetchSessionMessage(
  interaction: Interaction,
  session: GameSession,
): Promise<Message | null> {
  const channel = await interaction.client.channels.fetch(session.channelId);

  if (!channel || !channel.isTextBased() || !("messages" in channel)) {
    return null;
  }

  return channel.messages.fetch(session.messageId);
}

/**
 * Construit les boutons publics d'une session.
 *
 * Ces actions sont les seules pertinentes pour tous les membres.
 * Les fonctions réservées à l'hôte sont déplacées dans
 * un panneau de gestion éphémère.
 */
export function buildSessionButtons(): [ActionRowBuilder<ButtonBuilder>] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

    new ButtonBuilder()
      .setCustomId("session:manage")
      .setLabel("Gérer")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Primary),
  );

  return [row];
}

/**
 * Construit les actions réservées à l'hôte.
 *
 * L'identifiant du message public est inclus dans chaque customId
 * car ces boutons sont envoyés dans une réponse éphémère distincte.
 */
function buildSessionManagementButtons(
  messageId: string,
): [ActionRowBuilder<ButtonBuilder>] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`session:edit:${messageId}`)
      .setLabel("Modifier")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`session:game:${messageId}`)
      .setLabel("Changer le jeu")
      .setEmoji("🎮")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`session:transfer:${messageId}`)
      .setLabel("Changer d'hôte")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`session:complete:${messageId}`)
      .setLabel("Terminer")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`session:cancel:${messageId}`)
      .setLabel("Annuler")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),
  );

  return [row];
}

/**
 * Menu permettant de choisir le nouvel hôte.
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
 * Menu permettant de choisir un nouveau jeu.
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
 * Construit le formulaire de modification d'une session.
 */
function buildEditModal(session: GameSession): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${EDIT_PREFIX}${session.messageId}`)
    .setTitle("Modifier la session");

  const dateInput = new TextInputBuilder()
    .setCustomId("date")
    .setLabel("Date (JJ/MM/AAAA)")
    .setPlaceholder("12/10/2026")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const timeInput = new TextInputBuilder()
    .setCustomId("heure")
    .setLabel("Heure (HH:MM)")
    .setPlaceholder("21:00")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(5);

  if (session.scheduledAt !== null) {
    dateInput.setValue(formatSessionDateInput(session.scheduledAt));

    timeInput.setValue(formatSessionTimeInput(session.scheduledAt));
  }

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
    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),

    new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),

    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
  );

  return modal;
}

/**
 * Traite les boutons de session publics et privés.
 */
export async function handleSessionButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith(SESSION_PREFIX)) {
    return false;
  }

  const parts = interaction.customId.split(":");

  const action = parts[1];

  const referencedMessageId = parts[2];

  /*
   * Bouton public :
   * l'interaction provient directement du message de session.
   *
   * Bouton de gestion :
   * l'identifiant du message public est inclus dans le customId.
   */
  const messageId = referencedMessageId ?? interaction.message.id;

  const userId = interaction.user.id;

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.reply({
      content: "❌ Cette session n'existe plus ou n'est plus active.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

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
        "le départ",
      );

      await interaction.update({
        embeds: [buildSessionEmbed(session)],
        components: buildSessionButtons(),
      });

      return true;
    }

    case "manage": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut gérer cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      await interaction.reply({
        content: "⚙️ **Gestion de la session**",
        components: buildSessionManagementButtons(messageId),
        flags: MessageFlags.Ephemeral,
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

      if (referencedMessageId) {
        await interaction.update({
          content: "🎮 Choisis le nouveau jeu de la session :",
          components: [buildGameSelect(messageId, currentSession.game.id)],
        });
      } else {
        await interaction.reply({
          content: "🎮 Choisis le nouveau jeu de la session :",
          components: [buildGameSelect(messageId, currentSession.game.id)],
          flags: MessageFlags.Ephemeral,
        });
      }

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

      if (referencedMessageId) {
        await interaction.update({
          content: "👑 Choisis le participant qui deviendra le nouvel hôte :",
          components: [buildHostSelect(messageId)],
        });
      } else {
        await interaction.reply({
          content: "👑 Choisis le participant qui deviendra le nouvel hôte :",
          components: [buildHostSelect(messageId)],
          flags: MessageFlags.Ephemeral,
        });
      }

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

      /*
       * Nouveau bouton privé :
       * il faut modifier le message public séparément.
       */
      if (referencedMessageId) {
        const sessionMessage = await fetchSessionMessage(
          interaction,
          completedSession,
        );

        if (!sessionMessage) {
          await interaction.update({
            content: "❌ Impossible de retrouver le message de la session.",
            components: [],
          });

          return true;
        }

        await sessionMessage.edit({
          embeds: [buildCompletedSessionEmbed(completedSession)],
          components: [],
        });

        await interaction.update({
          content: "✅ Session terminée.",
          components: [],
        });

        return true;
      }

      /*
       * Compatibilité avec les anciens messages de session
       * qui possèdent encore le bouton public "Terminer".
       */
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

      if (referencedMessageId) {
        const sessionMessage = await fetchSessionMessage(
          interaction,
          cancelledSession,
        );

        if (!sessionMessage) {
          await interaction.update({
            content: "❌ Impossible de retrouver le message de la session.",
            components: [],
          });

          return true;
        }

        await sessionMessage.edit({
          embeds: [buildCancelledSessionEmbed(cancelledSession)],
          components: [],
        });

        await interaction.update({
          content: "🚫 Session annulée.",
          components: [],
        });

        return true;
      }

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
 * Traite la sélection du nouvel hôte.
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

  const session = requireSession(
    transferSessionHost(messageId, newHostId),
    "le transfert d'hôte",
  );

  const sessionMessage = await fetchSessionMessage(interaction, session);

  if (!sessionMessage) {
    await interaction.update({
      content: "❌ Impossible de retrouver le message de la session.",
      components: [],
    });

    return true;
  }

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
 * Traite la sélection d'un nouveau jeu.
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

  const sessionMessage = await fetchSessionMessage(interaction, session);

  if (!sessionMessage) {
    await interaction.update({
      content: "❌ Impossible de retrouver le message de la session.",
      components: [],
    });

    return true;
  }

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
 * Traite le formulaire de modification.
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

  const date = interaction.fields.getTextInputValue("date").trim();

  const time = interaction.fields.getTextInputValue("heure").trim();

  const description = interaction.fields
    .getTextInputValue("description")
    .trim();

  const scheduledAt = parseSessionDateTime(date, time);

  if (scheduledAt === null) {
    await interaction.reply({
      content: "❌ Date ou heure invalide. Utilise `JJ/MM/AAAA` et `HH:MM`.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const now = Math.floor(Date.now() / 1000);

  if (scheduledAt <= now) {
    await interaction.reply({
      content: "❌ La session doit être prévue dans le futur.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const when = formatSessionLegacyWhen(scheduledAt);

  const session = requireSession(
    updateSessionDetails(messageId, {
      when,
      scheduledAt,
      description,
    }),
    "la modification",
  );

  const sessionMessage = await fetchSessionMessage(interaction, session);

  if (!sessionMessage) {
    await interaction.reply({
      content: "❌ Impossible de retrouver le message de la session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

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
