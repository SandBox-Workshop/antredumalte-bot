import { getSession } from "../../services/session.service.js";
import type { GameSession } from "../../types/session.js";

export type SessionRejection = (message: string) => Promise<void>;

/**
 * Garde d'interface utilisée avant d'afficher une action.
 *
 * Les mutations elles-mêmes revérifient leurs règles métier
 * dans `session.service.ts`.
 */
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

/**
 * Garde d'interface pour les panneaux et formulaires réservés à l'hôte.
 *
 * Cette vérification améliore l'UX mais ne remplace pas
 * l'autorisation effectuée par le service lors d'une mutation.
 */
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
