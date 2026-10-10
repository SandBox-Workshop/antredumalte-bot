import {
  type ButtonInteraction,
  type Interaction,
  type Message,
  MessageFlags,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from "discord.js";

import { getEnabledGames, getGameById } from "../../services/game.service.js";
import {
  cancelSession,
  completeSession,
  joinSession,
  leaveSession,
  maybeSession,
  transferSessionHost,
  updateSessionDetails,
  updateSessionGame,
} from "../../services/session.service.js";
import type { GameSession } from "../../types/session.js";
import {
  closePanel,
  parseCustomId,
  replyEphemeral,
} from "../../utils/discord-components.js";
import {
  formatSessionLegacyWhen,
  parseSessionDateTime,
} from "../../utils/session-date.js";
import {
  buildCancelledSessionEmbed,
  buildCompletedSessionEmbed,
  buildSessionEmbed,
} from "./sessions.embed.js";
import {
  buildEditModal,
  buildGameSelect,
  buildHostSelect,
  buildSessionButtons,
  buildSessionManagementButtons,
  SESSION_FEATURE,
} from "./sessions.components.js";
import { requireActiveSession, requireHostSession } from "./sessions.guard.js";

export { buildSessionButtons } from "./sessions.components.js";

const MISSING_DISCORD_RESOURCE_CODES = new Set([10003, 10008]);

type SessionCustomId = {
  action: string;
  messageId?: string;
};

function requireSession(
  session: GameSession | null,
  operation: string,
): GameSession {
  if (!session) {
    throw new Error(`Session introuvable après ${operation}.`);
  }

  return session;
}

function parseSessionCustomId(customId: string): SessionCustomId | null {
  const parsed = parseCustomId(customId);

  if (!parsed || parsed.feature !== SESSION_FEATURE) {
    return null;
  }

  return {
    action: parsed.action,
    messageId: parsed.args[0],
  };
}

function getDiscordErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

async function fetchSessionMessage(
  interaction: Interaction,
  session: GameSession,
): Promise<Message | null> {
  try {
    const channel = await interaction.client.channels.fetch(session.channelId);

    if (!channel || !channel.isTextBased() || !("messages" in channel)) {
      return null;
    }

    return await channel.messages.fetch(session.messageId);
  } catch (error: unknown) {
    const code = getDiscordErrorCode(error);

    if (code !== undefined && MISSING_DISCORD_RESOURCE_CODES.has(code)) {
      return null;
    }

    throw error;
  }
}

async function replyOrCloseButton(
  interaction: ButtonInteraction,
  fromManagementPanel: boolean,
  message: string,
): Promise<void> {
  if (fromManagementPanel) {
    await closePanel(interaction, message);
    return;
  }

  await replyEphemeral(interaction, message);
}

async function requireButtonHostSession(
  interaction: ButtonInteraction,
  messageId: string,
  fromManagementPanel: boolean,
  notHostMessage: string,
): Promise<GameSession | null> {
  return requireHostSession(
    interaction.user.id,
    messageId,
    (message) => replyOrCloseButton(interaction, fromManagementPanel, message),
    notHostMessage,
  );
}

async function requireParticipantActionSession(
  interaction: ButtonInteraction,
  messageId: string,
): Promise<GameSession | null> {
  const session = await requireActiveSession(messageId, (message) =>
    replyEphemeral(interaction, message),
  );

  if (!session) {
    return null;
  }

  if (session.hostId === interaction.user.id) {
    await replyEphemeral(
      interaction,
      "👑 Tu es l'hôte de cette session. Transfère d'abord l'hôte ou annule la session.",
    );
    return null;
  }

  return session;
}

export async function handleSessionButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const customId = parseSessionCustomId(interaction.customId);

  if (!customId) {
    return false;
  }

  const { action, messageId: referencedMessageId } = customId;
  const fromManagementPanel = referencedMessageId !== undefined;
  const messageId = referencedMessageId ?? interaction.message.id;
  const userId = interaction.user.id;

  switch (action) {
    case "join": {
      const currentSession = await requireActiveSession(messageId, (message) =>
        replyEphemeral(interaction, message),
      );

      if (!currentSession) {
        return true;
      }

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
      const currentSession = await requireParticipantActionSession(
        interaction,
        messageId,
      );

      if (!currentSession) {
        return true;
      }

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
      const currentSession = await requireParticipantActionSession(
        interaction,
        messageId,
      );

      if (!currentSession) {
        return true;
      }

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
      const session = await requireButtonHostSession(
        interaction,
        messageId,
        false,
        "❌ Seul l'hôte peut gérer cette session.",
      );

      if (!session) {
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
      const session = await requireButtonHostSession(
        interaction,
        messageId,
        fromManagementPanel,
        "❌ Seul l'hôte peut modifier cette session.",
      );

      if (!session) {
        return true;
      }

      await interaction.showModal(buildEditModal(session));
      return true;
    }

    case "game": {
      const session = await requireButtonHostSession(
        interaction,
        messageId,
        fromManagementPanel,
        "❌ Seul l'hôte peut changer le jeu.",
      );

      if (!session) {
        return true;
      }

      const games = getEnabledGames();

      if (games.length === 0) {
        await replyOrCloseButton(
          interaction,
          fromManagementPanel,
          "❌ Aucun jeu actif n'est disponible.",
        );
        return true;
      }

      if (fromManagementPanel) {
        await interaction.update({
          content: "🎮 Choisis le nouveau jeu de la session :",
          components: [buildGameSelect(messageId, session.game.id)],
        });
      } else {
        await interaction.reply({
          content: "🎮 Choisis le nouveau jeu de la session :",
          components: [buildGameSelect(messageId, session.game.id)],
          flags: MessageFlags.Ephemeral,
        });
      }
      return true;
    }

    case "transfer": {
      const session = await requireButtonHostSession(
        interaction,
        messageId,
        fromManagementPanel,
        "❌ Seul l'hôte peut transférer la session.",
      );

      if (!session) {
        return true;
      }

      if (session.participants.size <= 1) {
        await replyOrCloseButton(
          interaction,
          fromManagementPanel,
          "❌ Il faut au moins un autre participant avant de pouvoir transférer l'hôte.",
        );
        return true;
      }

      if (fromManagementPanel) {
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
      const session = await requireButtonHostSession(
        interaction,
        messageId,
        fromManagementPanel,
        "❌ Seul l'hôte peut terminer cette session.",
      );

      if (!session) {
        return true;
      }

      let sessionMessage: Message | null = null;

      if (fromManagementPanel) {
        sessionMessage = await fetchSessionMessage(interaction, session);

        if (!sessionMessage) {
          await closePanel(
            interaction,
            "❌ Impossible de retrouver le message de la session.",
          );
          return true;
        }
      }

      const completedSession = requireSession(
        completeSession(messageId),
        "la clôture",
      );

      if (sessionMessage) {
        await sessionMessage.edit({
          embeds: [buildCompletedSessionEmbed(completedSession)],
          components: [],
        });
        await closePanel(interaction, "✅ Session terminée.");
        return true;
      }

      await interaction.update({
        embeds: [buildCompletedSessionEmbed(completedSession)],
        components: [],
      });
      return true;
    }

    case "cancel": {
      const session = await requireButtonHostSession(
        interaction,
        messageId,
        fromManagementPanel,
        "❌ Seul l'hôte peut annuler cette session.",
      );

      if (!session) {
        return true;
      }

      let sessionMessage: Message | null = null;

      if (fromManagementPanel) {
        sessionMessage = await fetchSessionMessage(interaction, session);

        if (!sessionMessage) {
          await closePanel(
            interaction,
            "❌ Impossible de retrouver le message de la session.",
          );
          return true;
        }
      }

      const cancelledSession = requireSession(
        cancelSession(messageId),
        "l'annulation",
      );

      if (sessionMessage) {
        await sessionMessage.edit({
          embeds: [buildCancelledSessionEmbed(cancelledSession)],
          components: [],
        });
        await closePanel(interaction, "🚫 Session annulée.");
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

export async function handleSessionHostSelect(
  interaction: UserSelectMenuInteraction,
): Promise<boolean> {
  const customId = parseSessionCustomId(interaction.customId);

  if (!customId || customId.action !== "transfer" || !customId.messageId) {
    return false;
  }

  const { messageId } = customId;
  const currentSession = await requireHostSession(
    interaction.user.id,
    messageId,
    (message) => closePanel(interaction, message),
  );

  if (!currentSession) {
    return true;
  }

  const newHostId = interaction.values[0];

  if (!newHostId) {
    await closePanel(interaction, "❌ Aucun nouvel hôte n'a été sélectionné.");
    return true;
  }

  if (newHostId === currentSession.hostId) {
    await closePanel(interaction, "❌ Tu es déjà l'hôte de cette session.");
    return true;
  }

  if (!currentSession.participants.has(newHostId)) {
    await closePanel(
      interaction,
      "❌ Le nouvel hôte doit d'abord rejoindre la session.",
    );
    return true;
  }

  const session = requireSession(
    transferSessionHost(messageId, newHostId),
    "le transfert d'hôte",
  );
  const sessionMessage = await fetchSessionMessage(interaction, session);

  if (!sessionMessage) {
    await closePanel(
      interaction,
      "❌ Impossible de retrouver le message de la session.",
    );
    return true;
  }

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });
  await closePanel(
    interaction,
    `👑 <@${newHostId}> est maintenant l'hôte de la session.`,
  );
  return true;
}

export async function handleSessionGameSelect(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  const customId = parseSessionCustomId(interaction.customId);

  if (!customId || customId.action !== "game" || !customId.messageId) {
    return false;
  }

  const { messageId } = customId;
  const currentSession = await requireHostSession(
    interaction.user.id,
    messageId,
    (message) => closePanel(interaction, message),
  );

  if (!currentSession) {
    return true;
  }

  const gameId = interaction.values[0];

  if (!gameId) {
    await closePanel(interaction, "❌ Aucun jeu n'a été sélectionné.");
    return true;
  }

  const game = getGameById(gameId);

  if (!game || !game.enabled) {
    await closePanel(interaction, "❌ Ce jeu n'est plus disponible.");
    return true;
  }

  if (game.id === currentSession.game.id) {
    await closePanel(
      interaction,
      `ℹ️ La session utilise déjà **${game.name}**.`,
    );
    return true;
  }

  const session = requireSession(
    updateSessionGame(messageId, game),
    "le changement de jeu",
  );
  const sessionMessage = await fetchSessionMessage(interaction, session);

  if (!sessionMessage) {
    await closePanel(
      interaction,
      "❌ Impossible de retrouver le message de la session.",
    );
    return true;
  }

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });
  await closePanel(interaction, `🎮 Jeu changé pour **${game.name}**.`);
  return true;
}

export async function handleSessionEditModal(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  const customId = parseSessionCustomId(interaction.customId);

  if (!customId || customId.action !== "edit" || !customId.messageId) {
    return false;
  }

  const { messageId } = customId;
  const currentSession = await requireHostSession(
    interaction.user.id,
    messageId,
    (message) => replyEphemeral(interaction, message),
  );

  if (!currentSession) {
    return true;
  }

  const date = interaction.fields.getTextInputValue("date").trim();
  const time = interaction.fields.getTextInputValue("heure").trim();
  const description = interaction.fields
    .getTextInputValue("description")
    .trim();
  const scheduledAt = parseSessionDateTime(date, time);

  if (scheduledAt === null) {
    await replyEphemeral(
      interaction,
      "❌ Date ou heure invalide. Utilise `JJ/MM/AAAA` et `HH:MM`.",
    );
    return true;
  }

  if (scheduledAt <= Math.floor(Date.now() / 1000)) {
    await replyEphemeral(
      interaction,
      "❌ La session doit être prévue dans le futur.",
    );
    return true;
  }

  const session = requireSession(
    updateSessionDetails(messageId, {
      when: formatSessionLegacyWhen(scheduledAt),
      scheduledAt,
      description,
    }),
    "la modification",
  );
  const sessionMessage = await fetchSessionMessage(interaction, session);

  if (!sessionMessage) {
    await replyEphemeral(
      interaction,
      "❌ Impossible de retrouver le message de la session.",
    );
    return true;
  }

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });
  await replyEphemeral(interaction, "✅ Session modifiée.");
  return true;
}
