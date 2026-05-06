import { describe, it, expect } from "vitest";
import { intervalsOverlap } from "../src/lib/availability";

describe("intervalsOverlap", () => {
  const mk = (a: string, b: string) => ({ startAt: new Date(a), endAt: new Date(b) });

  it("returns true for overlapping intervals", () => {
    expect(
      intervalsOverlap(mk("2026-06-01T10:00:00Z", "2026-06-01T12:00:00Z"), mk("2026-06-01T11:00:00Z", "2026-06-01T13:00:00Z")),
    ).toBe(true);
  });

  it("returns true when one fully contains the other", () => {
    expect(
      intervalsOverlap(mk("2026-06-01T08:00:00Z", "2026-06-01T18:00:00Z"), mk("2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z")),
    ).toBe(true);
  });

  it("returns false for adjacent intervals (touching boundary is not overlap)", () => {
    expect(
      intervalsOverlap(mk("2026-06-01T10:00:00Z", "2026-06-01T12:00:00Z"), mk("2026-06-01T12:00:00Z", "2026-06-01T14:00:00Z")),
    ).toBe(false);
  });

  it("returns false for non-overlapping", () => {
    expect(
      intervalsOverlap(mk("2026-06-01T10:00:00Z", "2026-06-01T12:00:00Z"), mk("2026-06-01T15:00:00Z", "2026-06-01T17:00:00Z")),
    ).toBe(false);
  });

  it("is symmetric", () => {
    const a = mk("2026-06-01T10:00:00Z", "2026-06-01T12:00:00Z");
    const b = mk("2026-06-01T11:00:00Z", "2026-06-01T13:00:00Z");
    expect(intervalsOverlap(a, b)).toBe(intervalsOverlap(b, a));
  });
});
