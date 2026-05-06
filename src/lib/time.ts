import { fromZonedTime, toZonedTime, format } from "date-fns-tz";

const TZ = process.env.APP_TIMEZONE || "Europe/Moscow";

/**
 * Принимает дату (YYYY-MM-DD) и время (HH:mm) в локальном TZ,
 * возвращает соответствующий момент в UTC (Date в UTC).
 */
export function localDateTimeToUtc(dateISO: string, timeHHMM: string): Date {
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10));
  const local = `${dateISO}T${pad2(h)}:${pad2(m)}:00`;
  return fromZonedTime(local, TZ);
}

/** UTC момент → строка "DD.MM.YYYY HH:mm" в локальном TZ */
export function formatLocal(date: Date, pattern = "dd.MM.yyyy HH:mm"): string {
  const zoned = toZonedTime(date, TZ);
  return format(zoned, pattern, { timeZone: TZ });
}

export function formatLocalDate(date: Date): string {
  return formatLocal(date, "dd.MM.yyyy");
}

export function formatLocalTime(date: Date): string {
  return formatLocal(date, "HH:mm");
}

/** Парсит "14:00" → {h:14,m:0} */
export function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid time string: ${s}`);
  }
  return { h, m };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export const APP_TIMEZONE = TZ;
