import { prisma } from "./db";
import { findConflicts } from "./availability";
import { calcPrice } from "./pricing";
import { generatePublicCode } from "./utils";
import { localDateTimeToUtc } from "./time";
import { env } from "./env";
import { Prisma } from "@prisma/client";

export class BookingConflictError extends Error {
  constructor() {
    super("Объект уже забронирован на выбранный интервал");
    this.name = "BookingConflictError";
  }
}

export class ObjectNotAvailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ObjectNotAvailableError";
  }
}

export interface CreateBookingArgs {
  objectId: string;
  // Для DAILY: даты в формате YYYY-MM-DD (заезд/выезд). Для HOURLY игнорируется.
  checkInDate?: string;
  checkOutDate?: string;
  // Для HOURLY: ISO datetime. Игнорируется если задан slotId.
  startAt?: string;
  endAt?: string;
  // Для HOURLY со слотами:
  slotId?: string;
  slotDate?: string; // "YYYY-MM-DD"
  guestsCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestComment?: string;
}

function addDayISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function createBooking(args: CreateBookingArgs) {
  const obj = await prisma.bookingObject.findUnique({
    where: { id: args.objectId },
    include: {
      objectType: { include: { category: true, slots: true } },
    },
  });

  if (!obj) throw new ObjectNotAvailableError("Объект не найден");
  if (obj.status !== "ACTIVE")
    throw new ObjectNotAvailableError("Объект недоступен для бронирования");

  const t = obj.objectType;
  const mode = t.category.bookingMode;

  let startAt: Date, endAt: Date;
  let slotPriceOverride: number | null = null;

  if (mode === "DAILY") {
    if (!args.checkInDate || !args.checkOutDate)
      throw new Error("checkInDate и checkOutDate обязательны для DAILY");
    if (!t.checkInTime || !t.checkOutTime)
      throw new Error("Тип объекта не настроен (нет checkInTime/checkOutTime)");
    startAt = localDateTimeToUtc(args.checkInDate, t.checkInTime);
    endAt = localDateTimeToUtc(args.checkOutDate, t.checkOutTime);
  } else if (args.slotId) {
    if (!args.slotDate) throw new Error("slotDate обязателен для slotId");
    const slot = t.slots.find((s) => s.id === args.slotId);
    if (!slot) throw new Error("Слот не найден или относится к другому типу");
    const [sh, sm] = slot.startTime.split(":").map(Number);
    const [eh, em] = slot.endTime.split(":").map(Number);
    const crosses = eh * 60 + em <= sh * 60 + sm; // через полночь
    startAt = localDateTimeToUtc(args.slotDate, slot.startTime);
    endAt = localDateTimeToUtc(crosses ? addDayISO(args.slotDate) : args.slotDate, slot.endTime);
    slotPriceOverride = slot.priceOverride ? Number(slot.priceOverride) : null;
  } else {
    if (!args.startAt || !args.endAt)
      throw new Error("startAt и endAt обязательны для HOURLY");
    startAt = new Date(args.startAt);
    endAt = new Date(args.endAt);
  }

  if (endAt <= startAt)
    throw new Error("Время окончания должно быть после времени начала");

  if (args.guestsCount < 1 || args.guestsCount > t.maxCapacity)
    throw new Error(
      `Гостей: от 1 до ${t.maxCapacity}`,
    );

  if (mode === "HOURLY" && !args.slotId) {
    const hours = (endAt.getTime() - startAt.getTime()) / 3_600_000;
    const minH = t.minBookingHours ?? 1;
    if (hours + 1e-9 < minH)
      throw new Error(`Минимальная длительность: ${minH} ч`);
    if (t.maxBookingHours && hours - 1e-9 > t.maxBookingHours)
      throw new Error(`Максимальная длительность: ${t.maxBookingHours} ч`);
  }

  // Pricing: если у слота задан priceOverride — используем его.
  // Иначе — обычный units * basePrice. Доплата за допгостей — всегда.
  let pricing: ReturnType<typeof calcPrice>;
  if (slotPriceOverride !== null) {
    const extraGuests = Math.max(0, args.guestsCount - t.baseCapacity);
    const extraCost = new Prisma.Decimal(t.extraGuestPrice).mul(extraGuests);
    const total = new Prisma.Decimal(slotPriceOverride).add(extraCost);
    pricing = {
      units: 1,
      basePriceTotal: new Prisma.Decimal(slotPriceOverride),
      extraGuests,
      extraGuestsCost: extraCost,
      totalPrice: total,
    };
  } else {
    pricing = calcPrice({
      bookingMode: mode,
      startAt,
      endAt,
      basePrice: t.basePrice,
      extraGuestPrice: t.extraGuestPrice,
      guestsCount: args.guestsCount,
      baseCapacity: t.baseCapacity,
      maxCapacity: t.maxCapacity,
    });
  }

  const blockedUntil = new Date(endAt.getTime() + t.cleaningMinutes * 60_000);

  // Процент предоплаты: override типа > глобальный из Settings > 100%.
  const paymentPercent = await resolvePaymentPercent(t.paymentPercent);
  const prepaymentAmount = pricing.totalPrice
    .mul(paymentPercent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // Транзакция Serializable: повторно проверяем пересечения внутри
  // и создаём бронь атомарно.
  const booking = await prisma.$transaction(
    async (tx) => {
      const conflicts = await findConflicts(tx, {
        objectId: obj.id,
        startAt,
        endAt,
        cleaningMinutes: t.cleaningMinutes,
      });
      if (conflicts.bookings.length > 0 || conflicts.blocks.length > 0) {
        throw new BookingConflictError();
      }

      return tx.booking.create({
        data: {
          publicCode: generatePublicCode(),
          objectId: obj.id,
          guestName: args.guestName.trim(),
          guestEmail: args.guestEmail.trim().toLowerCase(),
          guestPhone: args.guestPhone.trim(),
          guestComment: args.guestComment?.trim() || null,
          startAt,
          endAt,
          blockedUntil,
          guestsCount: args.guestsCount,
          extraGuests: pricing.extraGuests,
          basePrice: pricing.basePriceTotal,
          extraGuestsCost: pricing.extraGuestsCost,
          totalPrice: pricing.totalPrice,
          paymentPercent,
          prepaymentAmount,
          status: "PENDING",
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return booking;
}

/**
 * Берёт % предоплаты: сначала override на типе объекта,
 * иначе глобальный из Settings.paymentPercent, иначе 100.
 */
export async function resolvePaymentPercent(typeOverride: number | null): Promise<number> {
  if (typeof typeOverride === "number" && typeOverride > 0) {
    return clampPercent(typeOverride);
  }
  const s = await prisma.settings.findUnique({ where: { key: "paymentPercent" } });
  if (s?.value !== undefined && s.value !== null) {
    const v = Number(s.value);
    if (Number.isFinite(v) && v > 0) return clampPercent(v);
  }
  return 100;
}

function clampPercent(v: number): number {
  return Math.max(1, Math.min(100, Math.round(v)));
}

/**
 * Отмена просроченных PENDING-броней.
 */
export async function cancelExpiredBookings(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - env.PAYMENT_TIMEOUT_MINUTES * 60_000);
  const result = await prisma.booking.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    data: {
      status: "CANCELLED",
      cancelReason: "Истёк срок оплаты",
      cancelledAt: now,
    },
  });
  return result.count;
}
