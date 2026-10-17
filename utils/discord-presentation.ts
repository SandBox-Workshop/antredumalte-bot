import { EmbedBuilder } from "discord.js";

import { DISCORD_THEME } from "../config/discord-theme.js";

export type GameLabelData = {
  name: string;
  emoji?: string | null;
};

export type CreateEmbedOptions = {
  title: string;
  color?: number;
  footer: string;
};

/**
 * Produit un libellé de jeu cohérent dans toute l'interface.
 */
export function gameLabel(game: GameLabelData): string {
  return `${game.emoji || "🎮"} ${game.name}`;
}

/**
 * Crée la base commune d'un embed du bot.
 */
export function createEmbed({
  title,
  color = DISCORD_THEME.colors.primary,
  footer,
}: CreateEmbedOptions): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({
      text: `${DISCORD_THEME.brand} • ${footer}`,
    })
    .setTimestamp();
}
