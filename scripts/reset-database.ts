import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  DATABASE_PATH,
  configureDatabase,
  createDatabaseSchema,
} from "../database/schema.js";

/**
 * Supprime complètement la base locale puis recrée le schéma courant.
 *
 * Le bot doit être arrêté avant l'exécution, particulièrement sous Windows,
 * afin qu'aucun handle SQLite/WAL ne garde les fichiers ouverts.
 */
function removeDatabaseFiles(): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${DATABASE_PATH}${suffix}`, {
      force: true,
    });
  }
}

removeDatabaseFiles();

mkdirSync(dirname(DATABASE_PATH), {
  recursive: true,
});

const database = new DatabaseSync(DATABASE_PATH, {
  timeout: 5000,
});

try {
  configureDatabase(database);
  createDatabaseSchema(database);
} finally {
  database.close();
}

console.log(`✅ Base SQLite recréée : ${DATABASE_PATH}`);
