import { Client, Collection, GatewayIntentBits } from "discord.js";

import { readFileSync } from "node:fs";

import { loadCommands } from "./utils/load-commands.js";
import { loadEvents } from "./utils/load-events.ts";

const config = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url), "utf8"),
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

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

process.on("unhandledRejection", (error) => {
  console.error("Promesse rejetée non gérée :", error);
});

process.on("uncaughtException", (error) => {
  console.error("Erreur non capturée :", error);
});

await client.login(config.token);
