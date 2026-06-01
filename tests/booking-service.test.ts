import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { testDb, cleanDb } from "./helpers/db";
import {
  createBooking,
  BookingConflictError,
  cancelExpiredBookings,
} from "../src/lib/booking-service";
import { execSync } from "node:child_process";

beforeAll(async () => {
  // Применяем миграции к тестовой БД
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

async function seedHourlyObject(opts: { cleaningMinutes?: number } = {}) {
  const cat = await testDb.category.create({
    data: {
      name: "Беседки",
      slug: `gazebos-${Date.now()}`,
      bookingMode: "HOURLY",
    },
  });
  const t = await testDb.objectType.create({
    data: {
      categoryId: cat.id,
      name: "Беседка стандарт",
      hourlyStepMinutes: 60,
      workingHoursStart: "09:00",
      workingHoursEnd: "23:00",
      cleaningMinutes: opts.cleaningMinutes ?? 30,
      baseCapacity: 6,
      maxCapacity: 8,
      basePrice: 800,
      extraGuestPrice: 200,
      minBookingHours: 1,
    },
  });
  const obj = await testDb.bookingObject.create({
    data: {
      objectTypeId: t.id,
      name: "Беседка №1",
      slug: `gazebo-1-${Date.now()}`,
    },
  });
  return obj;
}

async function seedDailyRoom() {
  const cat = await testDb.category.create({
    data: {
      name: "Номера",
      slug: `rooms-${Date.now()}`,
      bookingMode: "DAILY",
    },
  });
  const t = await testDb.objectType.create({
    data: {
      categoryId: cat.id,
      name: "Стандарт",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      cleaningMinutes: 0,
      baseCapacity: 2,
      maxCapacity: 4,
      basePrice: 5000,
      extraGuestPrice: 1500,
    },
  });
  const obj = await testDb.bookingObject.create({
    data: {
      objectTypeId: t.id,
      name: "Номер 101",
      slug: `room-101-${Date.now()}`,
    },
  });
  return obj;
}

const guest = {
  guestName: "Иван Иванов",
  guestEmail: "ivan@test.local",
  guestPhone: "+79991112233",
};

describe("createBooking — HOURLY", () => {
  it("создаёт первую бронь", async () => {
    const obj = await seedHourlyObject();
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-07-01T10:00:00Z",
      endAt: "2026-07-01T13:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.status).toBe("PENDING");
    expect(b.totalPrice.toString()).toBe("2400");
    expect(b.publicCode).toMatch(/^B-/);
  });

  it("блокирует пересекающуюся бронь", async () => {
    const obj = await seedHourlyObject();
    await createBooking({
      objectId: obj.id,
      startAt: "2026-07-01T10:00:00Z",
      endAt: "2026-07-01T13:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    await expect(
      createBooking({
        objectId: obj.id,
        startAt: "2026-07-01T12:00:00Z",
        endAt: "2026-07-01T14:00:00Z",
        guestsCount: 4,
        ...guest,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("блокирует следующую бронь, попадающую в окно уборки", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 60 });
    await createBooking({
      objectId: obj.id,
      startAt: "2026-07-01T10:00:00Z",
      endAt: "2026-07-01T12:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    // 12:00–13:00 попадает в час уборки → конфликт
    await expect(
      createBooking({
        objectId: obj.id,
        startAt: "2026-07-01T12:00:00Z",
        endAt: "2026-07-01T13:00:00Z",
        guestsCount: 4,
        ...guest,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("разрешает следующую бронь сразу после окна уборки", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 60 });
    await createBooking({
      objectId: obj.id,
      startAt: "2026-07-01T10:00:00Z",
      endAt: "2026-07-01T12:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-07-01T13:00:00Z", // после уборки
      endAt: "2026-07-01T15:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.status).toBe("PENDING");
  });

  it("разрешает смежные брони когда уборки нет", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    await createBooking({
      objectId: obj.id,
      startAt: "2026-07-01T10:00:00Z",
      endAt: "2026-07-01T12:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-07-01T12:00:00Z",
      endAt: "2026-07-01T14:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.status).toBe("PENDING");
  });

  it("блок объекта блокирует бронь", async () => {
    const obj = await seedHourlyObject();
    await testDb.objectBlock.create({
      data: {
        objectId: obj.id,
        startAt: new Date("2026-07-01T10:00:00Z"),
        endAt: new Date("2026-07-01T15:00:00Z"),
        reason: "ремонт",
      },
    });
    await expect(
      createBooking({
        objectId: obj.id,
        startAt: "2026-07-01T11:00:00Z",
        endAt: "2026-07-01T13:00:00Z",
        guestsCount: 4,
        ...guest,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("отклоняет бронь короче minBookingHours", async () => {
    const obj = await seedHourlyObject(); // у seed minBookingHours=1 по умолчанию
    // Поднимаем минимум на 3 часа
    await testDb.objectType.update({
      where: { id: (await testDb.bookingObject.findUnique({ where: { id: obj.id } }))!.objectTypeId },
      data: { minBookingHours: 3 },
    });
    await expect(
      createBooking({
        objectId: obj.id,
        startAt: "2026-07-10T10:00:00Z",
        endAt: "2026-07-10T11:00:00Z", // 1 час
        guestsCount: 4,
        ...guest,
      }),
    ).rejects.toThrow(/Минимум|Минимальная/);
  });

  it("отклоняет бронь длиннее maxBookingHours", async () => {
    const obj = await seedHourlyObject();
    await testDb.objectType.update({
      where: { id: (await testDb.bookingObject.findUnique({ where: { id: obj.id } }))!.objectTypeId },
      data: { minBookingHours: 1, maxBookingHours: 4 },
    });
    await expect(
      createBooking({
        objectId: obj.id,
        startAt: "2026-07-11T10:00:00Z",
        endAt: "2026-07-11T16:00:00Z", // 6 часов
        guestsCount: 4,
        ...guest,
      }),
    ).rejects.toThrow(/Максимум|Максимальная/);
  });

  it("min hours = null трактуется как 1 (не пропускает 0/отрицательные интервалы)", async () => {
    const obj = await seedHourlyObject();
    await testDb.objectType.update({
      where: { id: (await testDb.bookingObject.findUnique({ where: { id: obj.id } }))!.objectTypeId },
      data: { minBookingHours: null },
    });
    // 1 час — должен пройти
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-07-12T10:00:00Z",
      endAt: "2026-07-12T11:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.status).toBe("PENDING");
  });

  it("параллельные брони одновременно: создаётся только одна", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    const calls = await Promise.allSettled([
      createBooking({
        objectId: obj.id,
        startAt: "2026-07-02T10:00:00Z",
        endAt: "2026-07-02T12:00:00Z",
        guestsCount: 4,
        ...guest,
      }),
      createBooking({
        objectId: obj.id,
        startAt: "2026-07-02T11:00:00Z",
        endAt: "2026-07-02T13:00:00Z",
        guestsCount: 4,
        ...guest,
      }),
    ]);
    const ok = calls.filter((c) => c.status === "fulfilled").length;
    const failed = calls.filter((c) => c.status === "rejected").length;
    expect(ok).toBe(1);
    expect(failed).toBe(1);
  });
});

describe("createBooking — DAILY", () => {
  it("создаёт суточную бронь, цена за число ночей", async () => {
    const obj = await seedDailyRoom();
    const b = await createBooking({
      objectId: obj.id,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-12",
      guestsCount: 2,
      ...guest,
    });
    expect(b.totalPrice.toString()).toBe("10000");
    // 14:00 МСК → 11:00 UTC
    expect(b.startAt.toISOString()).toBe("2026-07-10T11:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-07-12T09:00:00.000Z");
  });

  it("доплата за допместо", async () => {
    const obj = await seedDailyRoom();
    const b = await createBooking({
      objectId: obj.id,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-11",
      guestsCount: 4,
      ...guest,
    });
    // 5000 + 2 допместа * 1500 * 1 ночь = 8000
    expect(b.totalPrice.toString()).toBe("8000");
  });

  it("блокирует пересекающуюся бронь по датам", async () => {
    const obj = await seedDailyRoom();
    await createBooking({
      objectId: obj.id,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-12",
      guestsCount: 2,
      ...guest,
    });
    await expect(
      createBooking({
        objectId: obj.id,
        checkInDate: "2026-07-11",
        checkOutDate: "2026-07-13",
        guestsCount: 2,
        ...guest,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });
});

describe("createBooking — слоты", () => {
  async function seedFishingSpot() {
    const cat = await testDb.category.create({
      data: { name: "Мостики", slug: `bridges-${Date.now()}`, bookingMode: "HOURLY" },
    });
    const t = await testDb.objectType.create({
      data: {
        categoryId: cat.id,
        name: "Рыболовное место",
        cleaningMinutes: 0,
        baseCapacity: 2,
        maxCapacity: 4,
        basePrice: 400,
        extraGuestPrice: 100,
      },
    });
    const day = await testDb.objectTypeSlot.create({
      data: { objectTypeId: t.id, name: "День", startTime: "09:00", endTime: "21:00", endDayOffset: 0, priceOverride: 1000 },
    });
    const night = await testDb.objectTypeSlot.create({
      data: { objectTypeId: t.id, name: "Ночь", startTime: "21:00", endTime: "09:00", endDayOffset: 1, priceOverride: 1500 },
    });
    const full = await testDb.objectTypeSlot.create({
      data: { objectTypeId: t.id, name: "Сутки", startTime: "09:00", endTime: "09:00", endDayOffset: 1, priceOverride: 2200 },
    });
    const weekend = await testDb.objectTypeSlot.create({
      data: { objectTypeId: t.id, name: "Выходные 36ч", startTime: "09:00", endTime: "21:00", endDayOffset: 1, priceOverride: 3500 },
    });
    const twoDay = await testDb.objectTypeSlot.create({
      data: { objectTypeId: t.id, name: "Двое суток", startTime: "09:00", endTime: "09:00", endDayOffset: 2, priceOverride: 4000 },
    });
    const obj = await testDb.bookingObject.create({
      data: { objectTypeId: t.id, name: "Мостик", slug: `bridge-${Date.now()}` },
    });
    return { obj, day, night, full, weekend, twoDay };
  }

  it("дневной слот: 09:00→21:00, цена = priceOverride", async () => {
    const { obj, day } = await seedFishingSpot();
    const b = await createBooking({
      objectId: obj.id,
      slotId: day.id,
      slotDate: "2026-07-20",
      guestsCount: 2,
      ...guest,
    });
    expect(b.startAt.toISOString()).toBe("2026-07-20T06:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-07-20T18:00:00.000Z");
    expect(b.totalPrice.toString()).toBe("1000");
  });

  it("ночной слот: переходит через полночь", async () => {
    const { obj, night } = await seedFishingSpot();
    const b = await createBooking({
      objectId: obj.id,
      slotId: night.id,
      slotDate: "2026-07-20",
      guestsCount: 2,
      ...guest,
    });
    expect(b.startAt.toISOString()).toBe("2026-07-20T18:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-07-21T06:00:00.000Z");
    expect(b.totalPrice.toString()).toBe("1500");
  });

  it("суточный слот: 09:00→09:00 след. дня + допгости", async () => {
    const { obj, full } = await seedFishingSpot();
    const b = await createBooking({
      objectId: obj.id,
      slotId: full.id,
      slotDate: "2026-07-20",
      guestsCount: 4,
      ...guest,
    });
    expect(b.startAt.toISOString()).toBe("2026-07-20T06:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-07-21T06:00:00.000Z");
    // 2200 + 2 допгостя × 100 = 2400
    expect(b.totalPrice.toString()).toBe("2400");
  });

  it("дневной + ночной в один день не пересекаются", async () => {
    const { obj, day, night } = await seedFishingSpot();
    await createBooking({
      objectId: obj.id,
      slotId: day.id,
      slotDate: "2026-07-21",
      guestsCount: 2,
      ...guest,
    });
    const b = await createBooking({
      objectId: obj.id,
      slotId: night.id,
      slotDate: "2026-07-21",
      guestsCount: 2,
      ...guest,
    });
    expect(b.status).toBe("PENDING");
  });

  it("суточный пересекается с ночным предыдущего дня", async () => {
    const { obj, night, full } = await seedFishingSpot();
    // ночь 22.07 21:00 → 23.07 09:00
    await createBooking({
      objectId: obj.id,
      slotId: night.id,
      slotDate: "2026-07-22",
      guestsCount: 2,
      ...guest,
    });
    // сутки 22.07 09:00 → 23.07 09:00 — пересекаются
    await expect(
      createBooking({
        objectId: obj.id,
        slotId: full.id,
        slotDate: "2026-07-22",
        guestsCount: 2,
        ...guest,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("слот 36ч: 09:00 → 21:00 след. дня (endDayOffset=1)", async () => {
    const { obj, weekend } = await seedFishingSpot();
    const b = await createBooking({
      objectId: obj.id,
      slotId: weekend.id,
      slotDate: "2026-07-25",
      guestsCount: 2,
      ...guest,
    });
    expect(b.startAt.toISOString()).toBe("2026-07-25T06:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-07-26T18:00:00.000Z");
    expect(b.totalPrice.toString()).toBe("3500");
  });

  it("слот 48ч: 09:00 → 09:00 +2 дня (endDayOffset=2)", async () => {
    const { obj, twoDay } = await seedFishingSpot();
    const b = await createBooking({
      objectId: obj.id,
      slotId: twoDay.id,
      slotDate: "2026-07-25",
      guestsCount: 2,
      ...guest,
    });
    expect(b.startAt.toISOString()).toBe("2026-07-25T06:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-07-27T06:00:00.000Z");
    expect(b.totalPrice.toString()).toBe("4000");
  });

  it("слот 36ч в пятницу блокирует бронирование того же объекта в субботу", async () => {
    const { obj, weekend, day } = await seedFishingSpot();
    // 36ч: пт 25.07 09:00 → сб 26.07 21:00
    await createBooking({
      objectId: obj.id,
      slotId: weekend.id,
      slotDate: "2026-07-25",
      guestsCount: 2,
      ...guest,
    });
    // дневной слот в сб 26.07 09:00–21:00 — пересекается
    await expect(
      createBooking({
        objectId: obj.id,
        slotId: day.id,
        slotDate: "2026-07-26",
        guestsCount: 2,
        ...guest,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });
});

describe("slotCreateSchema validation", () => {
  it("отвергает endTime <= startTime при endDayOffset=0", async () => {
    const { slotCreateSchema } = await import("../src/lib/validators");
    const res = slotCreateSchema.safeParse({
      name: "Сломанный",
      startTime: "21:00",
      endTime: "09:00",
      endDayOffset: 0,
    });
    expect(res.success).toBe(false);
  });

  it("принимает endTime <= startTime при endDayOffset>=1", async () => {
    const { slotCreateSchema } = await import("../src/lib/validators");
    const res = slotCreateSchema.safeParse({
      name: "Ночь",
      startTime: "21:00",
      endTime: "09:00",
      endDayOffset: 1,
    });
    expect(res.success).toBe(true);
  });
});

describe("createBooking — предоплата", () => {
  it("по умолчанию 100% — prepaymentAmount = totalPrice", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-08-10T10:00:00Z",
      endAt: "2026-08-10T13:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.paymentPercent).toBe(100);
    expect(b.prepaymentAmount.toString()).toBe(b.totalPrice.toString());
  });

  it("override на типе: 30% от 2400 = 720", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    const objWithType = await testDb.bookingObject.findUnique({ where: { id: obj.id } });
    await testDb.objectType.update({
      where: { id: objWithType!.objectTypeId },
      data: { paymentPercent: 30 },
    });
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-08-11T10:00:00Z",
      endAt: "2026-08-11T13:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.paymentPercent).toBe(30);
    expect(b.totalPrice.toString()).toBe("2400");
    expect(b.prepaymentAmount.toString()).toBe("720");
  });

  it("глобальный из Settings когда у типа null", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    await testDb.settings.upsert({
      where: { key: "paymentPercent" },
      create: { key: "paymentPercent", value: 50 },
      update: { value: 50 },
    });
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-08-12T10:00:00Z",
      endAt: "2026-08-12T13:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.paymentPercent).toBe(50);
    expect(b.prepaymentAmount.toString()).toBe("1200");
    // подчистим глобал чтобы не влиять на следующие тесты
    await testDb.settings.delete({ where: { key: "paymentPercent" } });
  });

  it("override типа имеет приоритет над глобалом", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    const oo = await testDb.bookingObject.findUnique({ where: { id: obj.id } });
    await testDb.objectType.update({
      where: { id: oo!.objectTypeId },
      data: { paymentPercent: 25 },
    });
    await testDb.settings.upsert({
      where: { key: "paymentPercent" },
      create: { key: "paymentPercent", value: 50 },
      update: { value: 50 },
    });
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-08-13T10:00:00Z",
      endAt: "2026-08-13T13:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    expect(b.paymentPercent).toBe(25);
    expect(b.prepaymentAmount.toString()).toBe("600");
    await testDb.settings.delete({ where: { key: "paymentPercent" } });
  });
});

describe("cancelExpiredBookings", () => {
  it("отменяет PENDING-брони старше 15 минут", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    const b = await createBooking({
      objectId: obj.id,
      startAt: "2026-07-05T10:00:00Z",
      endAt: "2026-07-05T12:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    // Имитируем что бронь создана 20 минут назад
    await testDb.booking.update({
      where: { id: b.id },
      data: { createdAt: new Date(Date.now() - 20 * 60_000) },
    });
    const count = await cancelExpiredBookings();
    expect(count).toBe(1);
    const after = await testDb.booking.findUnique({ where: { id: b.id } });
    expect(after?.status).toBe("CANCELLED");
  });

  it("не трогает свежие PENDING-брони", async () => {
    const obj = await seedHourlyObject({ cleaningMinutes: 0 });
    await createBooking({
      objectId: obj.id,
      startAt: "2026-07-06T10:00:00Z",
      endAt: "2026-07-06T12:00:00Z",
      guestsCount: 4,
      ...guest,
    });
    const count = await cancelExpiredBookings();
    expect(count).toBe(0);
  });
});
