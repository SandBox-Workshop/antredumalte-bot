import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { backup, DatabaseSync } from "node:sqlite";

const RETENTION_DAYS = 14;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

const DATABASE_PATH = fileURLToPath(
  new URL("../data/yolo.sqlite", import.meta.url),
);

const GAMES_PATH = fileURLToPath(
  new URL("../data/games.json", import.meta.url),
);

const BACKUP_ROOT =
  process.env.ANTREDUMALTE_BACKUP_DIR ??
  join(homedir(), "antredumalte-backups");

function createBackupDirectoryName(date: Date): string {
  return date
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function validateGamesFile(): void {
  const content = readFileSync(GAMES_PATH, "utf8");
  const parsed: unknown = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "data/games.json invalide : le fichier doit contenir un tableau.",
    );
  }
}

function verifyDatabaseBackup(databasePath: string): void {
  const backupDb = new DatabaseSync(databasePath, {
    readOnly: true,
  });

  try {
    const row = backupDb.prepare("PRAGMA integrity_check;").get() as
      | { integrity_check?: unknown }
      | undefined;

    if (row?.integrity_check !== "ok") {
      throw new Error(
        `Le contrôle d'intégrité SQLite a échoué : ${String(
          row?.integrity_check ?? "résultat inconnu",
        )}`,
      );
    }
  } finally {
    backupDb.close();
  }
}

function removeExpiredBackups(now: Date): number {
  if (!existsSync(BACKUP_ROOT)) {
    return 0;
  }

  const threshold = now.getTime() - RETENTION_MS;
  let removed = 0;

  for (const entry of readdirSync(BACKUP_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directoryPath = join(BACKUP_ROOT, entry.name);
    const stats = statSync(directoryPath);

    if (stats.mtimeMs >= threshold) {
      continue;
    }

    rmSync(directoryPath, {
      recursive: true,
      force: true,
    });

    removed += 1;
  }

  return removed;
}

async function main(): Promise<void> {
  const now = new Date();

  if (!existsSync(DATABASE_PATH)) {
    throw new Error(`Base SQLite introuvable : ${DATABASE_PATH}`);
  }

  if (!existsSync(GAMES_PATH)) {
    throw new Error(`Catalogue de jeux introuvable : ${GAMES_PATH}`);
  }

  validateGamesFile();

  mkdirSync(BACKUP_ROOT, {
    recursive: true,
  });

  const backupDirectory = join(BACKUP_ROOT, createBackupDirectoryName(now));

  mkdirSync(backupDirectory, {
    recursive: false,
  });

  const databaseBackupPath = join(backupDirectory, "yolo.sqlite");
  const gamesBackupPath = join(backupDirectory, "games.json");
  const metadataPath = join(backupDirectory, "backup.json");

  const sourceDb = new DatabaseSync(DATABASE_PATH, {
    timeout: 5000,
  });

  try {
    await backup(sourceDb, databaseBackupPath);
  } finally {
    sourceDb.close();
  }

  verifyDatabaseBackup(databaseBackupPath);
  copyFileSync(GAMES_PATH, gamesBackupPath);

  writeFileSync(
    metadataPath,
    `${JSON.stringify(
      {
        createdAt: now.toISOString(),
        retentionDays: RETENTION_DAYS,
        files: ["yolo.sqlite", "games.json"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const removed = removeExpiredBackups(now);

  console.log(`[backup] Sauvegarde créée : ${backupDirectory}`);
  console.log("[backup] SQLite : intégrité OK");
  console.log("[backup] games.json : sauvegardé");
  console.log(
    `[backup] Rotation : ${removed} sauvegarde(s) de plus de ${RETENTION_DAYS} jours supprimée(s).`,
  );
}

main().catch((error: unknown) => {
  console.error("[backup] Échec de la sauvegarde.", error);
  process.exitCode = 1;
});
