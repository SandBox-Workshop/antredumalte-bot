import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  UserSelectMenuBuilder,
} from "discord.js";

import {
  buildCancelledSessionEmbed,
  buildSessionEmbed,
} from "./sessions.embed.js";

import {
  cancelSession,
  getSession,
  joinSession,
  leaveSession,
  maybeSession,
  transferSessionHost,
} from "./sessions.state.js";

export function buildSessionButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("session:join")
      .setLabel("Rejoindre")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("session:maybe")
      .setLabel("Peut-être")
      .setEmoji("🤔")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("session:leave")
      .setLabel("Quitter")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("session:transfer")
      .setLabel("Changer d'hôte")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("session:cancel")
      .setLabel("Annuler")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildHostSelect(messageId) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`session:transfer:${messageId}`)
      .setPlaceholder("Choisir le nouvel hôte")
      .setMinValues(1)
      .setMaxValues(1),
  );
}

export async function handleSessionButton(interaction) {
  if (!interaction.customId.startsWith("session:")) {
    return false;
  }

  const messageId = interaction.message.id;
  const userId = interaction.user.id;

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.reply({
      content:
        "❌ Cette session n'est plus disponible. Le bot a peut-être redémarré.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const action = interaction.customId.split(":")[1];

  if (
    userId === currentSession.creatorId &&
    (action === "leave" || action === "maybe")
  ) {
    await interaction.reply({
      content:
        "👑 Tu es l'hôte de cette session. Transfère d'abord l'hôte à quelqu'un d'autre ou annule la session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  switch (action) {
    case "join": {
      const session = joinSession(messageId, userId);

      const embed = buildSessionEmbed(session);

      await interaction.update({
        embeds: [embed],
        components: [buildSessionButtons()],
      });

      return true;
    }

    case "maybe": {
      const session = maybeSession(messageId, userId);

      const embed = buildSessionEmbed(session);

      await interaction.update({
        embeds: [embed],
        components: [buildSessionButtons()],
      });

      return true;
    }

    case "leave": {
      const session = leaveSession(messageId, userId);

      const embed = buildSessionEmbed(session);

      await interaction.update({
        embeds: [embed],
        components: [buildSessionButtons()],
      });

      return true;
    }

    case "transfer": {
      if (userId !== currentSession.creatorId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut transférer la session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      if (currentSession.participants.size <= 1) {
        await interaction.reply({
          content:
            "❌ Il faut au moins un autre participant avant de pouvoir transférer l'hôte.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      await interaction.reply({
        content:
          "👑 Choisis le participant qui deviendra le nouvel hôte de la session :",
        components: [buildHostSelect(messageId)],
        flags: MessageFlags.Ephemeral,
      });

      return true;
    }

    case "cancel": {
      if (userId !== currentSession.creatorId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut annuler cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      const cancelledSession = cancelSession(messageId);

      const embed = buildCancelledSessionEmbed(cancelledSession);

      await interaction.update({
        embeds: [embed],
        components: [],
      });

      return true;
    }

    default:
      return false;
  }
}

export async function handleSessionHostSelect(interaction) {
  if (!interaction.customId.startsWith("session:transfer:")) {
    return false;
  }

  const messageId = interaction.customId.split(":")[2];
  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.update({
      content: "❌ Cette session n'existe plus.",
      components: [],
    });

    return true;
  }

  if (interaction.user.id !== currentSession.creatorId) {
    await interaction.update({
      content: "❌ Tu n'es plus l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  const newHostId = interaction.values[0];

  if (newHostId === currentSession.creatorId) {
    await interaction.update({
      content: "❌ Tu es déjà l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  if (!currentSession.participants.has(newHostId)) {
    await interaction.update({
      content:
        "❌ Le nouvel hôte doit d'abord avoir rejoint la session avec le bouton **Rejoindre**.",
      components: [],
    });

    return true;
  }

  if (!interaction.channel) {
    await interaction.update({
      content: "❌ Impossible de retrouver le salon de la session.",
      components: [],
    });

    return true;
  }

  const sessionMessage = await interaction.channel.messages.fetch(messageId);

  const session = transferSessionHost(messageId, newHostId);

  const embed = buildSessionEmbed(session);

  await sessionMessage.edit({
    embeds: [embed],
    components: [buildSessionButtons()],
  });

  await interaction.update({
    content: `👑 <@${newHostId}> est maintenant l'hôte de la session.`,
    components: [],
  });

  return true;
}
