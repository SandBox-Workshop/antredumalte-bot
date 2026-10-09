import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";

import { getEnabledGames, getGameById } from "../../services/game.service.js";

import {
  buildCancelledSessionEmbed,
  buildCompletedSessionEmbed,
  buildSessionEmbed,
} from "./sessions.embed.js";

import {
  cancelSession,
  completeSession,
  getSession,
  joinSession,
  leaveSession,
  maybeSession,
  transferSessionHost,
  updateSessionDetails,
  updateSessionGame,
} from "../../services/session.service.js";

export function buildSessionButtons() {
  const participationRow = new ActionRowBuilder().addComponents(
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
  );

  const managementRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("session:edit")
      .setLabel("Modifier")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("session:game")
      .setLabel("Changer le jeu")
      .setEmoji("🎮")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("session:transfer")
      .setLabel("Changer d'hôte")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("session:complete")
      .setLabel("Terminer")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("session:cancel")
      .setLabel("Annuler")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),
  );

  return [participationRow, managementRow];
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

function buildGameSelect(messageId, currentGameId) {
  const games = getEnabledGames();

  const options = games.slice(0, 25).map((game) => {
    const option = {
      label: game.name,
      value: game.id,
      default: game.id === currentGameId,
    };

    if (game.emoji) {
      option.emoji = game.emoji;
    }

    return option;
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`session:game:${messageId}`)
      .setPlaceholder("Choisir un jeu")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options),
  );
}

function buildEditModal(session) {
  const modal = new ModalBuilder()
    .setCustomId(`session:edit:${session.messageId}`)
    .setTitle("Modifier la session");

  const whenInput = new TextInputBuilder()
    .setCustomId("when")
    .setLabel("Quand ?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100)
    .setValue(session.when);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  if (session.description) {
    descriptionInput.setValue(session.description);
  }

  modal.addComponents(
    new ActionRowBuilder().addComponents(whenInput),

    new ActionRowBuilder().addComponents(descriptionInput),
  );

  return modal;
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
      content: "❌ Cette session n'existe plus ou n'est plus active.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const action = interaction.customId.split(":")[1];

  if (
    userId === currentSession.hostId &&
    (action === "leave" || action === "maybe")
  ) {
    await interaction.reply({
      content:
        "👑 Tu es l'hôte de cette session. Transfère d'abord l'hôte ou annule la session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  switch (action) {
    case "join": {
      const session = joinSession(messageId, userId);

      await interaction.update({
        embeds: [buildSessionEmbed(session)],
        components: buildSessionButtons(),
      });

      return true;
    }

    case "maybe": {
      const session = maybeSession(messageId, userId);

      await interaction.update({
        embeds: [buildSessionEmbed(session)],
        components: buildSessionButtons(),
      });

      return true;
    }

    case "leave": {
      const session = leaveSession(messageId, userId);

      await interaction.update({
        embeds: [buildSessionEmbed(session)],
        components: buildSessionButtons(),
      });

      return true;
    }

    case "edit": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut modifier cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      await interaction.showModal(buildEditModal(currentSession));

      return true;
    }

    case "game": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut changer le jeu.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      const games = getEnabledGames();

      if (games.length === 0) {
        await interaction.reply({
          content: "❌ Aucun jeu actif n'est disponible.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      await interaction.reply({
        content: "🎮 Choisis le nouveau jeu de la session :",
        components: [buildGameSelect(messageId, currentSession.game.id)],
        flags: MessageFlags.Ephemeral,
      });

      return true;
    }

    case "transfer": {
      if (userId !== currentSession.hostId) {
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
        content: "👑 Choisis le participant qui deviendra le nouvel hôte :",
        components: [buildHostSelect(messageId)],
        flags: MessageFlags.Ephemeral,
      });

      return true;
    }

    case "complete": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut terminer cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      const completedSession = completeSession(messageId);

      await interaction.update({
        embeds: [buildCompletedSessionEmbed(completedSession)],
        components: [],
      });

      return true;
    }

    case "cancel": {
      if (userId !== currentSession.hostId) {
        await interaction.reply({
          content: "❌ Seul l'hôte peut annuler cette session.",
          flags: MessageFlags.Ephemeral,
        });

        return true;
      }

      const cancelledSession = cancelSession(messageId);

      await interaction.update({
        embeds: [buildCancelledSessionEmbed(cancelledSession)],
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

  if (interaction.user.id !== currentSession.hostId) {
    await interaction.update({
      content: "❌ Tu n'es plus l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  const newHostId = interaction.values[0];

  if (newHostId === currentSession.hostId) {
    await interaction.update({
      content: "❌ Tu es déjà l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  if (!currentSession.participants.has(newHostId)) {
    await interaction.update({
      content: "❌ Le nouvel hôte doit d'abord rejoindre la session.",
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

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });

  await interaction.update({
    content: `👑 <@${newHostId}> est maintenant l'hôte de la session.`,
    components: [],
  });

  return true;
}

export async function handleSessionGameSelect(interaction) {
  if (!interaction.customId.startsWith("session:game:")) {
    return false;
  }

  const messageId = interaction.customId.split(":")[2];

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.update({
      content: "❌ Cette session n'existe plus ou n'est plus active.",
      components: [],
    });

    return true;
  }

  if (interaction.user.id !== currentSession.hostId) {
    await interaction.update({
      content: "❌ Tu n'es plus l'hôte de cette session.",
      components: [],
    });

    return true;
  }

  const gameId = interaction.values[0];

  const game = getGameById(gameId);

  if (!game || !game.enabled) {
    await interaction.update({
      content: "❌ Ce jeu n'est plus disponible.",
      components: [],
    });

    return true;
  }

  if (game.id === currentSession.game.id) {
    await interaction.update({
      content: `ℹ️ La session utilise déjà **${game.name}**.`,
      components: [],
    });

    return true;
  }

  const session = updateSessionGame(messageId, game);

  if (!interaction.channel) {
    await interaction.update({
      content: "❌ Impossible de retrouver le salon de la session.",
      components: [],
    });

    return true;
  }

  const sessionMessage = await interaction.channel.messages.fetch(messageId);

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });

  await interaction.update({
    content: `🎮 Jeu changé pour **${game.name}**.`,
    components: [],
  });

  return true;
}

export async function handleSessionEditModal(interaction) {
  if (!interaction.customId.startsWith("session:edit:")) {
    return false;
  }

  const messageId = interaction.customId.split(":")[2];

  const currentSession = getSession(messageId);

  if (!currentSession) {
    await interaction.reply({
      content: "❌ Cette session n'existe plus ou n'est plus active.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  if (interaction.user.id !== currentSession.hostId) {
    await interaction.reply({
      content: "❌ Tu n'es plus l'hôte de cette session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const when = interaction.fields.getTextInputValue("when").trim();

  const description = interaction.fields
    .getTextInputValue("description")
    .trim();

  if (!when) {
    await interaction.reply({
      content: "❌ Le moment de la session ne peut pas être vide.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const session = updateSessionDetails(messageId, {
    when,
    description,
  });

  if (!interaction.channel) {
    await interaction.reply({
      content: "❌ Impossible de retrouver le salon de la session.",
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  const sessionMessage = await interaction.channel.messages.fetch(messageId);

  await sessionMessage.edit({
    embeds: [buildSessionEmbed(session)],
    components: buildSessionButtons(),
  });

  await interaction.reply({
    content: "✅ Session modifiée.",
    flags: MessageFlags.Ephemeral,
  });

  return true;
}
