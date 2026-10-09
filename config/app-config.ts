import { readFileSync } from "node:fs";

/**
 * Configuration du serveur V Rising.
 */
export type VRisingConfig = {
  /**
   * Adresse IP ou nom d'hôte du serveur.
   */
  host: string;

  /**
   * Port utilisé pour les requêtes GameDig.
   */
  queryPort: number;
};

/**
 * Configuration de l'intégration Google Sheets.
 */
export type GoogleSheetsConfig = {
  /**
   * Identifiant du Google Sheet utilisé par le bot.
   */
  spreadsheetId: string;

  /**
   * Chemin vers les credentials du compte de service Google.
   *
   * Le chemin est interprété relativement au répertoire depuis lequel
   * le processus du bot est lancé.
   */
  credentialsPath: string;

  /**
   * Plage contenant les données des chasses V Rising.
   */
  chassesRange: string;
};

/**
 * Configuration complète de l'application.
 *
 * Les valeurs sont chargées depuis `config/config.json`
 * puis validées avant d'être exposées au reste du bot.
 */
export type AppConfig = {
  /**
   * Token d'authentification du bot Discord.
   */
  token: string;

  /**
   * Identifiant de l'application Discord.
   */
  clientId: string;

  /**
   * Identifiant du serveur Discord principal.
   */
  guildId: string;

  /**
   * Configuration dédiée au serveur V Rising.
   */
  vrising: VRisingConfig;

  /**
   * Configuration dédiée à Google Sheets.
   */
  googleSheets: GoogleSheetsConfig;
};

/**
 * Emplacement du fichier de configuration réel.
 *
 * Le chemin est résolu relativement à ce module afin de ne pas
 * dépendre du répertoire courant du processus.
 */
const CONFIG_URL = new URL("./config.json", import.meta.url);

/**
 * Configuration déjà chargée et validée.
 *
 * La configuration étant considérée comme immuable pendant
 * l'exécution du bot, elle n'est lue depuis le disque qu'une fois.
 */
let cachedConfig: AppConfig | undefined;

/**
 * Vérifie qu'une valeur est une chaîne non vide.
 *
 * @param value Valeur à vérifier.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Vérifie qu'une valeur représente un port valide.
 *
 * @param value Valeur à vérifier.
 */
function isValidPort(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65_535
  );
}

/**
 * Vérifie la configuration V Rising.
 */
function isVRisingConfig(value: unknown): value is VRisingConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const config = value as Record<string, unknown>;

  return isNonEmptyString(config.host) && isValidPort(config.queryPort);
}

/**
 * Vérifie la configuration Google Sheets.
 */
function isGoogleSheetsConfig(value: unknown): value is GoogleSheetsConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const config = value as Record<string, unknown>;

  return (
    isNonEmptyString(config.spreadsheetId) &&
    isNonEmptyString(config.credentialsPath) &&
    isNonEmptyString(config.chassesRange)
  );
}

/**
 * Vérifie qu'une valeur respecte la structure complète attendue
 * pour la configuration du bot.
 *
 * Cette validation runtime reste nécessaire car TypeScript ne peut
 * pas garantir le contenu d'un fichier JSON externe.
 */
function isAppConfig(value: unknown): value is AppConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const config = value as Record<string, unknown>;

  return (
    isNonEmptyString(config.token) &&
    isNonEmptyString(config.clientId) &&
    isNonEmptyString(config.guildId) &&
    isVRisingConfig(config.vrising) &&
    isGoogleSheetsConfig(config.googleSheets)
  );
}

/**
 * Charge et valide la configuration de l'application.
 *
 * La première invocation lit `config/config.json`.
 * Les appels suivants retournent la configuration déjà validée,
 * ce qui évite plusieurs lectures disque pendant le démarrage.
 *
 * @returns Configuration complète et validée du bot.
 * @throws Error si le fichier est absent, invalide ou incomplet.
 */
export function loadAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  let rawConfig: unknown;

  try {
    rawConfig = JSON.parse(readFileSync(CONFIG_URL, "utf8")) as unknown;
  } catch (error: unknown) {
    throw new Error("Impossible de lire ou parser config/config.json.", {
      cause: error,
    });
  }

  if (!isAppConfig(rawConfig)) {
    throw new Error(
      [
        "config/config.json invalide.",
        "Vérifie token, clientId, guildId, vrising et googleSheets.",
      ].join(" "),
    );
  }

  cachedConfig = rawConfig;

  return cachedConfig;
}
