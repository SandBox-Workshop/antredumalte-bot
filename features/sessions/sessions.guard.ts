import { getSession } from "../../services/session.service.js";
import type { GameSession } from "../../types/session.js";

export type SessionRejection = (message: string) => Promise<void>;

export async function requireActiveSession(
  messageId: string,
  reject: SessionRejection,
): Promise<GameSession | null> {
  const session = getSession(messageId);

  if (!session) {
    await reject("❌ Cette session n'existe plus ou n'est plus active.");
    return null;
  }

  return session;
}

export async function requireHostSession(
  userId: string,
  messageId: string,
  reject: SessionRejection,
  notHostMessage = "❌ Tu n'es plus l'hôte de cette session.",
): Promise<GameSession | null> {
  const session = await requireActiveSession(messageId, reject);

  if (!session) {
    return null;
  }

  if (session.hostId !== userId) {
    await reject(notHostMessage);
    return null;
  }

  return session;
}
