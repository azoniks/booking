/**
 * Одноразовый бэкфилл постоянных подписок (GuestContact) из уже привязанных
 * броней. Берёт все Booking с непустыми telegramChatId/maxChatId, группирует по
 * нормализованному телефону и заполняет GuestContact (более поздняя бронь
 * перезаписывает chat_id).
 *
 * Запуск: npx tsx scripts/backfill-guest-contacts.ts
 */
import { PrismaClient } from "@prisma/client";
import { normalizePhone } from "../src/lib/phone";

const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [{ telegramChatId: { not: null } }, { maxChatId: { not: null } }],
    },
    select: {
      guestPhone: true,
      telegramChatId: true,
      maxChatId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" }, // поздние перезапишут ранние
  });

  const byPhone = new Map<string, { telegramChatId: string | null; maxChatId: string | null }>();
  for (const b of bookings) {
    const phone = normalizePhone(b.guestPhone);
    if (!phone) continue;
    const cur = byPhone.get(phone) ?? { telegramChatId: null, maxChatId: null };
    if (b.telegramChatId) cur.telegramChatId = b.telegramChatId;
    if (b.maxChatId) cur.maxChatId = b.maxChatId;
    byPhone.set(phone, cur);
  }

  let upserts = 0;
  for (const [phone, chat] of byPhone) {
    await prisma.guestContact.upsert({
      where: { phone },
      create: { phone, telegramChatId: chat.telegramChatId, maxChatId: chat.maxChatId },
      update: { telegramChatId: chat.telegramChatId, maxChatId: chat.maxChatId },
    });
    upserts++;
  }

  console.log(`Готово: обработано броней ${bookings.length}, контактов ${upserts}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
