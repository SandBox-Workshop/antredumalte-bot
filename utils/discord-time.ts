/**
 * Styles de timestamp supportés par Discord.
 *
 * @see https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
 */
export type DiscordTimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

/**
 * Convertit un timestamp Unix exprimé en secondes
 * en timestamp Discord.
 */
export function discordTimeUnix(
  seconds: number,
  style: DiscordTimestampStyle = "R",
): string {
  return `<t:${Math.floor(seconds)}:${style}>`;
}

/**
 * Convertit un timestamp JavaScript exprimé en millisecondes
 * en timestamp Discord.
 */
export function discordTime(
  ms: number,
  style: DiscordTimestampStyle = "R",
): string {
  return discordTimeUnix(ms / 1000, style);
}
