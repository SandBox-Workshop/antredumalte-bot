import { SlashCommandBuilder } from "discord.js";
import {
  getChassesRange,
  readSheetValues,
} from "../../services/google-sheets.service.js";
import { buildChassesEmbed } from "../../features/chasses/chasses.embed.js";
import { mapChassesRows } from "../../features/chasses/chasses.mapper.js";

export const data = new SlashCommandBuilder()
  .setName("chasses")
  .setDescription("Affiche les serviteurs actuellement en chasse");

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const values = await readSheetValues(getChassesRange());
    const chasses = mapChassesRows(values);
    const embed = buildChassesEmbed(chasses);

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    console.error(error);

    await interaction.editReply({
      content: `❌ Impossible de récupérer les chasses depuis Google Sheets.\nErreur : \`${error.message}\``,
    });
  }
}
