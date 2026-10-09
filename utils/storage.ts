import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import path from "node:path";

/**
 * Dossier principal utilisé pour les données persistantes
 * stockées localement par le bot.
 */
export const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Lit et parse un fichier JSON.
 *
 * Si le fichier n'existe pas, n'est pas lisible ou contient
 * un JSON invalide, la valeur de fallback est retournée.
 *
 * @typeParam T Structure attendue du contenu JSON.
 * @param filePath Chemin du fichier à lire.
 * @param fallbackValue Valeur retournée en cas d'échec.
 * @returns Contenu JSON parsé ou valeur de fallback.
 */
export async function readJson<T>(
  filePath: string,
  fallbackValue: T,
): Promise<T>;

/**
 * Variante sans fallback explicite.
 *
 * Retourne `null` lorsque le fichier ne peut pas être lu ou parsé.
 */
export async function readJson<T>(
  filePath: string,
  fallbackValue?: null,
): Promise<T | null>;

export async function readJson<T>(
  filePath: string,
  fallbackValue: T | null = null,
): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");

    return JSON.parse(raw) as T;
  } catch {
    return fallbackValue;
  }
}

/**
 * Sérialise une valeur au format JSON et l'écrit sur le disque.
 *
 * Le dossier parent est créé automatiquement lorsqu'il n'existe pas.
 * Le JSON est indenté sur deux espaces afin de rester lisible
 * lorsqu'il est consulté manuellement.
 *
 * @param filePath Chemin du fichier à écrire.
 * @param data Données à sérialiser.
 */
export async function writeJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });

  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Supprime un fichier s'il existe.
 *
 * L'option `force` évite de lever une erreur lorsque le fichier
 * est déjà absent.
 *
 * @param filePath Chemin du fichier à supprimer.
 */
export async function deleteFile(filePath: string): Promise<void> {
  await rm(filePath, {
    force: true,
  });
}
