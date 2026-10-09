import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Données Discord minimales requises par une commande du bot.
 *
 * Le cœur de l'application utilise uniquement :
 *
 * - `name` pour enregistrer la commande dans le registre ;
 * - `toJSON()` pour envoyer sa définition à l'API Discord.
 *
 * Utiliser un contrat minimal évite de coupler le loader à
 * l'intégralité de l'API de `SlashCommandBuilder`.
 */
export type BotCommandData = Pick<SlashCommandBuilder, "name" | "toJSON">;

/**
 * Contrat commun d'une commande Discord chargée par le bot.
 *
 * Toute commande doit exposer :
 *
 * - `data` : définition de la slash command ;
 * - `execute` : logique exécutée lors de son utilisation.
 *
 * Une commande peut également exposer `autocomplete` lorsqu'une
 * ou plusieurs de ses options utilisent l'autocomplétion Discord.
 */
export type BotCommand = {
  /**
   * Définition utilisée pour enregistrer et déployer la commande.
   */
  data: BotCommandData;

  /**
   * Exécute la commande slash.
   *
   * @param interaction Interaction Discord associée à la commande.
   */
  execute: (
    interaction: ChatInputCommandInteraction,
  ) => unknown | Promise<unknown>;

  /**
   * Génère les suggestions d'autocomplétion de la commande.
   *
   * @param interaction Interaction d'autocomplétion reçue.
   */
  autocomplete?: (
    interaction: AutocompleteInteraction,
  ) => unknown | Promise<unknown>;
};
