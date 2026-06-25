// Восстанавливает РУЧНЫЕ (админские) брони, ошибочно снятые авто-отменой.
//
// Ручная бронь = авто-отменённая (status=CANCELLED, cancelReason='Истёк срок
// оплаты') и БЕЗ онлайн-платежа (ни на самой брони, ни на её заказе) — у
// клиентских всегда есть Payment от Tinkoff, у ручных нет.
//
// Восстанавливает в PENDING, чистит cancelReason/cancelledAt и ставит
// createdByAdmin=true, чтобы планировщик их больше не трогал.
//
// Запуск (на проде, с подгруженным .env):
//   cd /srv/booking && set -a && . ./.env && set +a && node scripts/restore-cancelled-manual.mjs           # предпросмотр
//   cd /srv/booking && set -a && . ./.env && set +a && node scripts/restore-cancelled-manual.mjs --apply   # применить
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const CANCEL_REASON = "Истёк срок оплаты";

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL не задан. Запусти с подгруженным .env:\n" +
      "  set -a && . ./.env && set +a && node scripts/restore-cancelled-manual.mjs",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.booking.findMany({
    where: { status: "CANCELLED", cancelReason: CANCEL_REASON },
    select: {
      id: true,
      publicCode: true,
      guestName: true,
      cancelledAt: true,
      payment: { select: { id: true } },
      group: { select: { payment: { select: { id: true } } } },
    },
    orderBy: { cancelledAt: "desc" },
  });

  // Ручные = без платежа ни на брони, ни на её заказе.
  const manual = candidates.filter((b) => !b.payment && !b.group?.payment);
  const clientLeft = candidates.length - manual.length;

  console.log(`Авто-отменённых броней всего:            ${candidates.length}`);
  console.log(`  из них клиентских (с платежом, не трогаем): ${clientLeft}`);
  console.log(`  из них РУЧНЫХ (без платежа, к возврату):     ${manual.length}`);
  console.log("");

  if (manual.length === 0) {
    console.log("Нечего восстанавливать.");
    return;
  }

  for (const b of manual) {
    const when = b.cancelledAt ? b.cancelledAt.toISOString() : "—";
    console.log(`  ${b.publicCode} · ${b.guestName} · отменена ${when}`);
  }
  console.log("");

  if (!APPLY) {
    console.log("Это ПРЕДПРОСМОТР — ничего не изменено.");
    console.log("Чтобы применить, перезапусти с флагом --apply");
    return;
  }

  const ids = manual.map((b) => b.id);
  const res = await prisma.booking.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "PENDING",
      cancelReason: null,
      cancelledAt: null,
      createdByAdmin: true,
    },
  });
  console.log(`Восстановлено броней: ${res.count} (статус → PENDING, createdByAdmin=true)`);
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
