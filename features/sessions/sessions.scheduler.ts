import { type Client, type Message } from "discord.js";

import {
  autoCompleteSession,
  claimSessionStartNotification,
  clearSessionRoleId,
  getSessionsDueForAutoClose,
  getSessionsDueForStart,
  getSessionsPendingRoleCleanup,
  releaseSessionStartNotification,
} from "../../services/session.service.js";

import type { GameSession } from "../../types/session.js";

import { buildSessionEmbed } from "./sessions.embed.js";

import { deleteSessionRole } from "./sessions.roles.js";

const SESSION_NOTIFICATION_INTERVAL_MS = 15_000;

const SESSION_AUTO_CLOSE_AFTER_SECONDS = 6 * 60 * 60;

const MISSING_DISCORD_RESOURCE_CODES = new Set([10003, 10008]);

let schedulerRunning = false;

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
  client: Client,
  session: GameSession,
): Promise<Message | null> {
  try {
    const channel = await client.channels.fetch(session.channelId);

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

/**
 * Termine les sessions restées actives plus de 6 heures
 * après leur heure de début prévue.
 */
async function autoCloseExpiredSessions(client: Client): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const cutoff = now - SESSION_AUTO_CLOSE_AFTER_SECONDS;

  const expiredSessions = getSessionsDueForAutoClose(cutoff);

  for (const session of expiredSessions) {
    let message: Message | null;

    try {
      /*
       * On vérifie l'accès au message avant de modifier la DB.
       *
       * Une ressource Discord réellement supprimée renvoie `null`
       * et n'empêche pas la clôture.
       *
       * Une erreur temporaire, elle, reporte la clôture au tick suivant.
       */
      message = await fetchSessionMessage(client, session);
    } catch (error: unknown) {
      console.error(
        `[sessions] Impossible de récupérer le message avant l'auto-close de ${session.messageId}.`,
        error,
      );

      continue;
    }

    const completedSession = autoCompleteSession(
      session.messageId,
      cutoff,
      now,
    );

    if (!completedSession) {
      continue;
    }

    if (message) {
      try {
        await message.edit({
          embeds: [buildSessionEmbed(completedSession)],

          components: [],
        });
      } catch (error: unknown) {
        console.error(
          `[sessions] Session ${session.messageId} clôturée mais impossible de modifier son message Discord.`,
          error,
        );
      }
    } else {
      console.warn(
        `[sessions] Session ${session.messageId} auto-clôturée sans message Discord accessible.`,
      );
    }

    console.log(
      `[sessions] Session ${session.messageId} terminée automatiquement.`,
    );
  }
}

async function sendSessionStartNotifications(client: Client): Promise<void> {
  const dueSessions = getSessionsDueForStart();

  for (const session of dueSessions) {
    if (!session.roleId) {
      continue;
    }

    const claimed = claimSessionStartNotification(session.messageId);

    if (!claimed) {
      continue;
    }

    try {
      const guild =
        client.guilds.cache.get(session.guildId) ??
        (await client.guilds.fetch(session.guildId));

      const role = await guild.roles.fetch(session.roleId);

      if (!role) {
        throw new Error(
          `Rôle ${session.roleId} introuvable pour la session ${session.messageId}.`,
        );
      }

      const channel = await guild.channels.fetch(session.channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(
          `Salon ${session.channelId} introuvable ou non textuel.`,
        );
      }

      await channel.send({
        content: [
          `🔔 <@&${session.roleId}>`,
          `🎮 **La session ${session.game.name} commence maintenant !**`,
          `👑 Hôte : <@${session.hostId}>`,
        ].join("\n"),

        allowedMentions: {
          parse: [],
          roles: [session.roleId],
          users: [],
        },
      });

      console.log(
        `[sessions] Notification de début envoyée pour ${session.messageId}.`,
      );
    } catch (error: unknown) {
      releaseSessionStartNotification(session.messageId);

      console.error(
        `[sessions] Échec de la notification de début pour ${session.messageId}.`,
        error,
      );
    }
  }
}

async function cleanupClosedSessionRoles(client: Client): Promise<void> {
  const sessions = getSessionsPendingRoleCleanup();

  for (const session of sessions) {
    try {
      await deleteSessionRole(client, session);

      clearSessionRoleId(session.messageId);
    } catch (error: unknown) {
      console.error(
        `[sessions] Échec du nettoyage du rôle pour ${session.messageId}.`,
        error,
      );
    }
  }
}

export async function runSessionScheduler(client: Client): Promise<void> {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    /*
     * L'auto-close passe avant les notifications.
     *
     * Une vieille session retrouvée après un redémarrage prolongé
     * ne doit pas envoyer "commence maintenant" juste avant sa clôture.
     */
    await autoCloseExpiredSessions(client);

    await sendSessionStartNotifications(client);

    await cleanupClosedSessionRoles(client);
  } finally {
    schedulerRunning = false;
  }
}

export function startSessionScheduler(client: Client): void {
  void runSessionScheduler(client);

  const interval = setInterval(() => {
    void runSessionScheduler(client);
  }, SESSION_NOTIFICATION_INTERVAL_MS);

  interval.unref();

  console.log(
    `[sessions] Scheduler démarré (${SESSION_NOTIFICATION_INTERVAL_MS / 1000}s, auto-close après ${SESSION_AUTO_CLOSE_AFTER_SECONDS / 3600}h).`,
  );
}
