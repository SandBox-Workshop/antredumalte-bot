import { type Client, Events } from "discord.js";

/**
 * Événement déclenché une seule fois lorsque le client Discord
 * est complètement connecté et prêt à recevoir des événements.
 */
export const name = Events.ClientReady;

/**
 * L'événement `ClientReady` ne doit être exécuté qu'une seule fois
 * pendant le cycle de vie du processus.
 */
export const once = true;

/**
 * Confirme dans les logs que la connexion à Discord est opérationnelle.
 *
 * @param client Client Discord authentifié et prêt.
 */
export function execute(client: Client<true>): void {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
}
