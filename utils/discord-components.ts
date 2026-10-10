import {
  ButtonBuilder,
  type ButtonStyle,
  MessageFlags,
  type MessageComponentInteraction,
  type RepliableInteraction,
} from "discord.js";

export type ButtonConfig = {
  id: string;
  label: string;
  emoji?: string;
  style: ButtonStyle;
};

export type ParsedCustomId = {
  feature: string;
  action: string;
  args: string[];
};

/** Construit un bouton Discord à partir d'une configuration simple. */
export function buildButton({
  id,
  label,
  emoji,
  style,
}: ButtonConfig): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style);

  if (emoji) {
    button.setEmoji(emoji);
  }

  return button;
}

/** Envoie une réponse éphémère contenant uniquement un message. */
export async function replyEphemeral(
  interaction: RepliableInteraction,
  message: string,
): Promise<void> {
  await interaction.reply({
    content: message,
    flags: MessageFlags.Ephemeral,
  });
}

/** Remplace le contenu d'un panneau puis retire tous ses composants. */
export async function closePanel(
  interaction: MessageComponentInteraction,
  message: string,
): Promise<void> {
  await interaction.update({
    content: message,
    components: [],
  });
}

/** Construit un customId sous la forme `feature:action:...args`. */
export function makeCustomId(
  feature: string,
  action: string,
  ...args: string[]
): string {
  return [feature, action, ...args].join(":");
}

/** Décompose un customId construit avec {@link makeCustomId}. */
export function parseCustomId(customId: string): ParsedCustomId | null {
  const [feature, action, ...args] = customId.split(":");

  if (!feature || !action) {
    return null;
  }

  return { feature, action, args };
}
