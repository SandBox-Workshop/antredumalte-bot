import {
  ActionRowBuilder,
  type ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";

import { getEnabledGames } from "../../services/game.service.js";
import type { GameSession } from "../../types/session.js";
import { buildButton, makeCustomId } from "../../utils/discord-components.js";
import {
  formatSessionDateInput,
  formatSessionTimeInput,
} from "../../utils/session-date.js";

export const SESSION_FEATURE = "session";

const PUBLIC_BUTTONS = [
  ["join", "Rejoindre", "✅", ButtonStyle.Success],
  ["maybe", "Peut-être", "🤔", ButtonStyle.Secondary],
  ["leave", "Quitter", "❌", ButtonStyle.Secondary],
  ["manage", "Gérer", "⚙️", ButtonStyle.Primary],
] as const;

const MANAGEMENT_BUTTONS = [
  ["edit", "Modifier", "✏️", ButtonStyle.Secondary],
  ["game", "Changer le jeu", "🎮", ButtonStyle.Secondary],
  ["transfer", "Changer d'hôte", "👑", ButtonStyle.Primary],
  ["complete", "Terminer", "✅", ButtonStyle.Success],
  ["cancel", "Annuler", "🗑️", ButtonStyle.Danger],
] as const;

export function buildSessionButtons(): [ActionRowBuilder<ButtonBuilder>] {
  const buttons = PUBLIC_BUTTONS.map(([action, label, emoji, style]) =>
    buildButton({
      id: makeCustomId(SESSION_FEATURE, action),
      label,
      emoji,
      style,
    }),
  );

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

export function buildSessionManagementButtons(
  messageId: string,
): [ActionRowBuilder<ButtonBuilder>] {
  const buttons = MANAGEMENT_BUTTONS.map(([action, label, emoji, style]) =>
    buildButton({
      id: makeCustomId(SESSION_FEATURE, action, messageId),
      label,
      emoji,
      style,
    }),
  );

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

export function buildHostSelect(
  messageId: string,
): ActionRowBuilder<UserSelectMenuBuilder> {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(makeCustomId(SESSION_FEATURE, "transfer", messageId))
      .setPlaceholder("Choisir le nouvel hôte")
      .setMinValues(1)
      .setMaxValues(1),
  );
}

export function buildGameSelect(
  messageId: string,
  currentGameId: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = getEnabledGames()
    .slice(0, 25)
    .map((game) => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(game.name)
        .setValue(game.id)
        .setDefault(game.id === currentGameId);

      if (game.emoji) {
        option.setEmoji(game.emoji);
      }

      return option;
    });

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(makeCustomId(SESSION_FEATURE, "game", messageId))
      .setPlaceholder("Choisir un jeu")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options),
  );
}

export function buildEditModal(session: GameSession): ModalBuilder {
  const dateInput = new TextInputBuilder()
    .setCustomId("date")
    .setLabel("Date (JJ/MM/AAAA)")
    .setPlaceholder("12/10/2026")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const timeInput = new TextInputBuilder()
    .setCustomId("heure")
    .setLabel("Heure (HH:MM)")
    .setPlaceholder("21:00")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(5);

  if (session.scheduledAt !== null) {
    dateInput.setValue(formatSessionDateInput(session.scheduledAt));
    timeInput.setValue(formatSessionTimeInput(session.scheduledAt));
  }

  const descriptionInput = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  if (session.description) {
    descriptionInput.setValue(session.description);
  }

  return new ModalBuilder()
    .setCustomId(makeCustomId(SESSION_FEATURE, "edit", session.messageId))
    .setTitle("Modifier la session")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    );
}
