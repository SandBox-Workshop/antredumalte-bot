/**
 * Styles de timestamp supportés par Discord.
 *
 * @see https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
 */
export type DiscordTimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

/**
 * Convertit un timestamp JavaScript en timestamp Discord.
 *
 * Discord attend un timestamp Unix exprimé en secondes,
 * tandis que JavaScript manipule généralement des millisecondes.
 *
 * @param ms Timestamp Unix exprimé en millisecondes.
 * @param style Style d'affichage Discord.
 * @returns Timestamp Discord prêt à être inséré dans un message.
 *
 * @example
 * ```ts
 * discordTime(Date.now());
 * // <t:1760000000:R>
 *
 * discordTime(Date.now(), "F");
 * // <t:1760000000:F>
 * ```
 */
export function discordTime(
  ms: number,
  style: DiscordTimestampStyle = "R",
): string {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}
