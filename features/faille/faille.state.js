import path from "node:path";
import {
  DATA_DIR,
  deleteFile,
  readJson,
  writeJson,
} from "../../utils/storage.js";

export const FAILLE_STATE_FILE = path.join(DATA_DIR, "faille-state.json");

export async function readFailleState() {
  return readJson(FAILLE_STATE_FILE, null);
}

export async function writeFailleState(state) {
  await writeJson(FAILLE_STATE_FILE, state);
}

export async function clearFailleState() {
  await deleteFile(FAILLE_STATE_FILE);
}

export function getNextStartMs(state, now = Date.now()) {
  if (!state?.lastStartedAt || !state?.intervalMinutes) return null;

  const startedMs = new Date(state.lastStartedAt).getTime();
  const intervalMs = state.intervalMinutes * 60_000;

  if (Number.isNaN(startedMs)) return null;

  const firstNext = startedMs + intervalMs;

  if (firstNext > now) return firstNext;

  const cycles = Math.ceil((now - startedMs) / intervalMs);
  return startedMs + cycles * intervalMs;
}

export function createStartState({ durationMinutes, intervalMinutes, userId }) {
  const now = Date.now();
  const endMs = now + durationMinutes * 60_000;

  return {
    lastStartedAt: new Date(now).toISOString(),
    activeEndsAt: new Date(endMs).toISOString(),
    durationMinutes,
    intervalMinutes,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
}

export function createSyncState({
  remainingMinutes,
  durationMinutes,
  intervalMinutes,
  userId,
}) {
  const now = Date.now();
  const endMs = now + remainingMinutes * 60_000;
  const startedMs = endMs - durationMinutes * 60_000;

  return {
    lastStartedAt: new Date(startedMs).toISOString(),
    activeEndsAt: new Date(endMs).toISOString(),
    durationMinutes,
    intervalMinutes,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
}
