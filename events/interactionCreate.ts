import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  Events,
  type Interaction,
  MessageFlags,
} from "discord.js";

import { routeFeatureInteraction } from "../interactions/router.js";

/**
 * Contrat minimal d'une commande enregistrée dans le bot.
 *
 * Une commande doit fournir une méthode `execute`.
 * Elle peut également exposer une méthode `autocomplete`
 * lorsqu'elle utilise l'autocomplétion Discord.
 */
type CommandModule = {
  execute: (
    interaction: ChatInputCommandInteraction,
  ) => unknown | Promise<unknown>;

  autocomplete?: (
    interaction: AutocompleteInteraction,
  ) => unknown | Promise<unknown>;
};

/**
 * Client Discord enrichi avec le registre des commandes du bot.
 *
 * La collection `commands` est ajoutée au client pendant
 * l'initialisation dans `index.js`.
 */
type BotClient = Client & {
  commands: Collection<string, CommandModule>;
};

/**
 * Codes d'erreurs Discord pouvant être ignorés.
 *
 * - `10062` : interaction inconnue ou expirée ;
 * - `40060` : interaction déjà acquittée.
 */
const IGNORED_INTERACTION_ERRORS = new Set([10062, 40060]);

/**
 * Nom de l'événement Discord traité par ce module.
 */
export const name = Events.InteractionCreate;

/**
 * Extrait le code numérique éventuel d'une erreur.
 *
 * Les erreurs capturées sont volontairement traitées comme `unknown`
 * afin d'éviter l'utilisation de `any`.
 *
 * @param error Erreur à analyser.
 * @returns Code numérique de l'erreur lorsqu'il existe.
 */
function getErrorCode(error: unknown): number | undefined {
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

/**
 * Vérifie si une erreur Discord fait partie des erreurs
 * volontairement ignorées.
 *
 * @param error Erreur à analyser.
 */
function isIgnoredInteractionError(error: unknown): boolean {
  const code = getErrorCode(error);

  return code !== undefined && IGNORED_INTERACTION_ERRORS.has(code);
}

/**
 * Recherche la commande correspondant à une interaction.
 *
 * @param interaction Interaction Discord contenant un nom de commande.
 * @returns Module de commande enregistré, s'il existe.
 */
function getCommand(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
): CommandModule | undefined {
  const client = interaction.client as BotClient;

  return client.commands.get(interaction.commandName);
}

/**
 * Traite une interaction d'autocomplétion.
 *
 * Lorsqu'une commande ne fournit aucun handler d'autocomplétion,
 * une liste vide est renvoyée à Discord.
 */
async function handleAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const command = getCommand(interaction);

  if (!command?.autocomplete) {
    await interaction.respond([]);

    return;
  }

  await command.autocomplete(interaction);
}

/**
 * Exécute une commande slash enregistrée.
 */
async function handleChatInputCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const command = getCommand(interaction);

  if (!command) {
    await interaction.reply({
      content: "❌ Commande inconnue.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  await command.execute(interaction);
}

/**
 * Envoie une réponse d'erreur générique à Discord.
 *
 * Si l'interaction a déjà reçu une première réponse,
 * un `followUp` est utilisé à la place d'un `reply`.
 *
 * Les interactions non répondables sont ignorées.
 */
async function replyWithError(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) {
    return;
  }

  const payload = {
    content: "❌ Une erreur est arrivée pendant l'interaction.",
    flags: MessageFlags.Ephemeral,
  } as const;

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);

    return;
  }

  await interaction.reply(payload);
}

/**
 * Point d'entrée principal de toutes les interactions Discord.
 *
 * Le traitement est volontairement séparé en deux niveaux :
 *
 * 1. les interactions spécifiques aux features sont envoyées
 *    au routeur générique ;
 * 2. les interactions de commandes restent gérées par le
 *    système central de commandes.
 *
 * Cela évite que cet event dépende directement des différentes
 * fonctionnalités du bot.
 *
 * @param interaction Interaction Discord reçue.
 */
export async function execute(interaction: Interaction): Promise<void> {
  try {
    const featureHandled = await routeFeatureInteraction(interaction);

    if (featureHandled) {
      return;
    }

    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);

      return;
    }

    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction);
    }
  } catch (error: unknown) {
    console.error(error);

    if (isIgnoredInteractionError(error)) {
      return;
    }

    if (interaction.isAutocomplete()) {
      try {
        await interaction.respond([]);
      } catch {
        // Interaction expirée ou déjà acquittée.
      }

      return;
    }

    try {
      await replyWithError(interaction);
    } catch (replyError: unknown) {
      if (!isIgnoredInteractionError(replyError)) {
        console.error("Impossible d'envoyer le message d'erreur :", replyError);
      }
    }
  }
}
