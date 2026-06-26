import { EmbedBuilder } from "discord.js";
import { discordTime } from "../../utils/discord-time.js";
import { FAILLE_COLOR } from "./faille.constants.js";
import { getNextStartMs } from "./faille.state.js";

export function buildFailleEmbed(state, customDescription = null) {
  const now = Date.now();

  const embed = new EmbedBuilder()
    .setColor(FAILLE_COLOR)
    .setTitle("🩸 Failles V Rising")
    .setFooter({ text: "Antre du Malt • Timer manuel" })
    .setTimestamp();

  if (!state?.lastStartedAt) {
    return embed
      .setDescription(customDescription ?? "⚫ Aucune faille synchronisée.")
      .addFields({
        name: "Commande utile",
        value:
          "`/faille sync reste:9` quand tu vois une faille active avec 9 minutes restantes.",
      });
  }

  const startedMs = new Date(state.lastStartedAt).getTime();
  const endMs = new Date(state.activeEndsAt).getTime();
  const isActive = endMs > now;
  const nextStartMs = getNextStartMs(state, now);

  embed.setDescription(
    customDescription ??
      (isActive
        ? "🟢 Une faille est actuellement suivie."
        : "🟡 Aucune faille active suivie."),
  );

  embed.addFields(
    {
      name: "⏱️ Statut",
      value: isActive
        ? `Active — fin ${discordTime(endMs, "R")}\nHeure de fin : ${discordTime(endMs, "t")}`
        : "Inactive / terminée",
      inline: false,
    },
    {
      name: "🕯️ Dernière faille",
      value: `${discordTime(startedMs, "R")}\nHeure : ${discordTime(startedMs, "t")}`,
      inline: true,
    },
    {
      name: "🔁 Intervalle",
      value: `${state.intervalMinutes} min`,
      inline: true,
    },
  );

  if (nextStartMs) {
    embed.addFields({
      name: "📍 Prochaine faille estimée",
      value: `${discordTime(nextStartMs, "R")}\nHeure estimée : ${discordTime(nextStartMs, "t")}`,
      inline: false,
    });
  }

  if (state.updatedBy) {
    embed.addFields({
      name: "👤 Dernière synchro",
      value: `<@${state.updatedBy}>`,
      inline: true,
    });
  }

  return embed;
}

export function buildFailleResetEmbed() {
  return new EmbedBuilder()
    .setColor(FAILLE_COLOR)
    .setTitle("🩸 Failles V Rising")
    .setDescription("🧹 Timer de faille réinitialisé.")
    .setFooter({ text: "Antre du Malt • Timer manuel" })
    .setTimestamp();
}
