export function discordTime(ms, style = "R") {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}
