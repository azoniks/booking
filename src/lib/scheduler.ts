import { prisma } from "./db";
import {
  cancelExpiredBookings,
  findExpiringPendingBookings,
  findExpiringPendingGroups,
} from "./booking-service";
import {
  sendReminder,
  sendPaymentLinkEmail,
  sendPaymentLinkGroupEmail,
} from "./notifications/email";
import { recordServerError } from "./server-errors";

function logSchedulerError(job: string, e: unknown) {
  console.error(`[scheduler] ${job}:`, e);
  void recordServerError({
    source: "SCHEDULER",
    path: `scheduler:${job}`,
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : null,
  });
}

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  // Каждые 60 секунд: сначала напоминаем об оплате тем, у кого срок почти вышел,
  // затем отменяем уже просроченные PENDING-брони. Окна не пересекаются
  // (напоминаем тех, кто ещё не истёк), порядок не критичен. Дедуп — внутри
  // sendPaymentLink* по kind, поэтому письмо уходит один раз.
  setInterval(async () => {
    try {
      const [bks, grps] = await Promise.all([
        findExpiringPendingBookings(),
        findExpiringPendingGroups(),
      ]);
      await Promise.allSettled([
        ...bks.map((b) => sendPaymentLinkEmail(b.id, { reminder: true })),
        ...grps.map((g) => sendPaymentLinkGroupEmail(g.id, { reminder: true })),
      ]);
    } catch (e) {
      logSchedulerError("expiry-reminder", e);
    }
    try {
      const n = await cancelExpiredBookings();
      if (n > 0) console.log(`[scheduler] cancelled ${n} expired pending bookings`);
    } catch (e) {
      logSchedulerError("cancel", e);
    }
  }, 60_000);

  // Каждые 60 минут — напоминания за 24 часа
  setInterval(async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const targets = await prisma.booking.findMany({
        where: {
          // Подтверждённые брони: полностью оплаченные и с внесённым авансом.
          status: { in: ["PAID", "PREPAID"] },
          reminderSentAt: null,
          startAt: { gte: in24h, lte: in25h },
        },
        select: { id: true },
      });
      for (const t of targets) {
        await sendReminder(t.id).catch((e) => console.error("[reminder]", e));
      }
      if (targets.length > 0) {
        console.log(`[scheduler] sent ${targets.length} reminders`);
      }
    } catch (e) {
      logSchedulerError("reminders", e);
    }
  }, 60 * 60_000);

  console.log("[scheduler] started");
}
