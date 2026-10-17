/**
 * Fuseau horaire utilisé pour interpréter les dates de sessions.
 *
 * Le fuseau est défini explicitement afin que le comportement
 * ne dépende pas de la configuration du VPS.
 */
export const SESSION_TIME_ZONE = "Europe/Paris";

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type SessionScheduleResolution =
  | {
      ok: true;
      scheduledAt: number;
    }
  | {
      ok: false;
      message: string;
    };

const zonedFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SESSION_TIME_ZONE,

  year: "numeric",
  month: "2-digit",
  day: "2-digit",

  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",

  hourCycle: "h23",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getZonedParts(timestampMs: number): ZonedDateTimeParts {
  const parts = zonedFormatter.formatToParts(new Date(timestampMs));

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getTimeZoneOffset(timestampMs: number): number {
  const parts = getZonedParts(timestampMs);

  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  const timestampWithoutMs = Math.floor(timestampMs / 1000) * 1000;

  return representedAsUtc - timestampWithoutMs;
}

/**
 * Convertit une saisie `JJ/MM/AAAA` + `HH:MM`
 * en timestamp Unix interprété dans le fuseau Europe/Paris.
 */
export function parseSessionDateTime(
  dateText: string,
  timeText: string,
): number | null {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const validationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() !== month - 1 ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  let timestamp = localAsUtc - getTimeZoneOffset(localAsUtc);

  /*
   * Deuxième passe utile autour des changements heure d'été / heure d'hiver.
   */
  timestamp = localAsUtc - getTimeZoneOffset(timestamp);

  const resolved = getZonedParts(timestamp);

  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    return null;
  }

  return Math.floor(timestamp / 1000);
}

/**
 * Centralise la validation utilisée à la création et à l'édition.
 */
export function resolveSessionSchedule(
  dateText: string,
  timeText: string,
  nowUnix = Math.floor(Date.now() / 1000),
): SessionScheduleResolution {
  const scheduledAt = parseSessionDateTime(dateText, timeText);

  if (scheduledAt === null) {
    return {
      ok: false,
      message:
        "❌ Date ou heure invalide. Utilise `JJ/MM/AAAA` pour la date et `HH:MM` pour l'heure.",
    };
  }

  if (scheduledAt <= nowUnix) {
    return {
      ok: false,
      message: "❌ La session doit être prévue dans le futur.",
    };
  }

  return {
    ok: true,
    scheduledAt,
  };
}

export function formatSessionDateInput(timestamp: number): string {
  const parts = getZonedParts(timestamp * 1000);

  return [pad2(parts.day), pad2(parts.month), parts.year].join("/");
}

export function formatSessionTimeInput(timestamp: number): string {
  const parts = getZonedParts(timestamp * 1000);

  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/**
 * Valeur conservée dans `when_text`
 * pour compatibilité avec l'ancien schéma.
 */
export function formatSessionLegacyWhen(timestamp: number): string {
  return `${formatSessionDateInput(timestamp)} ${formatSessionTimeInput(timestamp)}`;
}
