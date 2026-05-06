import { describe, it, expect } from "vitest";
import { calcPrice } from "../src/lib/pricing";

describe("calcPrice", () => {
  it("DAILY: 2 ночи по 5000 = 10000, без допгостей", () => {
    const r = calcPrice({
      bookingMode: "DAILY",
      startAt: new Date("2026-06-01T11:00:00Z"),
      endAt: new Date("2026-06-03T09:00:00Z"),
      basePrice: 5000,
      extraGuestPrice: 1000,
      guestsCount: 2,
      baseCapacity: 2,
      maxCapacity: 4,
    });
    expect(r.units).toBe(2);
    expect(r.totalPrice.toString()).toBe("10000");
    expect(r.extraGuests).toBe(0);
    expect(r.extraGuestsCost.toString()).toBe("0");
  });

  it("DAILY: 1 ночь, 4 гостя при baseCapacity=2 = 5000 + 2*1000*1 = 7000", () => {
    const r = calcPrice({
      bookingMode: "DAILY",
      startAt: new Date("2026-06-01T11:00:00Z"),
      endAt: new Date("2026-06-02T09:00:00Z"),
      basePrice: 5000,
      extraGuestPrice: 1000,
      guestsCount: 4,
      baseCapacity: 2,
      maxCapacity: 4,
    });
    expect(r.units).toBe(1);
    expect(r.extraGuests).toBe(2);
    expect(r.totalPrice.toString()).toBe("7000");
  });

  it("HOURLY: 3 часа по 800 = 2400", () => {
    const r = calcPrice({
      bookingMode: "HOURLY",
      startAt: new Date("2026-06-01T10:00:00Z"),
      endAt: new Date("2026-06-01T13:00:00Z"),
      basePrice: 800,
      extraGuestPrice: 0,
      guestsCount: 4,
      baseCapacity: 8,
      maxCapacity: 8,
    });
    expect(r.units).toBe(3);
    expect(r.totalPrice.toString()).toBe("2400");
  });

  it("HOURLY: округляет вверх до полного часа", () => {
    const r = calcPrice({
      bookingMode: "HOURLY",
      startAt: new Date("2026-06-01T10:00:00Z"),
      endAt: new Date("2026-06-01T11:30:00Z"),
      basePrice: 800,
      extraGuestPrice: 0,
      guestsCount: 1,
      baseCapacity: 8,
      maxCapacity: 8,
    });
    expect(r.units).toBe(2);
    expect(r.totalPrice.toString()).toBe("1600");
  });

  it("кидает ошибку если гостей больше maxCapacity", () => {
    expect(() =>
      calcPrice({
        bookingMode: "DAILY",
        startAt: new Date("2026-06-01T11:00:00Z"),
        endAt: new Date("2026-06-02T09:00:00Z"),
        basePrice: 5000,
        extraGuestPrice: 1000,
        guestsCount: 10,
        baseCapacity: 2,
        maxCapacity: 4,
      }),
    ).toThrow();
  });

  it("кидает ошибку если endAt <= startAt", () => {
    expect(() =>
      calcPrice({
        bookingMode: "HOURLY",
        startAt: new Date("2026-06-01T11:00:00Z"),
        endAt: new Date("2026-06-01T11:00:00Z"),
        basePrice: 800,
        extraGuestPrice: 0,
        guestsCount: 1,
        baseCapacity: 8,
        maxCapacity: 8,
      }),
    ).toThrow();
  });
});
