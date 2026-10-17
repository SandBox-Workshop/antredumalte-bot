import { Events, type Client } from "discord.js";

import { startSessionScheduler } from "../features/sessions/sessions.scheduler.js";

export const name = Events.ClientReady;
export const once = true;

export function execute(client: Client): void {
  startSessionScheduler(client);
}
