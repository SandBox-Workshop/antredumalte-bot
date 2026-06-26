import { discordTime } from "../../utils/discord-time.js";
import { getNextStartMs } from "./faille.state.js";
import { readFailleSubscribers } from "./faille.subscribers.js";

export async function notifyFailleSubscribers({
  client,
  channel,
  state,
  reason,
}) {
  const subscribers = await readFailleSubscribers();
  const entries = Object.entries(subscribers.users);

  if (entries.length === 0) return;

  const endMs = new Date(state.activeEndsAt).getTime();
  const nextStartMs = getNextStartMs(state);

  const message =
    `🩸 **Faille V Rising**\n` +
    `${reason}\n\n` +
    `⏱️ Fin : ${discordTime(endMs, "R")} (${discordTime(endMs, "t")})\n` +
    `📍 Prochaine estimée : ${
      nextStartMs
        ? `${discordTime(nextStartMs, "R")} (${discordTime(nextStartMs, "t")})`
        : "inconnue"
    }`;

  const pingUserIds = [];
  const dmUserIds = [];

  for (const [userId, data] of entries) {
    if (data.mode === "ping") pingUserIds.push(userId);
    if (data.mode === "mp") dmUserIds.push(userId);
  }

  if (pingUserIds.length > 0 && channel) {
    try {
      await channel.send({
        content: `${pingUserIds.map((id) => `<@${id}>`).join(" ")}\n${message}`,
        allowedMentions: {
          users: pingUserIds,
        },
      });
    } catch (error) {
      console.warn("Impossible d'envoyer les pings de faille :", error.message);
    }
  }

  for (const userId of dmUserIds) {
    try {
      const user = await client.users.fetch(userId);
      await user.send(message);
    } catch (error) {
      console.warn(`Impossible d'envoyer un MP à ${userId} :`, error.message);
    }
  }
}
