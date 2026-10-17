import { GameDig } from "gamedig";

import { loadAppConfig } from "../config/app-config.js";

/**
 * Options disponibles lors d'une requête vers le serveur V Rising.
 *
 * Les informations détaillées sur les joueurs et les règles sont
 * désactivées par défaut afin de ne les demander que lorsqu'elles
 * sont réellement nécessaires.
 */
export type QueryVRisingOptions = {
  /**
   * Demande à GameDig de récupérer la liste des joueurs.
   *
   * @default false
   */
  requestPlayers?: boolean;

  /**
   * Demande à GameDig de récupérer les règles exposées
   * par le serveur.
   *
   * @default false
   */
  requestRules?: boolean;
};

/**
 * Type officiel des options acceptées par `GameDig.query`.
 *
 * Il est dérivé directement de la signature de la librairie afin
 * de rester synchronisé avec les définitions fournies par GameDig.
 */
type GameDigQueryOptions = Parameters<typeof GameDig.query>[0];

/**
 * Extension locale des types GameDig.
 *
 * GameDig 5.3.x prend en charge ces options à l'exécution,
 * mais la version actuelle de `@types/gamedig` ne les déclare
 * pas encore.
 *
 * On complète donc uniquement les propriétés réellement utilisées
 * par le bot plutôt que de désactiver le typage avec `any`.
 */
type VRisingGameDigOptions = GameDigQueryOptions & {
  requestPlayers?: boolean;
  requestRules?: boolean;
  requestPlayersRequired?: boolean;
  requestRulesRequired?: boolean;
};

const config = loadAppConfig();

/**
 * Interroge le serveur V Rising configuré dans `config/config.json`.
 *
 * Les paramètres réseau historiques du bot sont volontairement
 * conservés afin que la migration TypeScript ne modifie pas
 * le comportement des requêtes GameDig.
 *
 * @param options Options facultatives de la requête.
 * @returns Résultat retourné par GameDig pour le serveur V Rising.
 */
export async function queryVRising({
  requestPlayers = false,
  requestRules = false,
}: QueryVRisingOptions = {}) {
  const queryOptions: VRisingGameDigOptions = {
    type: "vrising",
    host: config.vrising.host,
    port: config.vrising.queryPort,
    givenPortOnly: true,

    socketTimeout: 8000,
    attemptTimeout: 20000,
    maxRetries: 1,

    requestPlayers,
    requestRules,

    requestPlayersRequired: false,
    requestRulesRequired: false,
  };

  return GameDig.query(queryOptions);
}
