import type { Client, Collection } from "discord.js";

import type { BotCommand } from "./command.js";

/**
 * Client Discord utilisé par l'application.
 *
 * discord.js ne possède pas nativement de propriété `commands`.
 * Le bot ajoute cette collection au client pendant son
 * initialisation dans `index.js`.
 *
 * Ce type centralise cette extension afin d'éviter de redéfinir
 * la structure du client dans chaque module TypeScript.
 */
export type BotClient = Client & {
  /**
   * Registre des commandes chargées dynamiquement au démarrage.
   *
   * La clé correspond au nom de la slash command Discord.
   */
  commands: Collection<string, BotCommand>;
};
