import path from "node:path";
import { DATA_DIR, readJson, writeJson } from "../../utils/storage.js";

export const FAILLE_SUBSCRIBERS_FILE = path.join(
  DATA_DIR,
  "faille-subscribers.json",
);

export async function readFailleSubscribers() {
  return readJson(FAILLE_SUBSCRIBERS_FILE, { users: {} });
}

export async function writeFailleSubscribers(subscribers) {
  await writeJson(FAILLE_SUBSCRIBERS_FILE, subscribers);
}

export async function subscribeFailleUser(user, mode) {
  const subscribers = await readFailleSubscribers();

  subscribers.users[user.id] = {
    mode,
    username: user.username,
    updatedAt: new Date().toISOString(),
  };

  await writeFailleSubscribers(subscribers);
}

export async function unsubscribeFailleUser(userId) {
  const subscribers = await readFailleSubscribers();

  delete subscribers.users[userId];

  await writeFailleSubscribers(subscribers);
}
