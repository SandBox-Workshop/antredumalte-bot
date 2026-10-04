import { google } from "googleapis";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../config.json", import.meta.url), "utf8"),
);

const auth = new google.auth.GoogleAuth({
  keyFile: config.googleSheets.credentialsPath,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

export async function readSheetValues(range) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheets.spreadsheetId,
    range,
  });

  return response.data.values ?? [];
}

export function getChassesRange() {
  return config.googleSheets.chassesRange;
}
