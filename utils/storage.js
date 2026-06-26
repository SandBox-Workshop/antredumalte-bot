import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");

export async function readJson(filePath, fallbackValue = null) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

export async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function deleteFile(filePath) {
  await rm(filePath, { force: true });
}
