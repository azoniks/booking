import { describe, it, expect } from "vitest";
import { localDateTimeToUtc, formatLocal, parseHHMM } from "../src/lib/time";

describe("time helpers", () => {
  it("converts Moscow local 14:00 to 11:00 UTC", () => {
    // Москва UTC+3, без DST
    const utc = localDateTimeToUtc("2026-06-15", "14:00");
    expect(utc.toISOString()).toBe("2026-06-15T11:00:00.000Z");
  });

  it("formats UTC date in Moscow timezone", () => {
    const d = new Date("2026-06-15T11:00:00Z");
    expect(formatLocal(d)).toBe("15.06.2026 14:00");
  });

  it("parseHHMM", () => {
    expect(parseHHMM("09:30")).toEqual({ h: 9, m: 30 });
    expect(parseHHMM("23:45")).toEqual({ h: 23, m: 45 });
    expect(() => parseHHMM("xx")).toThrow();
  });
});
