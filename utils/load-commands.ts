import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { BotCommand } from "../types/command.js";

/**
 * Extensions acceptées par le loader de commandes.
 *
 * Le projet étant migré progressivement vers TypeScript,
 * les commandes JavaScript existantes et les futures commandes
 * TypeScript peuvent cohabiter.
 */
const COMMAND_EXTENSIONS = new Set([".js", ".ts"]);

/**
 * Dossier des commandes résolu depuis ce module plutôt que depuis
 * le dossier courant du processus. Cela évite qu'un lancement via
 * PM2 depuis un autre `cwd` casse la découverte des commandes.
 */
const COMMANDS_DIR = fileURLToPath(new URL("../commands/", import.meta.url));

/**
 * Vérifie si un fichier peut contenir une commande exécutable.
 *
 * Les déclarations TypeScript (`.d.ts`) sont volontairement ignorées,
 * car elles ne contiennent aucun code à charger à l'exécution.
 *
 * @param fileName Nom du fichier à vérifier.
 * @returns `true` lorsque le fichier peut être chargé comme commande.
 */
function isCommandFile(fileName: string): boolean {
  if (fileName.endsWith(".d.ts")) {
    return false;
  }

  return COMMAND_EXTENSIONS.has(path.extname(fileName));
}

/**
 * Recherche récursivement les fichiers de commandes.
 *
 * Le parcours récursif permet de conserver une organisation métier :
 *
 * ```text
 * commands/
 * ├── general/
 * └── vrising/
 * ```
 *
 * De nouveaux sous-dossiers peuvent être ajoutés sans modifier
 * le fonctionnement du loader.
 *
 * @param directory Dossier à parcourir.
 * @returns Chemins absolus des fichiers de commandes découverts.
 */
function getCommandFiles(directory: string): string[] {
  const entries = readdirSync(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...getCommandFiles(fullPath));

      continue;
    }

    if (entry.isFile() && isCommandFile(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Vérifie qu'une valeur importée respecte le contrat `BotCommand`.
 *
 * Les modules étant chargés dynamiquement depuis le système de fichiers,
 * TypeScript ne peut pas garantir leur structure à la compilation.
 * Une validation runtime reste donc nécessaire.
 *
 * Le contrôle porte sur les éléments réellement utilisés par le bot :
 *
 * - `data.name` ;
 * - `data.toJSON()` ;
 * - `execute()` ;
 * - `autocomplete()`, lorsqu'elle existe.
 *
 * @param value Module importé dynamiquement.
 * @returns `true` lorsque le module représente une commande valide.
 */
function isValidCommandModule(value: unknown): value is BotCommand {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const command = value as Record<string, unknown>;

  if (typeof command.data !== "object" || command.data === null) {
    return false;
  }

  const data = command.data as Record<string, unknown>;

  if (
    typeof data.name !== "string" ||
    typeof data.toJSON !== "function" ||
    typeof command.execute !== "function"
  ) {
    return false;
  }

  if (
    command.autocomplete !== undefined &&
    typeof command.autocomplete !== "function"
  ) {
    return false;
  }

  return true;
}

/**
 * Charge toutes les commandes présentes dans `commands/`.
 *
 * Le chargement suit les étapes suivantes :
 *
 * 1. découverte récursive des fichiers `.js` et `.ts` ;
 * 2. import dynamique de chaque module ;
 * 3. validation du contrat `BotCommand` ;
 * 4. exclusion des modules invalides avec un avertissement ;
 * 5. retour des commandes prêtes à être enregistrées.
 *
 * Le même loader est utilisé au démarrage du bot et lors du
 * déploiement des slash commands. Cela garantit que les deux
 * mécanismes utilisent exactement les mêmes commandes.
 *
 * @returns Liste des commandes valides découvertes dans `commands/`.
 */
export async function loadCommands(): Promise<BotCommand[]> {
  const commandFiles = getCommandFiles(COMMANDS_DIR);

  const commands: BotCommand[] = [];

  for (const filePath of commandFiles) {
    const importedModule: unknown = await import(pathToFileURL(filePath).href);

    if (!isValidCommandModule(importedModule)) {
      console.warn(`[WARNING] Commande invalide ignorée : ${filePath}`);

      continue;
    }

    commands.push(importedModule);
  }

  return commands;
}
