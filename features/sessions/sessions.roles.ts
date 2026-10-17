import type { Client, Guild, Role } from "discord.js";

import type { GameSession, SessionMemberStatus } from "../../types/session.js";

const UNKNOWN_ROLE_CODE = 10011;
const MAX_ROLE_NAME_LENGTH = 100;

function getDiscordErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "number" ? code : undefined;
}

async function fetchGuild(client: Client, guildId: string): Promise<Guild> {
  return client.guilds.cache.get(guildId) ?? client.guilds.fetch(guildId);
}

export function buildSessionRoleName(
  gameName: string,
  messageId: string,
): string {
  const suffix = messageId.slice(-6);
  const name = `Session • ${gameName} • ${suffix}`;

  return name.slice(0, MAX_ROLE_NAME_LENGTH);
}

/**
 * Crée le rôle Discord temporaire propre à une session.
 */
export async function createSessionRole(
  client: Client,
  guildId: string,
  gameName: string,
  messageId: string,
): Promise<Role> {
  const guild = await fetchGuild(client, guildId);

  return guild.roles.create({
    name: buildSessionRoleName(gameName, messageId),
    hoist: false,
    mentionable: true,
    reason: `Rôle temporaire pour la session ${messageId}`,
  });
}

export async function addSessionRoleToMember(
  client: Client,
  guildId: string,
  roleId: string,
  userId: string,
): Promise<void> {
  const guild = await fetchGuild(client, guildId);
  const member = await guild.members.fetch(userId);

  await member.roles.add(roleId, "Participation à une session de jeu");
}

export async function removeSessionRoleFromMember(
  client: Client,
  guildId: string,
  roleId: string,
  userId: string,
): Promise<void> {
  const guild = await fetchGuild(client, guildId);
  const member = await guild.members.fetch(userId);

  await member.roles.remove(roleId, "Départ d'une session de jeu");
}

/**
 * Synchronise le rôle d'un membre avec son état de participation.
 */
export async function syncSessionMemberRole(
  client: Client,
  session: GameSession,
  userId: string,
  status: SessionMemberStatus,
): Promise<void> {
  if (!session.roleId) {
    throw new Error(`La session ${session.messageId} n'a pas de rôle Discord.`);
  }

  if (status === "joined") {
    await addSessionRoleToMember(
      client,
      session.guildId,
      session.roleId,
      userId,
    );

    return;
  }

  await removeSessionRoleFromMember(
    client,
    session.guildId,
    session.roleId,
    userId,
  );
}

/**
 * Renomme le rôle lorsque l'hôte change le jeu de la session.
 */
export async function renameSessionRole(
  client: Client,
  session: GameSession,
): Promise<void> {
  if (!session.roleId) {
    return;
  }

  const guild = await fetchGuild(client, session.guildId);
  const role = await guild.roles.fetch(session.roleId);

  if (!role) {
    return;
  }

  await role.edit({
    name: buildSessionRoleName(session.game.name, session.messageId),
    reason: `Jeu modifié pour la session ${session.messageId}`,
  });
}

export async function deleteSessionRoleById(
  client: Client,
  guildId: string,
  roleId: string,
  reason = "Nettoyage d'un rôle temporaire de session",
): Promise<void> {
  try {
    const guild = await fetchGuild(client, guildId);
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      return;
    }

    await role.delete(reason);
  } catch (error: unknown) {
    if (getDiscordErrorCode(error) === UNKNOWN_ROLE_CODE) {
      return;
    }

    throw error;
  }
}

/**
 * Supprime le rôle temporaire.
 *
 * Un rôle déjà supprimé est considéré comme nettoyé avec succès.
 */
export async function deleteSessionRole(
  client: Client,
  session: GameSession,
): Promise<void> {
  if (!session.roleId) {
    return;
  }

  await deleteSessionRoleById(
    client,
    session.guildId,
    session.roleId,
    `Clôture de la session ${session.messageId}`,
  );
}
