import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Commande de diagnostic minimal du bot.
 *
 * `/ping` permet de vérifier que :
 *
 * - le bot reçoit correctement les interactions Discord ;
 * - la connexion WebSocket avec Discord est active ;
 * - une réponse peut être envoyée au serveur.
 */
export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Teste si le bot répond");

/**
 * Répond avec la latence actuelle de la connexion WebSocket Discord.
 *
 * @param interaction Interaction Discord associée à `/ping`.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const wsPing = interaction.client.ws.ping;

  await interaction.reply({
    content: `🏓 Pong !\n📡 WebSocket : **${wsPing} ms**`,
  });
}
