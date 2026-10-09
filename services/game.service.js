import { readFileSync } from "node:fs";

const gamesFile = new URL("../data/games.json", import.meta.url);

function readGames() {
  return JSON.parse(readFileSync(gamesFile, "utf8"));
}

export function getAllGames() {
  return readGames();
}

export function getEnabledGames() {
  return readGames().filter((game) => game.enabled);
}

export function getGameById(id) {
  if (!id) {
    return null;
  }

  const normalizedId = id.toLowerCase();

  return (
    readGames().find((game) => game.id.toLowerCase() === normalizedId) ?? null
  );
}

export function searchEnabledGames(query = "") {
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
