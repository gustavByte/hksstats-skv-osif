export type ResultRow = {
  id: string;
  year: number;
  testlopId: string | null;
  date: string | null;
  place: string | null;
  distance: 600 | 1200;
  gender: "Kvinner" | "Menn";
  name: string;
  personId: string;
  timeSeconds: number | null;
  timeDisplay: string | null;
  note: string | null;
  validToplist: boolean;
  validRecord: boolean;
  checkStatus: string;
};

export const base = import.meta.env.BASE_URL;

export function href(path: string) {
  return `${base}${path.replace(/^\//, "")}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year.slice(2)}`;
}

export function formatFullDate(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export function displayTime(result: Pick<ResultRow, "timeDisplay" | "timeSeconds"> | null | undefined) {
  if (!result) return "-";
  return result.timeDisplay || "-";
}

export function displayTestlop(result: Pick<ResultRow, "testlopId" | "place"> | null | undefined) {
  if (!result) return "-";
  const id = result.testlopId || "-";
  return result.place ? `${id} · ${result.place}` : id;
}

export function genderShort(gender: string) {
  return gender === "Kvinner" ? "K" : gender === "Menn" ? "M" : gender;
}

export function statusLabel(result: Pick<ResultRow, "note" | "checkStatus" | "validToplist"> | null | undefined) {
  if (!result) return "";
  const labels = [];
  if (result.note) labels.push(result.note);
  if (result.checkStatus && result.checkStatus !== "OK") labels.push(result.checkStatus);
  if (!result.validToplist) labels.push("utenfor offisiell liste");
  return Array.from(new Set(labels)).join(", ");
}

export function sortByTime(rows: ResultRow[]) {
  return [...rows].sort((a, b) => {
    const timeA = a.timeSeconds ?? Number.POSITIVE_INFINITY;
    const timeB = b.timeSeconds ?? Number.POSITIVE_INFINITY;
    return timeA - timeB || (a.date || "").localeCompare(b.date || "") || a.name.localeCompare(b.name);
  });
}

export function bestValid(rows: ResultRow[]) {
  return sortByTime(rows.filter((row) => row.validToplist && row.timeSeconds !== null))[0] || null;
}

export function secondsDelta(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return null;
  const delta = Math.round((a - b) * 10) / 10;
  return delta.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
