import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  DATABASE_PATH,
  configureDatabase,
  initializeDatabaseSchema,
} from "../database/schema.js";

mkdirSync(dirname(DATABASE_PATH), {
  recursive: true,
});

export const db = new DatabaseSync(DATABASE_PATH, {
  timeout: 5000,
});

configureDatabase(db);
initializeDatabaseSchema(db);
