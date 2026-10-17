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
  clearSessionRoleId,
  closeSession,
  setMemberStatus,
  transferSessionHost,
  updateSessionDetails,
  updateSessionGame,
} from "../../services/session.service.js";

import type {
  GameSession,
  SessionMemberStatus,
  SessionMutationFailureReason,
  SessionMutationResult,
} from "../../types/session.js";

import {
  closePanel,
  parseCustomId,
  replyEphemeral,
} from "../../utils/discord-components.js";

import { resolveSessionSchedule } from "../../utils/session-date.js";

import { buildSessionEmbed } from "./sessions.embed.js";

import {
  buildEditModal,
  buildGameSelect,
  buildHostSelect,
  buildSessionButtons,
  buildSessionManagementButtons,
  SESSION_FEATURE,
} from "./sessions.components.js";

import { requireActiveSession, requireHostSession } from "./sessions.guard.js";

import {
  deleteSessionRole,
  renameSessionRole,
  syncSessionMemberRole,
} from "./sessions.roles.js";

export { buildSessionButtons } from "./sessions.components.js";

const MISSING_DISCORD_RESOURCE_CODES = new Set([10003, 10008]);

type SessionCustomId = {
  action: string;
  messageId?: string;
};

const SESSION_MUTATION_MESSAGES: Record<SessionMutationFailureReason, string> =
  {
    session_not_found: "❌ Cette session n'existe plus ou n'est plus active.",

    not_host: "❌ Tu n'es plus l'hôte de cette session.",

    host_cannot_leave:
      "👑 Tu es l'hôte de cette session. Transfère d'abord l'hôte ou annule la session.",

    host_cannot_maybe:
      "👑 Tu es l'hôte de cette session. Transfère d'abord l'hôte ou annule la session.",

    new_host_is_current_host: "❌ Tu es déjà l'hôte de cette session.",

    new_host_must_be_participant:
      "❌ Le nouvel hôte doit d'abord rejoindre la session.",
  };

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

  const code = (
    error as {
      code?: unknown;
    }
  ).code;

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

async function resolveMutation(
  result: SessionMutationResult,
  reject: (message: string) => Promise<void>,
): Promise<GameSession | null> {
  if (result.ok) {
    return result.session;
  }

  await reject(SESSION_MUTATION_MESSAGES[result.reason]);

  return null;
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

function getMemberStatus(
  session: GameSession,
  userId: string,
): SessionMemberStatus {
  if (session.participants.has(userId)) {
    return "joined";
  }

  if (session.maybes.has(userId)) {
    return "maybe";
  }

  return "left";
}

async function updateParticipation(
  interaction: ButtonInteraction,
  messageId: string,
  userId: string,
  status: SessionMemberStatus,
): Promise<GameSession | null> {
  const currentSession = await requireActiveSession(messageId, (message) =>
    replyEphemeral(interaction, message),
  );

  if (!currentSession) {
    return null;
  }

  const previousStatus = getMemberStatus(currentSession, userId);

  const session = await resolveMutation(
    setMemberStatus(messageId, userId, status),
    (message) => replyEphemeral(interaction, message),
  );

  if (!session) {
    return null;
  }

  try {
    await syncSessionMemberRole(interaction.client, session, userId, status);
  } catch (error: unknown) {
    console.error(
      `[sessions] Impossible de synchroniser le rôle de ${userId}.`,
      error,
    );

    const rollback = setMemberStatus(messageId, userId, previousStatus);

    if (!rollback.ok) {
      console.error(
        "[sessions] Impossible de restaurer l'état du participant après l'échec du rôle.",
        rollback.reason,
      );
    }

    await replyEphemeral(
      interaction,
      "❌ Impossible de mettre à jour ton rôle de session. Ton inscription n'a pas été modifiée.",
    );

    return null;
  }

  return session;
}

async function cleanupClosedSessionRole(
  interaction: Interaction,
  session: GameSession,
): Promise<void> {
  if (!session.roleId) {
    return;
  }

  try {
    await deleteSessionRole(interaction.client, session);

    clearSessionRoleId(session.messageId);
  } catch (error: unknown) {
    /*
     * La session reste correctement fermée en base.
     * Le scheduler retentera le nettoyage au prochain tick.
     */
    console.error(
      `[sessions] Impossible de supprimer le rôle de la session ${session.messageId}.`,
      error,
    );
  }
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
      const session = await updateParticipation(
        interaction,
        messageId,
        userId,
        "joined",
      );

      if (!session) {
        return true;
      }

      await interaction.update({
        embeds: [buildSessionEmbed(session)],

        components: buildSessionButtons(),
      });

      return true;
    }

    case "maybe": {
      const session = await updateParticipation(
        interaction,
        messageId,
        userId,
        "maybe",
      );

      if (!session) {
        return true;
      }

      await interaction.update({
        embeds: [buildSessionEmbed(session)],

        components: buildSessionButtons(),
      });

      return true;
    }

    case "leave": {
      const session = await updateParticipation(
        interaction,
        messageId,
        userId,
        "left",
      );

      if (!session) {
        return true;
      }

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

      const completedSession = await resolveMutation(
        closeSession(messageId, userId, "completed"),
        (message) =>
          replyOrCloseButton(interaction, fromManagementPanel, message),
      );

      if (!completedSession) {
        return true;
      }

      if (sessionMessage) {
        await sessionMessage.edit({
          embeds: [buildSessionEmbed(completedSession)],

          components: [],
        });

        await cleanupClosedSessionRole(interaction, completedSession);

        await closePanel(interaction, "✅ Session terminée.");

        return true;
      }

      await interaction.update({
        embeds: [buildSessionEmbed(completedSession)],

        components: [],
      });

      await cleanupClosedSessionRole(interaction, completedSession);

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

      const cancelledSession = await resolveMutation(
        closeSession(messageId, userId, "cancelled"),
        (message) =>
          replyOrCloseButton(interaction, fromManagementPanel, message),
      );

      if (!cancelledSession) {
        return true;
      }

      if (sessionMessage) {
        await sessionMessage.edit({
          embeds: [buildSessionEmbed(cancelledSession)],

          components: [],
        });

        await cleanupClosedSessionRole(interaction, cancelledSession);

        await closePanel(interaction, "🚫 Session annulée.");

        return true;
      }

      await interaction.update({
        embeds: [buildSessionEmbed(cancelledSession)],

        components: [],
      });

      await cleanupClosedSessionRole(interaction, cancelledSession);

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

  const newHostId = interaction.values[0];

  if (!newHostId) {
    await closePanel(interaction, "❌ Aucun nouvel hôte n'a été sélectionné.");

    return true;
  }

  const session = await resolveMutation(
    transferSessionHost(messageId, interaction.user.id, newHostId),
    (message) => closePanel(interaction, message),
  );

  if (!session) {
    return true;
  }

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

  const currentSession = await requireHostSession(
    interaction.user.id,
    messageId,
    (message) => closePanel(interaction, message),
  );

  if (!currentSession) {
    return true;
  }

  if (game.id === currentSession.game.id) {
    await closePanel(
      interaction,
      `ℹ️ La session utilise déjà **${game.name}**.`,
    );

    return true;
  }

  const session = await resolveMutation(
    updateSessionGame(messageId, interaction.user.id, game.id),
    (message) => closePanel(interaction, message),
  );

  if (!session) {
    return true;
  }

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

  try {
    await renameSessionRole(interaction.client, session);
  } catch (error: unknown) {
    console.error(
      `[sessions] Impossible de renommer le rôle de la session ${session.messageId}.`,
      error,
    );
  }

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

  const date = interaction.fields.getTextInputValue("date").trim();

  const time = interaction.fields.getTextInputValue("heure").trim();

  const description = interaction.fields
    .getTextInputValue("description")
    .trim();

  const schedule = resolveSessionSchedule(date, time);

  if (!schedule.ok) {
    await replyEphemeral(interaction, schedule.message);

    return true;
  }

  const session = await resolveMutation(
    updateSessionDetails(messageId, interaction.user.id, {
      scheduledAt: schedule.scheduledAt,

      description,
    }),
    (message) => replyEphemeral(interaction, message),
  );

  if (!session) {
    return true;
  }

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
