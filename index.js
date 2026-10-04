import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";

import { readFileSync } from "node:fs";

import { loadCommands } from "./utils/load-commands.js";

import {
  handleSessionButton,
  handleSessionHostSelect,
} from "./features/sessions/sessions.buttons.js";

const config = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url), "utf8"),
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandModules = await loadCommands();

for (const command of commandModules) {
  client.commands.set(command.data.name, command);
}

console.log(`✅ ${client.commands.size} commande(s) chargée(s).`);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot connecté en tant que ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      const handled = await handleSessionButton(interaction);

      if (handled) {
        return;
      }
    }

    if (interaction.isUserSelectMenu()) {
      const handled = await handleSessionHostSelect(interaction);

      if (handled) {
        return;
      }
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        await interaction.respond([]);
        return;
      }

      if ("autocomplete" in command) {
        await command.autocomplete(interaction);
      } else {
        await interaction.respond([]);
      }

      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({
        content: "❌ Commande inconnue.",
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (error.code === 10062 || error.code === 40060) {
      return;
    }

    if (interaction.isAutocomplete()) {
      try {
        await interaction.respond([]);
      } catch {
        // L'interaction a probablement expiré.
      }

      return;
    }

    const payload = {
      content: "❌ Une erreur est arrivée pendant l'interaction.",
      flags: MessageFlags.Ephemeral,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      if (replyError.code !== 10062 && replyError.code !== 40060) {
        console.error("Impossible d'envoyer le message d'erreur :", replyError);
      }
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Erreur client Discord :", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Promesse rejetée non gérée :", error);
});

process.on("uncaughtException", (error) => {
  console.error("Erreur non capturée :", error);
});

await client.login(config.token);
