import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Contrat minimal d'un module d'événement chargé par le bot.
 *
 * Chaque fichier présent dans `events/` doit exporter :
 *
 * - `name` : nom de l'événement Discord à écouter ;
 * - `execute` : fonction appelée lorsque l'événement est déclenché ;
 * - `once` : optionnel, indique si l'événement ne doit être exécuté qu'une fois.
 *
 * @example
 * ```ts
 * import { Events } from "discord.js";
 *
 * export const name = Events.ClientReady;
 * export const once = true;
 *
 * export function execute() {
 *   console.log("Bot prêt.");
 * }
 * ```
 */
export type EventModule = {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => unknown | Promise<unknown>;
};

/**
 * Extensions acceptées par le loader d'événements.
 *
 * Le projet étant migré progressivement vers TypeScript,
 * les anciens fichiers JavaScript et les nouveaux fichiers
 * TypeScript peuvent cohabiter.
 */
const EVENT_EXTENSIONS = new Set([".js", ".ts"]);

/**
 * Dossier des événements résolu depuis ce module plutôt que depuis
 * le dossier courant du processus. Cela garantit le chargement même
 * lorsque PM2 démarre le bot depuis un autre `cwd`.
 */
const EVENTS_DIR = fileURLToPath(new URL("../events/", import.meta.url));

/**
 * Vérifie si un fichier peut être chargé comme événement.
 *
 * Les fichiers de déclaration TypeScript (`.d.ts`) sont exclus,
 * car ils ne contiennent aucun code exécutable à charger.
 *
 * @param fileName Nom du fichier à vérifier.
 * @returns `true` si le fichier peut contenir un événement.
 */
function isEventFile(fileName: string): boolean {
  if (fileName.endsWith(".d.ts")) {
    return false;
  }

  return EVENT_EXTENSIONS.has(path.extname(fileName));
}

/**
 * Recherche récursivement les fichiers d'événements.
 *
 * Le parcours récursif permet d'organiser librement le dossier
 * `events/` en sous-dossiers sans devoir modifier le loader.
 *
 * @param directory Dossier à parcourir.
 * @returns Chemins absolus des fichiers d'événements trouvés.
 */
function getEventFiles(directory: string): string[] {
  const entries = readdirSync(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...getEventFiles(fullPath));

      continue;
    }

    if (entry.isFile() && isEventFile(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Vérifie à l'exécution qu'une valeur respecte le contrat `EventModule`.
 *
 * Cette validation reste nécessaire même avec TypeScript, car les modules
 * sont découverts et importés dynamiquement depuis le système de fichiers.
 *
 * Le type guard permet également à TypeScript de considérer la valeur
 * comme un `EventModule` après validation.
 *
 * @param value Valeur retournée par l'import dynamique.
 * @returns `true` si la valeur représente un module d'événement valide.
 */
function isValidEventModule(value: unknown): value is EventModule {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;

  return typeof event.name === "string" && typeof event.execute === "function";
}

/**
 * Charge tous les événements présents dans le dossier `events/`.
 *
 * Le chargement suit les étapes suivantes :
 *
 * 1. découverte récursive des fichiers `.js` et `.ts` ;
 * 2. import dynamique de chaque fichier ;
 * 3. validation du contrat `EventModule` ;
 * 4. exclusion des modules invalides avec un avertissement ;
 * 5. retour des événements prêts à être enregistrés sur le client Discord.
 *
 * Le support simultané de JavaScript et TypeScript permet de migrer
 * progressivement le projet sans devoir convertir tous les fichiers
 * existants en une seule opération.
 *
 * @returns Liste des événements valides découverts dans `events/`.
 */
export async function loadEvents(): Promise<EventModule[]> {
  const eventFiles = getEventFiles(EVENTS_DIR);

  const events: EventModule[] = [];

  for (const filePath of eventFiles) {
    const importedModule: unknown = await import(pathToFileURL(filePath).href);

    if (!isValidEventModule(importedModule)) {
      console.warn(`[WARNING] Event invalide ignoré : ${filePath}`);

      continue;
    }

    events.push({
      name: importedModule.name,
      once: importedModule.once === true,
      execute: importedModule.execute,
    });
  }

  return events;
}
