import { SlashCommandBuilder } from "discord.js";
import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_INTERVAL_MINUTES,
} from "../../features/faille/faille.constants.js";
import {
  buildFailleEmbed,
  buildFailleResetEmbed,
} from "../../features/faille/faille.embed.js";
import { notifyFailleSubscribers } from "../../features/faille/faille.notifications.js";
import {
  clearFailleState,
  createStartState,
  createSyncState,
  readFailleState,
  writeFailleState,
} from "../../features/faille/faille.state.js";
import {
  readFailleSubscribers,
  subscribeFailleUser,
  unsubscribeFailleUser,
} from "../../features/faille/faille.subscribers.js";

export const data = new SlashCommandBuilder()
  .setName("faille")
  .setDescription("Gère le timer manuel des failles V Rising")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("status")
      .setDescription("Affiche l'état actuel du timer de faille"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("start")
      .setDescription("Démarre une faille maintenant")
      .addIntegerOption((option) =>
        option
          .setName("duree")
          .setDescription("Durée de la faille en minutes")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(180),
      )
      .addIntegerOption((option) =>
        option
          .setName("intervalle")
          .setDescription("Intervalle entre deux failles en minutes")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(1440),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("sync")
      .setDescription(
        "Synchronise une faille déjà active avec le temps restant",
      )
      .addIntegerOption((option) =>
        option
          .setName("reste")
          .setDescription("Temps restant affiché en jeu, en minutes")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(180),
      )
      .addIntegerOption((option) =>
        option
          .setName("duree")
          .setDescription("Durée totale de la faille en minutes")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(180),
      )
      .addIntegerOption((option) =>
        option
          .setName("intervalle")
          .setDescription("Intervalle entre deux failles en minutes")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(1440),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stop")
      .setDescription("Réinitialise le timer de faille"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("abo")
      .setDescription("S'abonner aux alertes de faille")
      .addStringOption((option) =>
        option
          .setName("mode")
          .setDescription("Choisis comment recevoir les alertes")
          .setRequired(true)
          .addChoices(
            { name: "MP privé", value: "mp" },
            { name: "Ping dans le salon", value: "ping" },
          ),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("abo-off")
      .setDescription("Se désabonner des alertes de faille"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("abo-list")
      .setDescription("Voir les abonnés aux alertes de faille"),
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "status") {
    const state = await readFailleState();

    await interaction.editReply({
      embeds: [buildFailleEmbed(state)],
    });

    return;
  }

  if (subcommand === "start") {
    const durationMinutes =
      interaction.options.getInteger("duree") ?? DEFAULT_DURATION_MINUTES;

    const intervalMinutes =
      interaction.options.getInteger("intervalle") ?? DEFAULT_INTERVAL_MINUTES;

    const state = createStartState({
      durationMinutes,
      intervalMinutes,
      userId: interaction.user.id,
    });

    await writeFailleState(state);

    const embed = buildFailleEmbed(
      state,
      `🟢 Faille démarrée maintenant pour **${durationMinutes} min**.`,
    );

    await interaction.editReply({ embeds: [embed] });

    await notifyFailleSubscribers({
      client: interaction.client,
      channel: interaction.channel,
      state,
      reason: `🟢 Une faille vient d'être démarrée par <@${interaction.user.id}>.`,
    });

    return;
  }

  if (subcommand === "sync") {
    const remainingMinutes = interaction.options.getInteger("reste");

    const durationMinutes =
      interaction.options.getInteger("duree") ?? DEFAULT_DURATION_MINUTES;

    const intervalMinutes =
      interaction.options.getInteger("intervalle") ?? DEFAULT_INTERVAL_MINUTES;

    const state = createSyncState({
      remainingMinutes,
      durationMinutes,
      intervalMinutes,
      userId: interaction.user.id,
    });

    await writeFailleState(state);

    const embed = buildFailleEmbed(
      state,
      `🟢 Faille synchronisée : il reste **${remainingMinutes} min**.`,
    );

    await interaction.editReply({ embeds: [embed] });

    await notifyFailleSubscribers({
      client: interaction.client,
      channel: interaction.channel,
      state,
      reason: `🟢 Faille synchronisée par <@${interaction.user.id}> : il reste **${remainingMinutes} min**.`,
    });

    return;
  }

  if (subcommand === "stop") {
    await clearFailleState();

    await interaction.editReply({
      embeds: [buildFailleResetEmbed()],
    });

    return;
  }

  if (subcommand === "abo") {
    const mode = interaction.options.getString("mode");

    await subscribeFailleUser(interaction.user, mode);

    await interaction.editReply({
      content:
        mode === "mp"
          ? "✅ Tu es abonné aux alertes de faille en **MP privé**."
          : "✅ Tu es abonné aux alertes de faille en **ping dans le salon**.",
    });

    return;
  }

  if (subcommand === "abo-off") {
    await unsubscribeFailleUser(interaction.user.id);

    await interaction.editReply({
      content: "✅ Tu es désabonné des alertes de faille.",
    });

    return;
  }

  if (subcommand === "abo-list") {
    const subscribers = await readFailleSubscribers();
    const entries = Object.entries(subscribers.users);

    if (entries.length === 0) {
      await interaction.editReply({
        content: "Aucun abonné aux alertes de faille pour le moment.",
      });

      return;
    }

    const lines = entries.map(([userId, data]) => {
      const mode = data.mode === "mp" ? "MP" : "Ping salon";
      return `• <@${userId}> — ${mode}`;
    });

    await interaction.editReply({
      content: `🩸 **Abonnés aux failles**\n${lines.join("\n")}`,
      allowedMentions: {
        users: [],
      },
    });

    return;
  }

  await interaction.editReply({
    content: "❌ Sous-commande inconnue.",
  });
}
