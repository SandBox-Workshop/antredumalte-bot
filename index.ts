import { Client, Collection, GatewayIntentBits } from "discord.js";

import { loadAppConfig } from "./config/app-config.js";
import type { BotClient } from "./types/client.js";
import { loadCommands } from "./utils/load-commands.js";
import { loadEvents } from "./utils/load-events.js";

const config = loadAppConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
}) as BotClient;

client.commands = new Collection();

const commands = await loadCommands();

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

console.log(`✅ ${client.commands.size} commande(s) chargée(s).`);

const events = await loadEvents();

for (const event of events) {
  if (event.once) {
    client.once(event.name, event.execute);

    continue;
  }

  client.on(event.name, event.execute);
}

console.log(`✅ ${events.length} event(s) chargé(s).`);

/**
 * Capture les promesses rejetées qui n'ont pas été gérées
 * explicitement par le code applicatif.
 */
process.on("unhandledRejection", (error) => {
  console.error("Promesse rejetée non gérée :", error);
});

/**
 * Capture les erreurs synchrones qui atteignent le niveau
 * global du processus.
 */
process.on("uncaughtException", (error) => {
  console.error("Erreur non capturée :", error);
});

await client.login(config.token);
