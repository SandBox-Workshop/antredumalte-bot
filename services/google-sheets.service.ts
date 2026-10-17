import { google } from "googleapis";

import { loadAppConfig } from "../config/app-config.js";

const config = loadAppConfig();

const auth = new google.auth.GoogleAuth({
  keyFile: config.googleSheets.credentialsPath,

  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

/**
 * Lit les valeurs d'une plage du Google Sheet configuré.
 *
 * @param range Plage A1 à récupérer dans le document.
 * @returns Lignes retournées par l'API Google Sheets.
 */
export async function readSheetValues(range: string): Promise<unknown[][]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheets.spreadsheetId,
    range,
  });

  return response.data.values ?? [];
}

/**
 * Retourne la plage configurée pour les données de chasse.
 */
export function getChassesRange(): string {
  return config.googleSheets.chassesRange;
}
