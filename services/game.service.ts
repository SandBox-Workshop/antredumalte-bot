import { readFileSync } from "node:fs";

/**
 * Représente un jeu connu du bot.
 */
export type Game = {
  /**
   * Identifiant technique unique du jeu.
   *
   * @example "deep-rock-galactic"
   */
  id: string;

  /**
   * Nom affiché aux utilisateurs.
   *
   * @example "Deep Rock Galactic"
   */
  name: string;

  /**
   * Emoji utilisé dans les interfaces Discord.
   */
  emoji: string;

  /**
   * Indique si le jeu peut actuellement être sélectionné
   * dans les fonctionnalités générales du bot.
   */
  enabled: boolean;
};

/**
 * Emplacement du catalogue de jeux.
 *
 * Le chemin est résolu relativement au module afin de ne pas
 * dépendre du répertoire courant du processus.
 */
const GAMES_FILE = new URL("../data/games.json", import.meta.url);

/**
 * Vérifie qu'une valeur représente un jeu valide.
 *
 * La validation runtime reste nécessaire car le contenu de
 * `games.json` est externe au système de types TypeScript.
 *
 * @param value Valeur à vérifier.
 */
function isGame(value: unknown): value is Game {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const game = value as Record<string, unknown>;

  return (
    typeof game.id === "string" &&
    game.id.trim().length > 0 &&
    typeof game.name === "string" &&
    game.name.trim().length > 0 &&
    typeof game.emoji === "string" &&
    typeof game.enabled === "boolean"
  );
}

/**
 * Lit et valide le catalogue de jeux.
 *
 * Le fichier est relu à chaque appel, comme dans l'implémentation
 * historique du service. Une modification de `games.json` peut donc
 * être prise en compte sans maintenir de cache applicatif.
 *
 * @returns Liste complète des jeux configurés.
 * @throws Error si `games.json` ne contient pas un tableau valide.
 */
function readGames(): Game[] {
  const parsed: unknown = JSON.parse(readFileSync(GAMES_FILE, "utf8"));

  if (!Array.isArray(parsed) || !parsed.every(isGame)) {
    throw new Error(
      "data/games.json invalide : chaque jeu doit contenir id, name, emoji et enabled.",
    );
  }

  return parsed;
}

/**
 * Retourne tous les jeux configurés.
 */
export function getAllGames(): Game[] {
  return readGames();
}

/**
 * Retourne uniquement les jeux actuellement activés.
 */
export function getEnabledGames(): Game[] {
  return readGames().filter((game) => game.enabled);
}

/**
 * Recherche un jeu à partir de son identifiant.
 *
 * La comparaison est insensible à la casse.
 *
 * @param id Identifiant technique du jeu.
 * @returns Jeu correspondant ou `null` s'il n'existe pas.
 */
export function getGameById(id: string | null | undefined): Game | null {
  if (!id) {
    return null;
  }

  const normalizedId = id.toLowerCase();

  return (
    readGames().find((game) => game.id.toLowerCase() === normalizedId) ?? null
  );
}

/**
 * Recherche parmi les jeux activés.
 *
 * La recherche s'effectue sur l'identifiant et le nom du jeu,
 * sans tenir compte de la casse. Discord limite l'autocomplétion
 * à 25 propositions, donc le résultat est également limité à 25.
 *
 * @param query Texte recherché.
 * @returns Jeux activés correspondant à la recherche.
 */
export function searchEnabledGames(query = ""): Game[] {
  const normalizedQuery = query.trim().toLowerCase();

  return getEnabledGames()
    .filter((game) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        game.id.toLowerCase().includes(normalizedQuery) ||
        game.name.toLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, 25);
}
