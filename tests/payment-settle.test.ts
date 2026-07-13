import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { testDb, cleanDb } from "./helpers/db";
import { createBooking } from "../src/lib/booking-service";
import { applyPaymentResult } from "../src/lib/tinkoff";

beforeAll(async () => {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    stdio: "ignore",
  });
});
beforeEach(async () => {
  await cleanDb();
});
afterAll(async () => {
  await testDb.$disconnect();
});

const guest = {
  guestName: "Иван Иванов",
  guestEmail: "ivan@test.local",
  guestPhone: "+79991112233",
};

async function seedBookingWithPayment(externalId: string) {
  const cat = await testDb.category.create({
    data: { name: "Беседки", slug: `gz-${Date.now()}-${Math.round(performance.now())}`, bookingMode: "HOURLY" },
  });
  const t = await testDb.objectType.create({
    data: {
      categoryId: cat.id,
      name: "Беседка",
      hourlyStepMinutes: 60,
      workingHoursStart: "09:00",
      workingHoursEnd: "23:00",
      cleaningMinutes: 0,
      baseCapacity: 6,
      maxCapacity: 8,
      basePrice: 800,
      extraGuestPrice: 200,
      minBookingHours: 1,
    },
  });
  const obj = await testDb.bookingObject.create({
    data: { objectTypeId: t.id, name: "Беседка №1", slug: `g1-${Date.now()}-${Math.round(performance.now())}` },
  });
  const b = await createBooking({
    objectId: obj.id,
    startAt: "2026-08-01T10:00:00Z",
    endAt: "2026-08-01T13:00:00Z",
    guestsCount: 4,
    ...guest,
  });
  await testDb.payment.create({
    data: { bookingId: b.id, provider: "tinkoff", amount: b.totalPrice, externalId, status: "PENDING" },
  });
  return b;
}

describe("applyPaymentResult — атомарность перехода в успех (дубли уведомлений)", () => {
  it("параллельные вебхуки → ровно один firstSettle=true", async () => {
    const b = await seedBookingWithPayment("tk_parallel");

    // Имитируем гонку Tinkoff: AUTHORIZED + CONFIRMED + ретрай приходят разом.
    const results = await Promise.all([
      applyPaymentResult({ externalId: "tk_parallel", succeeded: true }),
      applyPaymentResult({ externalId: "tk_parallel", succeeded: true }),
      applyPaymentResult({ externalId: "tk_parallel", succeeded: true }),
    ]);

    const wins = results.filter((r) => r?.firstSettle).length;
    expect(wins).toBe(1); // уведомление об оплате уйдёт РОВНО один раз

    const payment = await testDb.payment.findFirstOrThrow({ where: { externalId: "tk_parallel" } });
    expect(payment.status).toBe("SUCCEEDED");
    const booking = await testDb.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(booking.status).toBe("PREPAID");
  });

  it("повторный вызов после успеха → firstSettle=false", async () => {
    await seedBookingWithPayment("tk_seq");
    const first = await applyPaymentResult({ externalId: "tk_seq", succeeded: true });
    const second = await applyPaymentResult({ externalId: "tk_seq", succeeded: true });
    expect(first?.firstSettle).toBe(true);
    expect(second?.firstSettle).toBe(false);
  });

  it("неуспешный вебхук после успеха НЕ откатывает платёж", async () => {
    const b = await seedBookingWithPayment("tk_fail_after");
    await applyPaymentResult({ externalId: "tk_fail_after", succeeded: true });
    const res = await applyPaymentResult({ externalId: "tk_fail_after", succeeded: false });
    expect(res?.firstSettle).toBe(false);
    const payment = await testDb.payment.findFirstOrThrow({ where: { externalId: "tk_fail_after" } });
    expect(payment.status).toBe("SUCCEEDED"); // остаётся успешным
    const booking = await testDb.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(booking.status).toBe("PREPAID");
  });
});
