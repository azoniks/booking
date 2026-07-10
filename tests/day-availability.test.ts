import { describe, it, expect } from "vitest";
import {
  type BusyInterval,
  mskDayIndex,
  occupiedNightIndices,
  firstOccupiedNightFrom,
  rangeHitsOccupiedNight,
  isCheckoutValid,
  isDaySelectable,
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

// Воспроизводим кликовую стейт-машину календаря (та же логика, что в
// AvailabilityCalendar.handleDayClick/isDisabled) на реальном сценарии из бага:
// есть бронь 17→19, оформляем 15→17.
describe("стейт-машина выбора: бронь 17→19, оформляем 15→17", () => {
  const occupied = occupiedNightIndices([booking("2026-07-17", "2026-07-19")], 0);
  const day = (d: string) => idx(d);

  // helper: имитируем клик, повторяя логику handleDayClick в терминах индексов
  const click = (anchorIdx: number | null, clickedIdx: number) => {
    if (anchorIdx !== null && isCheckoutValid(anchorIdx, clickedIdx, occupied)) {
      return { from: anchorIdx, to: clickedIdx, anchor: null as number | null };
    }
    return { from: clickedIdx, to: clickedIdx + 1, anchor: clickedIdx as number | null };
  };

  it("в фазе заезда день 17 (чужой заезд) НЕ выбираем, а 15 — можно", () => {
    expect(isDaySelectable(null, day("2026-07-17"), occupied)).toBe(false);
    expect(isDaySelectable(null, day("2026-07-15"), occupied)).toBe(true);
  });

  it("клик 15 → одна ночь 15→16, якорь = 15", () => {
    const s = click(null, day("2026-07-15"));
    expect(s.from).toBe(day("2026-07-15"));
    expect(s.to).toBe(day("2026-07-16"));
    expect(s.anchor).toBe(day("2026-07-15"));
  });

  it("после заезда 15 день 17 ДОСТУПЕН как выезд (главный баг), а 18 — нет", () => {
    const a = day("2026-07-15");
    expect(isDaySelectable(a, day("2026-07-17"), occupied)).toBe(true); // пересменка
    expect(isDaySelectable(a, day("2026-07-18"), occupied)).toBe(false); // задел бы ночь 17
  });

  it("клик 15, затем 17 → период 15→17, якорь сброшен", () => {
    const first = click(null, day("2026-07-15"));
    const second = click(first.anchor, day("2026-07-17"));
    expect(second.from).toBe(day("2026-07-15"));
    expect(second.to).toBe(day("2026-07-17"));
    expect(second.anchor).toBeNull();
  });

  it("после заезда 15 свободный день 19 (за занятыми ночами) доступен как новый заезд, не ловушка", () => {
    const a = day("2026-07-15");
    expect(isDaySelectable(a, day("2026-07-19"), occupied)).toBe(true);
    const s = click(a, day("2026-07-19")); // не валидный выезд → рестарт
    expect(s.from).toBe(day("2026-07-19"));
    expect(s.to).toBe(day("2026-07-20"));
    expect(s.anchor).toBe(day("2026-07-19"));
  });

  it("зеркально: свободные многодневные брони на свободных датах работают (10→13)", () => {
    const first = click(null, day("2026-07-10"));
    const second = click(first.anchor, day("2026-07-13"));
    expect(second.from).toBe(day("2026-07-10"));
    expect(second.to).toBe(day("2026-07-13"));
    expect(second.anchor).toBeNull();
  });
});
