import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import { readFileSync } from "node:fs";
import { loadCommands } from "./utils/load-commands.js";

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
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    try {
      await interaction.reply({
        content: "❌ Commande inconnue.",
        flags: 64,
      });
    } catch (error) {
      console.error("Impossible de répondre à une commande inconnue :", error);
    }

    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    // 10062 = Unknown interaction / interaction expirée
    // 40060 = Interaction déjà répondue
    if (error.code === 10062 || error.code === 40060) {
      return;
    }

    const payload = {
      content: "❌ Une erreur est arrivée pendant la commande.",
      flags: 64,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      if (replyError.code === 10062 || replyError.code === 40060) {
        return;
      }

      console.error("Impossible d'envoyer le message d'erreur :", replyError);
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
