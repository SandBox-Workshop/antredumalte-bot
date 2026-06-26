import { REST, Routes } from "discord.js";
import { readFileSync } from "node:fs";
import { loadCommands } from "./utils/load-commands.js";

const config = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url), "utf8"),
);

const commandModules = await loadCommands();
const commands = commandModules.map((command) => command.data.toJSON());

const rest = new REST().setToken(config.token);

try {
  console.log(`🔄 Déploiement de ${commands.length} commande(s)...`);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands },
  );

  console.log("✅ Slash commands déployées avec succès.");
} catch (error) {
  console.error("❌ Erreur pendant le déploiement :", error);
}
