import { describe, it, expect } from "vitest";
import {
  type BusyInterval,
  mskDayIndex,
  occupiedNightIndices,
  firstOccupiedNightFrom,
  rangeHitsOccupiedNight,
} from "../src/lib/day-availability";

// Индекс МСК-дня по строке "YYYY-MM-DD" (берём полдень МСК, чтобы не задеть границу).
const idx = (day: string) => mskDayIndex(new Date(`${day}T12:00:00+03:00`));

// Бронь заезд@14:00 / выезд@12:00 по МСК (как строит сервер для DAILY).
const booking = (checkIn: string, checkOut: string, endShiftMin = 0): BusyInterval => ({
  kind: "booking",
  startAt: new Date(`${checkIn}T14:00:00+03:00`).toISOString(),
  // endShiftMin имитирует уже включённую в endAt уборку (blockedUntil).
  endAt: new Date(new Date(`${checkOut}T12:00:00+03:00`).getTime() + endShiftMin * 60_000).toISOString(),
});

describe("occupiedNightIndices", () => {
  it("бронь 17→19 занимает ночи 17 и 18, день выезда 19 свободен", () => {
    const set = occupiedNightIndices([booking("2026-07-17", "2026-07-19")], 0);
    expect(set.has(idx("2026-07-16"))).toBe(false);
    expect(set.has(idx("2026-07-17"))).toBe(true);
    expect(set.has(idx("2026-07-18"))).toBe(true);
    expect(set.has(idx("2026-07-19"))).toBe(false);
  });

  it("зеркальный случай: заезд в день чужого выезда свободен (бронь 15→17 → ночи 15,16)", () => {
    const set = occupiedNightIndices([booking("2026-07-15", "2026-07-17")], 0);
    expect(set.has(idx("2026-07-15"))).toBe(true);
    expect(set.has(idx("2026-07-16"))).toBe(true);
    expect(set.has(idx("2026-07-17"))).toBe(false);
  });

  it("однодневный интервал помечает свой день", () => {
    const set = occupiedNightIndices(
      [
        {
          kind: "block",
          startAt: new Date("2026-07-20T09:00:00+03:00").toISOString(),
          endAt: new Date("2026-07-20T15:00:00+03:00").toISOString(),
        },
      ],
      0,
    );
    expect(set.has(idx("2026-07-20"))).toBe(true);
    expect(set.has(idx("2026-07-21"))).toBe(false);
  });

  it("cleaningMinutes вычитается из endAt и не делает день выезда занятым", () => {
    // endAt = 19 12:00 + 120 мин уборки = 19 14:00; при cleaningMinutes=120 день 19 свободен
    const set = occupiedNightIndices([booking("2026-07-17", "2026-07-19", 120)], 120);
    expect(set.has(idx("2026-07-18"))).toBe(true);
    expect(set.has(idx("2026-07-19"))).toBe(false);
  });
});

describe("firstOccupiedNightFrom / rangeHitsOccupiedNight (бронь 17→19)", () => {
  const set = occupiedNightIndices([booking("2026-07-17", "2026-07-19")], 0);

  it("первая занятая ночь начиная с 15-го — это 17-е", () => {
    expect(firstOccupiedNightFrom(idx("2026-07-15"), set)).toBe(idx("2026-07-17"));
  });

  it("возвращает null, если впереди нет занятых ночей", () => {
    expect(firstOccupiedNightFrom(idx("2026-07-20"), set)).toBeNull();
  });

  it("выезд 15→17 разрешён (период ночей [15,17) свободен) — это пересменка", () => {
    expect(rangeHitsOccupiedNight(idx("2026-07-15"), idx("2026-07-17"), set)).toBe(false);
  });

  it("период 15→18 запрещён — задевает занятую ночь 17", () => {
    expect(rangeHitsOccupiedNight(idx("2026-07-15"), idx("2026-07-18"), set)).toBe(true);
  });

  it("период 15→19 (через 17,18) запрещён", () => {
    expect(rangeHitsOccupiedNight(idx("2026-07-15"), idx("2026-07-19"), set)).toBe(true);
  });
});
