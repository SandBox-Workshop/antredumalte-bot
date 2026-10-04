function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isTruthy(value) {
  const normalized = normalize(value);

  return ["oui", "true", "x", "1", "yes", "en chasse"].includes(normalized);
}

function getColumnIndex(headers, columnName) {
  const wanted = normalize(columnName);

  return headers.findIndex((header) => normalize(header) === wanted);
}

export function mapChassesRows(values) {
  if (values.length <= 1) return [];

  const headers = values[0];

  const servantIndex = getColumnIndex(headers, "Serviteur");
  const castleIndex = getColumnIndex(headers, "Château");
  const huntingIndex = getColumnIndex(headers, "En chasse");
  const locationIndex = getColumnIndex(headers, "Lieu");
  const endIndex = getColumnIndex(headers, "Fin");
  const noteIndex = getColumnIndex(headers, "Note");

  return values
    .slice(1)
    .map((row) => ({
      serviteur: row[servantIndex] ?? "",
      chateau: row[castleIndex] ?? "Sans château",
      enChasse: isTruthy(row[huntingIndex]),
      lieu: row[locationIndex] ?? "",
      fin: row[endIndex] ?? "",
      note: row[noteIndex] ?? "",
    }))
    .filter((hunt) => hunt.serviteur && hunt.enChasse);
}
