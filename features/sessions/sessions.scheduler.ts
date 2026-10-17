import type { Client } from "discord.js";

import {
  claimSessionStartNotification,
  clearSessionRoleId,
  getSessionsDueForStart,
  getSessionsPendingRoleCleanup,
  releaseSessionStartNotification,
} from "../../services/session.service.js";

import { deleteSessionRole } from "./sessions.roles.js";

const SESSION_NOTIFICATION_INTERVAL_MS = 15_000;

let schedulerRunning = false;

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
      /*
       * Si Discord refuse l'envoi, on libère le claim pour permettre
       * une nouvelle tentative au prochain tick.
       */
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
    `[sessions] Scheduler démarré (${SESSION_NOTIFICATION_INTERVAL_MS / 1000}s).`,
  );
}
