import { z } from "zod";

export const BookingModeEnum = z.enum(["DAILY", "HOURLY", "FULL_DAY"]);
export const ObjectStatusEnum = z.enum(["ACTIVE", "HIDDEN", "MAINTENANCE"]);
export const MediaTypeEnum = z.enum(["IMAGE", "VIDEO", "PANO360"]);

export const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm");

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(60).optional(),
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isVisible: z.boolean().default(true),
  bookingMode: BookingModeEnum,
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const objectTypeCreateSchema = z
  .object({
    categoryId: z.string().min(1),
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional().nullable(),
    checkInTime: HHMM.optional().nullable(),
    checkOutTime: HHMM.optional().nullable(),
    hourlyStepMinutes: z.coerce.number().int().min(15).max(240).optional().nullable(),
    workingHoursStart: HHMM.optional().nullable(),
    workingHoursEnd: HHMM.optional().nullable(),
    minBookingHours: z.coerce.number().int().min(1).max(48).optional().nullable(),
    maxBookingHours: z.coerce.number().int().min(1).max(48).optional().nullable(),
    cleaningMinutes: z.coerce.number().int().min(0).max(720).default(0),
    baseCapacity: z.coerce.number().int().min(1),
    maxCapacity: z.coerce.number().int().min(1),
    basePrice: z.coerce.number().nonnegative(),
    extraGuestPrice: z.coerce.number().nonnegative().default(0),
    paymentPercent: z.coerce.number().int().min(1).max(100).optional().nullable(),
  })
  .refine((d) => d.maxCapacity >= d.baseCapacity, {
    message: "maxCapacity должен быть >= baseCapacity",
    path: ["maxCapacity"],
  });

export const objectTypeUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional().nullable(),
    checkInTime: HHMM.optional().nullable(),
    checkOutTime: HHMM.optional().nullable(),
    hourlyStepMinutes: z.coerce.number().int().min(15).max(240).optional().nullable(),
    workingHoursStart: HHMM.optional().nullable(),
    workingHoursEnd: HHMM.optional().nullable(),
    minBookingHours: z.coerce.number().int().min(1).max(48).optional().nullable(),
    maxBookingHours: z.coerce.number().int().min(1).max(48).optional().nullable(),
    cleaningMinutes: z.coerce.number().int().min(0).max(720).optional(),
    baseCapacity: z.coerce.number().int().min(1).optional(),
    maxCapacity: z.coerce.number().int().min(1).optional(),
    basePrice: z.coerce.number().nonnegative().optional(),
    extraGuestPrice: z.coerce.number().nonnegative().optional(),
    paymentPercent: z.coerce.number().int().min(1).max(100).optional().nullable(),
  });

export const objectCreateSchema = z.object({
  objectTypeId: z.string().min(1),
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(60).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: ObjectStatusEnum.default("ACTIVE"),
  sortOrder: z.coerce.number().int().default(0),
});
export const objectUpdateSchema = objectCreateSchema.partial();

export const blockCreateSchema = z.object({
  objectId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(500).optional().nullable(),
});

export const adminCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
});

export const adminUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const settingsUpdateSchema = z.record(z.string(), z.any());

// startTime === endTime трактуется как суточный слот через полночь
// (booking-service ставит endAt на следующий день при endTime <= startTime).
export const slotCreateSchema = z.object({
  name: z.string().min(1).max(50),
  startTime: HHMM,
  endTime: HHMM,
  priceOverride: z.coerce.number().nonnegative().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

export const slotUpdateSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    startTime: HHMM.optional(),
    endTime: HHMM.optional(),
    priceOverride: z.coerce.number().nonnegative().optional().nullable(),
    sortOrder: z.coerce.number().int().optional(),
  });

export const publicBookingSchema = z
  .object({
    objectId: z.string().min(1),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    slotId: z.string().min(1).optional(),
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // FULL_DAY: одна дата, бронь на весь рабочий день типа.
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    guestsCount: z.coerce.number().int().min(1).max(50),
    guestName: z.string().min(2).max(100),
    guestEmail: z.string().email(),
    guestPhone: z.string().min(5).max(30),
    guestComment: z.string().max(1000).optional(),
  });

// Админская ручная бронь: email/телефон необязательны (можно вписать «-»),
// markAsPaid=true сразу выставляет PAID и пропускает Tinkoff.
export const adminBookingSchema = z.object({
  objectId: z.string().min(1),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  slotId: z.string().min(1).optional(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestsCount: z.coerce.number().int().min(1).max(50),
  guestName: z.string().min(2).max(100),
  guestEmail: z.string().email().or(z.literal("")).optional(),
  guestPhone: z.string().min(1).max(30),
  guestComment: z.string().max(1000).optional(),
  markAsPaid: z.boolean().optional().default(true),
});

export const availabilityQuerySchema = z.object({
  objectId: z.string().min(1),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});
