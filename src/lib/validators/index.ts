import { z } from "zod";
import { isCompleteRuPhone } from "@/lib/phone";

// Телефон гостя: обязателен и должен быть указан полностью (+7 и 10 цифр).
// Единый источник правды для всех точек создания брони (клиент и админ).
export const guestPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine(isCompleteRuPhone, {
    message: "Укажите телефон полностью в формате +7 (XXX) XXX-XX-XX",
  });

export const BookingModeEnum = z.enum(["DAILY", "HOURLY", "FULL_DAY"]);
export const ObjectStatusEnum = z.enum(["ACTIVE", "HIDDEN", "MAINTENANCE"]);
export const MediaTypeEnum = z.enum(["IMAGE", "VIDEO", "PANO360"]);
export const PrepaymentTypeEnum = z.enum(["PERCENT", "FIXED"]);

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

const sectionsFields = {
  sectionsTotal: z.coerce.number().int().min(2).max(100).optional().nullable(),
  sectionCapacity: z.coerce.number().int().min(1).max(100).optional().nullable(),
  sectionsBookingMax: z.coerce.number().int().min(1).max(100).optional().nullable(),
  fullVenuePrice: z.coerce.number().nonnegative().optional().nullable(),
};

const prepaymentFields = {
  paymentType: PrepaymentTypeEnum.optional(),
  paymentPercent: z.coerce.number().int().min(1).max(100).optional().nullable(),
  paymentAmount: z.coerce.number().positive().optional().nullable(),
};

// Если paymentType = FIXED, paymentAmount обязателен и > 0.
function prepaymentRefine<T extends {
  paymentType?: "PERCENT" | "FIXED";
  paymentAmount?: number | null;
}>(d: T): boolean {
  if (d.paymentType === "FIXED") {
    return typeof d.paymentAmount === "number" && d.paymentAmount > 0;
  }
  return true;
}

// Либо все три секционных поля заданы вместе, либо все null.
// sectionsBookingMax ≤ sectionsTotal.
function sectionsRefine<T extends {
  sectionsTotal?: number | null;
  sectionCapacity?: number | null;
  sectionsBookingMax?: number | null;
}>(d: T): boolean {
  const t = d.sectionsTotal ?? null;
  const c = d.sectionCapacity ?? null;
  const m = d.sectionsBookingMax ?? null;
  const filled = [t, c].filter((v) => v !== null).length;
  if (filled !== 0 && filled !== 2) return false;
  if (t !== null && m !== null && m > t) return false;
  return true;
}

export const objectTypeCreateSchema = z
  .object({
    categoryId: z.string().min(1),
    name: z.string().min(1).max(100),
    description: z.string().max(5000).optional().nullable(),
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
    sortOrder: z.coerce.number().int().default(0),
    ...prepaymentFields,
    ...sectionsFields,
  })
  .refine((d) => d.maxCapacity >= d.baseCapacity, {
    message: "maxCapacity должен быть >= baseCapacity",
    path: ["maxCapacity"],
  })
  .refine(sectionsRefine, {
    message:
      "sectionsTotal и sectionCapacity должны быть заданы вместе; sectionsBookingMax ≤ sectionsTotal",
    path: ["sectionsTotal"],
  })
  .refine(prepaymentRefine, {
    message: "Для фиксированной предоплаты укажите сумму больше 0",
    path: ["paymentAmount"],
  });

export const objectTypeUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(5000).optional().nullable(),
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
    sortOrder: z.coerce.number().int().optional(),
    ...prepaymentFields,
    ...sectionsFields,
  })
  .refine(sectionsRefine, {
    message:
      "sectionsTotal и sectionCapacity должны быть заданы вместе; sectionsBookingMax ≤ sectionsTotal",
    path: ["sectionsTotal"],
  })
  .refine(prepaymentRefine, {
    message: "Для фиксированной предоплаты укажите сумму больше 0",
    path: ["paymentAmount"],
  });

export const objectCreateSchema = z.object({
  objectTypeId: z.string().min(1),
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(60).optional(),
  description: z.string().max(10000).optional().nullable(),
  status: ObjectStatusEnum.default("ACTIVE"),
  sortOrder: z.coerce.number().int().default(0),
  // Объект-аддон (бронируется только с родителем).
  isAddon: z.boolean().optional(),
  // id объектов-аддонов, предлагаемых при броне этого объекта (relation set).
  addonIds: z.array(z.string()).optional(),
});
export const objectUpdateSchema = objectCreateSchema.partial();

export const blockCreateSchema = z.object({
  objectIds: z.array(z.string().min(1)).min(1),
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

// endDayOffset: на сколько дней endTime смещён относительно даты начала
// (0 — тот же день, 1 — след. день и т.д.). Длительность слота должна
// быть положительной: endDayOffset * 1440 + endMin - startMin > 0.
const slotDurationPositive = (v: {
  startTime: string;
  endTime: string;
  endDayOffset: number;
}) => {
  const [sh, sm] = v.startTime.split(":").map(Number);
  const [eh, em] = v.endTime.split(":").map(Number);
  return v.endDayOffset * 1440 + (eh * 60 + em) - (sh * 60 + sm) > 0;
};

export const slotCreateSchema = z
  .object({
    name: z.string().min(1).max(50),
    startTime: HHMM,
    endTime: HHMM,
    endDayOffset: z.coerce.number().int().min(0).max(7).default(0),
    priceOverride: z.coerce.number().nonnegative().optional().nullable(),
    sortOrder: z.coerce.number().int().default(0),
  })
  .refine(slotDurationPositive, {
    message: "Длительность слота должна быть больше нуля",
    path: ["endTime"],
  });

export const slotUpdateSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    startTime: HHMM.optional(),
    endTime: HHMM.optional(),
    endDayOffset: z.coerce.number().int().min(0).max(7).optional(),
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
    guestsCount: z.coerce.number().int().min(1).max(1000),
    guestName: z.string().min(2).max(100),
    guestEmail: z.string().email(),
    guestPhone: guestPhoneSchema,
    guestComment: z.string().max(1000).optional(),
  });

// Групповая (мульти-объектная) бронь: один блок гостя + массив позиций,
// у каждой свои параметры расписания и число гостей.
const bookingGroupItemSchema = z.object({
  objectId: z.string().min(1),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  slotId: z.string().min(1).optional(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestsCount: z.coerce.number().int().min(1).max(1000),
});

export const publicBookingGroupSchema = z.object({
  guestName: z.string().min(2).max(100),
  guestEmail: z.string().email(),
  guestPhone: guestPhoneSchema,
  guestComment: z.string().max(1000).optional(),
  items: z.array(bookingGroupItemSchema).min(1).max(20),
});

// Состояние оплаты при ручном создании брони/заказа администратором:
// none — не оплачено (PENDING), prepaid — аванс внесён (PREPAID),
// paid — полностью оплачено (PAID).
export const paymentStateSchema = z
  .enum(["none", "prepaid", "paid"])
  .default("none");
export type PaymentState = z.infer<typeof paymentStateSchema>;

// Маппинг состояния оплаты в статус брони/заказа + момент полной оплаты.
// paidAt выставляется только при полной оплате (PAID).
export function paymentStateToStatus(state: PaymentState): {
  status: "PENDING" | "PREPAID" | "PAID";
  paidAt: Date | null;
} {
  if (state === "paid") return { status: "PAID", paidAt: new Date() };
  if (state === "prepaid") return { status: "PREPAID", paidAt: null };
  return { status: "PENDING", paidAt: null };
}

// Админское ручное создание группового заказа: email необязателен,
// телефон обязателен и должен быть указан полностью (как у клиента),
// paymentState задаёт стартовый статус оплаты (без Tinkoff).
export const adminBookingGroupSchema = z.object({
  guestName: z.string().min(2).max(100),
  guestEmail: z.string().email().or(z.literal("")).optional(),
  guestPhone: guestPhoneSchema,
  guestComment: z.string().max(1000).optional(),
  paymentState: paymentStateSchema,
  items: z.array(bookingGroupItemSchema).min(1).max(20),
});

// Перенос брони: поля расписания по режиму объекта + число гостей.
// Конкретный набор полей зависит от режима (DAILY/HOURLY/FULL_DAY).
export const bookingRescheduleSchema = z.object({
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  slotId: z.string().min(1).optional(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestsCount: z.coerce.number().int().min(1).max(1000),
});

// Админская ручная бронь: email необязателен, телефон обязателен и должен
// быть указан полностью (как у клиента); paymentState задаёт стартовый
// статус оплаты и пропускает Tinkoff.
export const adminBookingSchema = z.object({
  objectId: z.string().min(1),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  slotId: z.string().min(1).optional(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestsCount: z.coerce.number().int().min(1).max(1000),
  guestName: z.string().min(2).max(100),
  guestEmail: z.string().email().or(z.literal("")).optional(),
  guestPhone: guestPhoneSchema,
  guestComment: z.string().max(1000).optional(),
  paymentState: paymentStateSchema,
});

export const availabilityQuerySchema = z.object({
  objectId: z.string().min(1),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});
