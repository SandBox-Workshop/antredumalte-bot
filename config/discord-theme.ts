/**
 * Identité visuelle commune du bot.
 *
 * On conserve "YOLO" comme nom de marque afin d'avoir des footers
 * cohérents dans les embeds généraux sans toucher aux modules V Rising.
 */
export const DISCORD_THEME = {
  brand: "YOLO",

  colors: {
    primary: 0x5865f2,
    success: 0x57f287,
    danger: 0xed4245,
    muted: 0x747f8d,
  },
} as const;
