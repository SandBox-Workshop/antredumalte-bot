import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Teste si le bot répond");

export async function execute(interaction) {
  const wsPing = interaction.client.ws.ping;

  await interaction.reply({
    content: `🏓 Pong !\n📡 WebSocket : **${wsPing} ms**`,
  });
}
