import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";

/**
 * Contrat commun d'une commande Discord chargée par le bot.
 *
 * Toutes les commandes doivent fournir une fonction `execute`.
 * Les commandes utilisant l'autocomplétion peuvent également
 * exposer une fonction `autocomplete`.
 *
 * Ce type représente uniquement le comportement nécessaire
 * après le chargement de la commande. La propriété `data`
 * reste gérée par le loader de commandes existant.
 */
export type BotCommand = {
  /**
   * Exécute la commande slash.
   *
   * @param interaction Interaction Discord associée à la commande.
   */
  execute: (
    interaction: ChatInputCommandInteraction,
  ) => unknown | Promise<unknown>;

  /**
   * Fournit les suggestions d'autocomplétion Discord.
   *
   * Cette fonction est optionnelle car toutes les commandes
   * n'utilisent pas d'options avec autocomplétion.
   *
   * @param interaction Interaction d'autocomplétion reçue.
   */
  autocomplete?: (
    interaction: AutocompleteInteraction,
  ) => unknown | Promise<unknown>;
};
