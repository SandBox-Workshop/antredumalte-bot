import { Events } from "discord.js";

/**
 * Nom de l'événement Discord correspondant aux erreurs émises
 * directement par le client.
 */
export const name = Events.Error;

/**
 * Journalise les erreurs provenant du client Discord.
 *
 * Les erreurs métier ou les erreurs liées aux interactions sont
 * gérées séparément dans leurs handlers respectifs.
 *
 * @param error Erreur remontée par discord.js.
 */
export function execute(error: Error): void {
  console.error("Erreur client Discord :", error);
}
