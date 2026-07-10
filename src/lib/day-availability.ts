/**
 * Чистая дневная арифметика для суточного (DAILY) календаря доступности.
 *
 * Модель «ночей»: бронь [заезд@checkInTime … выезд@checkOutTime) занимает НОЧИ
 * с дня заезда включительно по день выезда ИСКЛЮЧИТЕЛЬНО. День выезда свободен —
 * в него уже можно заехать новой брони (и, симметрично, выехать чужой). Индекс дня
 * считается в зоне Europe/Moscow (сдвиг +180 мин), как и в остальном коде проекта.
 */

export type BusyInterval = { kind: "booking" | "block"; startAt: string; endAt: string };

const DAY_MS = 86_400_000;
const TZ_OFFSET_MIN = 180;

/** Индекс МСК-дня: d * DAY_MS соответствует UTC-полуночи этого MSK-индекса. */
export function mskDayIndex(d: Date): number {
  return Math.floor((d.getTime() + TZ_OFFSET_MIN * 60_000) / DAY_MS);
}

/** "YYYY-MM-DD" в МСК для дня по его индексу. */
export function dayIndexToKey(dayIdx: number): string {
  const dt = new Date(dayIdx * DAY_MS);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" в МСК для конкретной даты. */
export function dateKey(d: Date): string {
  return dayIndexToKey(mskDayIndex(d));
}

/**
 * Индексы занятых НОЧЕЙ из списка busy-интервалов. Для брони 17→19 это {17, 18}
 * (день выезда 19 не занимается). Бронь короче суток помечает свой единственный день.
 *
 * cleaningMinutes вычитается из endAt: если бэкенд уже включил уборку в endAt,
 * здесь её убираем, чтобы буфер уборки не «съедал» день выезда как ночь.
 */
export function occupiedNightIndices(
  intervals: BusyInterval[],
  cleaningMinutes: number,
): Set<number> {
  const out = new Set<number>();
  for (const iv of intervals) {
    const start = new Date(iv.startAt);
    const end = new Date(new Date(iv.endAt).getTime() - cleaningMinutes * 60_000);
    const startDay = mskDayIndex(start);
    // floor, а не ceil: занимаем ночи до дня выезда исключительно — в день
    // выезда уже можно заехать новой брони.
    const endDay = mskDayIndex(end);
    for (let d = startDay; d < endDay; d++) out.add(d);
    if (startDay === endDay) out.add(startDay);
  }
  return out;
}

/**
 * Наименьший индекс занятой ночи, начиная с fromIdx (включительно), или null,
 * если в пределах horizon занятых ночей нет. horizon ограничивает поиск окном
 * доступности (по умолчанию с запасом больше 90-дневного окна витрины).
 */
export function firstOccupiedNightFrom(
  fromIdx: number,
  occupied: Set<number>,
  horizon = 400,
): number | null {
  for (let d = fromIdx; d <= fromIdx + horizon; d++) {
    if (occupied.has(d)) return d;
  }
  return null;
}

/**
 * Задевает ли период НОЧЕЙ [fromIdx, toIdx) хотя бы одну занятую ночь.
 * Выезд ровно на первую занятую ночь (toIdx === её индекс) не считается
 * пересечением — это день пересменки.
 */
export function rangeHitsOccupiedNight(
  fromIdx: number,
  toIdx: number,
  occupied: Set<number>,
): boolean {
  for (let d = fromIdx; d < toIdx; d++) {
    if (occupied.has(d)) return true;
  }
  return false;
}

/**
 * Годится ли день `dayIdx` как ДАТА ВЫЕЗДА для уже выбранного заезда `anchorIdx`:
 * строго позже заезда и период ночей [заезд, выезд) свободен. Выезд может попасть
 * ровно на первую занятую ночь (пересменка) — она не входит в период.
 */
export function isCheckoutValid(
  anchorIdx: number | null,
  dayIdx: number,
  occupied: Set<number>,
): boolean {
  if (anchorIdx === null) return false;
  return dayIdx > anchorIdx && !rangeHitsOccupiedNight(anchorIdx, dayIdx, occupied);
}

/**
 * Кликабелен ли день в календаре (без учёта «прошедших дней»): он годится либо
 * как новый ЗАЕЗД (свободная ночь), либо как ВЫЕЗД для текущего заезда. Занятая
 * ночь чужой брони недоступна как заезд, но доступна как выезд-пересменка.
 */
export function isDaySelectable(
  anchorIdx: number | null,
  dayIdx: number,
  occupied: Set<number>,
): boolean {
  return !occupied.has(dayIdx) || isCheckoutValid(anchorIdx, dayIdx, occupied);
}
