import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function getCommandFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getCommandFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function loadCommands() {
  const commandsPath = path.join(process.cwd(), "commands");
  const commandFiles = getCommandFiles(commandsPath);

  const commands = [];

  for (const filePath of commandFiles) {
    const command = await import(pathToFileURL(filePath).href);

    if (!("data" in command) || !("execute" in command)) {
      console.warn(`[WARNING] Commande invalide ignorée : ${filePath}`);
      continue;
    }

    commands.push(command);
  }

  return commands;
}
