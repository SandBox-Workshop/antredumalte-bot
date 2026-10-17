import type { Interaction } from "discord.js";

import {
  handleSessionButton,
  handleSessionEditModal,
  handleSessionGameSelect,
  handleSessionHostSelect,
} from "./sessions.buttons.js";

/**
 * Préfixe réservé aux composants interactifs de la feature sessions.
 *
 * Tous les boutons, menus et modals associés à une session utilisent
 * un `customId` commençant par `session:`.
 */
const SESSION_CUSTOM_ID_PREFIX = "session:";

/**
 * Vérifie qu'un `customId` appartient à la feature sessions.
 *
 * Cette vérification évite d'envoyer inutilement toutes les interactions
 * Discord vers les handlers spécifiques aux sessions.
 *
 * @param customId Identifiant Discord du composant interactif.
 * @returns `true` lorsque le composant appartient aux sessions.
 */
function isSessionCustomId(customId: string): boolean {
  return customId.startsWith(SESSION_CUSTOM_ID_PREFIX);
}

/**
 * Route une interaction Discord vers le handler approprié
 * de la feature sessions.
 *
 * Ce module constitue la frontière entre le cœur générique du bot
 * et l'implémentation spécifique des sessions.
 *
 * Les interactions actuellement prises en charge sont :
 *
 * - boutons de session ;
 * - sélection du nouvel hôte ;
 * - sélection du jeu ;
 * - modal de modification.
 *
 * Les slash commands et leur autocomplétion restent gérées par
 * le système générique de commandes.
 *
 * @param interaction Interaction Discord reçue.
 * @returns `true` si l'interaction a été traitée par la feature.
 */
export async function handleSessionInteraction(
  interaction: Interaction,
): Promise<boolean> {
  if (interaction.isButton()) {
    if (!isSessionCustomId(interaction.customId)) {
      return false;
    }

    return handleSessionButton(interaction);
  }

  if (interaction.isUserSelectMenu()) {
    if (!isSessionCustomId(interaction.customId)) {
      return false;
    }

    return handleSessionHostSelect(interaction);
  }

  if (interaction.isStringSelectMenu()) {
    if (!isSessionCustomId(interaction.customId)) {
      return false;
    }

    return handleSessionGameSelect(interaction);
  }

  if (interaction.isModalSubmit()) {
    if (!isSessionCustomId(interaction.customId)) {
      return false;
    }

    return handleSessionEditModal(interaction);
  }

  return false;
}
