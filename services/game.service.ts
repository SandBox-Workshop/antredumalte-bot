import { readFileSync, writeFileSync } from "node:fs";

import * as GameDigPackage from "gamedig";

/**
 * Représente un jeu connu du bot.
 */
export type Game = {
  /**
   * Identifiant technique unique du jeu.
   *
   * Lorsque GameDig supporte le jeu, cet identifiant correspond
   * directement au Type ID GameDig.
   *
   * Sinon, un identifiant local est généré depuis le nom.
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

type GameDigDefinition = {
  name?: unknown;
};

type GameDigRegistry = Record<string, GameDigDefinition>;

export type GameIdSource = "gamedig" | "generated";

export type AddGameResult =
  | {
      ok: true;
      game: Game;
      idSource: GameIdSource;
    }
  | {
      ok: false;
      reason: "duplicate-name" | "duplicate-id";
      game: Game;
    };

/**
 * Emplacement du catalogue de jeux.
 *
 * Le chemin est résolu relativement au module afin de ne pas
 * dépendre du répertoire courant du processus.
 */
const GAMES_FILE = new URL("../data/games.json", import.meta.url);

/**
 * GameDig 5 expose son registre de jeux via `games`.
 *
 * Les types DefinitelyTyped peuvent être légèrement en retard
 * sur la version runtime de GameDig, d'où la validation locale.
 */
const GAMEDIG_GAMES: GameDigRegistry =
  (
    GameDigPackage as unknown as {
      games?: GameDigRegistry;
    }
  ).games ?? {};

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
 * Normalise un nom pour permettre des comparaisons fiables.
 *
 * Les différences de casse, accents, ponctuation et espaces
 * sont volontairement ignorées.
 */
function normalizeGameName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Génère un identifiant local lorsqu'un jeu n'est pas connu de GameDig.
 */
function createGameSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  if (!slug) {
    throw new Error(
      "Impossible de générer un identifiant technique pour ce jeu.",
    );
  }

  return slug;
}

/**
 * Recherche le Type ID GameDig correspondant exactement au nom fourni.
 *
 * La comparaison ignore la casse et la ponctuation afin que des variantes
 * simples d'écriture restent reconnues sans effectuer de fuzzy matching
 * potentiellement dangereux.
 */
function findGameDigIdByName(name: string): string | null {
  const normalizedName = normalizeGameName(name);

  const matches = Object.entries(GAMEDIG_GAMES).filter(
    ([, definition]) =>
      typeof definition.name === "string" &&
      normalizeGameName(definition.name) === normalizedName,
  );

  if (matches.length !== 1) {
    return null;
  }

  return matches[0]?.[0] ?? null;
}

/**
 * Lit et valide le catalogue de jeux.
 *
 * Le fichier est relu à chaque appel. Une modification de `games.json`
 * est donc immédiatement visible sans cache applicatif.
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
 * Réécrit le catalogue complet.
 *
 * L'écriture est synchrone afin que deux commandes Discord ne puissent pas
 * effectuer simultanément un read-modify-write sur le même fichier.
 */
function writeGames(games: Game[]): void {
  writeFileSync(GAMES_FILE, `${JSON.stringify(games, null, 2)}\n`, "utf8");
}

/**
 * Ajoute un nouveau jeu au catalogue.
 *
 * Le Type ID GameDig est utilisé automatiquement lorsque le nom correspond
 * à un jeu supporté. Sinon, un identifiant local est généré depuis le nom.
 *
 * Les nouveaux jeux sont activés par défaut.
 */
export function addGame(name: string, emoji: string): AddGameResult {
  const cleanName = name.trim();
  const cleanEmoji = emoji.trim();

  if (!cleanName) {
    throw new Error("Le nom du jeu ne peut pas être vide.");
  }

  if (!cleanEmoji) {
    throw new Error("L'emoji du jeu ne peut pas être vide.");
  }

  const configuredGames = readGames();
  const normalizedName = normalizeGameName(cleanName);

  const duplicateName = configuredGames.find(
    (game) => normalizeGameName(game.name) === normalizedName,
  );

  if (duplicateName) {
    return {
      ok: false,
      reason: "duplicate-name",
      game: duplicateName,
    };
  }

  const gameDigId = findGameDigIdByName(cleanName);
  const id = gameDigId ?? createGameSlug(cleanName);

  const duplicateId = configuredGames.find(
    (game) => game.id.toLowerCase() === id.toLowerCase(),
  );

  if (duplicateId) {
    return {
      ok: false,
      reason: "duplicate-id",
      game: duplicateId,
    };
  }

  const game: Game = {
    id,
    name: cleanName,
    emoji: cleanEmoji,
    enabled: true,
  };

  writeGames([...configuredGames, game]);

  return {
    ok: true,
    game,
    idSource: gameDigId ? "gamedig" : "generated",
  };
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
