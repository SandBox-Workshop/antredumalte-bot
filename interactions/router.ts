import type { Interaction } from "discord.js";

import { handleSessionInteraction } from "../features/sessions/sessions.interactions.js";

/**
 * Contrat d'un routeur d'interactions de feature.
 *
 * Chaque feature interactive peut exposer une fonction respectant
 * cette signature afin d'être intégrée au routeur principal.
 *
 * La fonction retourne :
 *
 * - `true` lorsque l'interaction a été reconnue et traitée ;
 * - `false` lorsqu'elle ne concerne pas la feature.
 */
export type FeatureInteractionHandler = (
  interaction: Interaction,
) => boolean | Promise<boolean>;

/**
 * Liste ordonnée des features capables de traiter
 * des interactions Discord.
 *
 * Une nouvelle feature interactive doit simplement exposer
 * un `FeatureInteractionHandler` puis être ajoutée à cette liste.
 *
 * L'ordre peut devenir important si plusieurs features utilisent
 * des conventions de `customId` qui se chevauchent.
 */
const featureInteractionHandlers: FeatureInteractionHandler[] = [
  handleSessionInteraction,
];

/**
 * Route une interaction Discord vers les features enregistrées.
 *
 * Les handlers sont interrogés successivement jusqu'à ce que
 * l'un d'eux déclare avoir traité l'interaction.
 *
 * Le routeur ne connaît pas la logique interne des features :
 * il sert uniquement de point de dispatch générique entre le
 * cœur du bot et les modules fonctionnels.
 *
 * @param interaction Interaction Discord reçue.
 * @returns `true` lorsqu'une feature a pris en charge l'interaction.
 */
export async function routeFeatureInteraction(
  interaction: Interaction,
): Promise<boolean> {
  for (const handler of featureInteractionHandlers) {
    const handled = await handler(interaction);

    if (handled) {
      return true;
    }
  }

  return false;
}
