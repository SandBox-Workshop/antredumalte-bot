import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  Events,
  type Interaction,
  MessageFlags,
} from "discord.js";

import {
  handleSessionButton,
  handleSessionEditModal,
  handleSessionGameSelect,
  handleSessionHostSelect,
} from "../features/sessions/sessions.buttons.js";

/**
 * Contrat minimal d'une commande enregistrée dans le bot.
 *
 * Les commandes peuvent gérer :
 *
 * - leur exécution principale avec `execute` ;
 * - l'autocomplétion Discord avec `autocomplete`, si nécessaire.
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
 * Extension locale du client Discord.
 *
 * Le bot attache dynamiquement une collection `commands`
 * au client lors de son initialisation.
 */
type BotClient = Client & {
  commands: Collection<string, CommandModule>;
};

/**
 * Codes d'erreurs Discord ignorés volontairement.
 *
 * - `10062` : interaction inconnue ou expirée ;
 * - `40060` : interaction déjà acquittée.
 *
 * Ces erreurs peuvent notamment apparaître lorsqu'une interaction
 * expire avant que Discord ne reçoive une réponse.
 */
const IGNORED_INTERACTION_ERRORS = new Set([10062, 40060]);

/**
 * Nom de l'événement traité par ce module.
 */
export const name = Events.InteractionCreate;

/**
 * Extrait un éventuel code numérique depuis une erreur inconnue.
 *
 * Les erreurs capturées sont de type `unknown` en TypeScript.
 * Cette fonction permet donc de vérifier proprement les codes
 * d'erreur Discord sans utiliser `any`.
 *
 * @param error Erreur à analyser.
 * @returns Code numérique de l'erreur, s'il existe.
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
 * Indique si une erreur Discord peut être ignorée sans action
 * supplémentaire.
 */
function isIgnoredInteractionError(error: unknown): boolean {
  const code = getErrorCode(error);

  return code !== undefined && IGNORED_INTERACTION_ERRORS.has(code);
}

/**
 * Récupère une commande enregistrée sur le client à partir
 * du nom contenu dans une interaction Discord.
 */
function getCommand(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
): CommandModule | undefined {
  const client = interaction.client as BotClient;

  return client.commands.get(interaction.commandName);
}

/**
 * Traite l'autocomplétion d'une commande slash.
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
 * Exécute une commande slash enregistrée dans le bot.
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
 * Envoie une réponse d'erreur générique lorsque le traitement
 * d'une interaction échoue.
 *
 * La méthode utilisée dépend de l'état de l'interaction :
 *
 * - `reply` si aucune réponse n'a encore été envoyée ;
 * - `followUp` si l'interaction a déjà été acquittée.
 */
async function replyWithError(interaction: Interaction): Promise<void> {
  const payload = {
    content: "❌ Une erreur est arrivée pendant l'interaction.",
    flags: MessageFlags.Ephemeral,
  } as const;

  if (!interaction.isRepliable()) {
    return;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);

    return;
  }

  await interaction.reply(payload);
}

/**
 * Route toutes les interactions reçues par le bot.
 *
 * Les interactions propres aux fonctionnalités sont traitées avant
 * les commandes slash générales.
 *
 * Ordre actuel :
 *
 * 1. boutons de session ;
 * 2. sélection du nouvel hôte ;
 * 3. sélection du jeu ;
 * 4. modal d'édition ;
 * 5. autocomplétion ;
 * 6. commandes slash.
 *
 * Les handlers de feature retournent un booléen permettant d'indiquer
 * si l'interaction a déjà été prise en charge.
 *
 * @param interaction Interaction Discord reçue.
 */
export async function execute(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isButton()) {
      const handled = await handleSessionButton(interaction);

      if (handled) {
        return;
      }
    }

    if (interaction.isUserSelectMenu()) {
      const handled = await handleSessionHostSelect(interaction);

      if (handled) {
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      const handled = await handleSessionGameSelect(interaction);

      if (handled) {
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      const handled = await handleSessionEditModal(interaction);

      if (handled) {
        return;
      }
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
        // L'interaction a probablement expiré.
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
