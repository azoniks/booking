// Снимает скриншоты клиентского флоу бронирования для страницы /how-to-book.
// Требует запущенного приложения (npm run dev) и сгенерированного Prisma-клиента.
// Запуск: node scripts/screenshots.mjs   (BASE_URL по умолчанию http://localhost:3000)
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "how-to-book");
const prisma = new PrismaClient();

async function main() {
  await mkdir(OUT, { recursive: true });

  const obj = await prisma.bookingObject.findFirst({
    where: { status: "ACTIVE", isAddon: false },
    select: { id: true, name: true },
  });
  if (!obj) throw new Error("Нет активного объекта — нечего снимать");
  console.log("Объект для скриншотов:", obj.name, obj.id);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    locale: "ru-RU",
  });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(30000);

  // 1. Каталог объектов
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "01-catalog.png"), fullPage: true });
  console.log("✓ 01-catalog");

  // 2. Форма бронирования объекта
  await page.goto(`${BASE}/booking/${obj.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Бронирование", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000); // дать прогрузиться календарю/занятости/слотам
  await page.screenshot({ path: path.join(OUT, "02-booking.png"), fullPage: true });
  console.log("✓ 02-booking");

  // 3. Контакты + оплата (низ формы)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "03-contacts.png") });
  console.log("✓ 03-contacts");

  // 4. Корзина / оформление заказа
  await page.goto(`${BASE}/booking/cart`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "04-cart.png"), fullPage: true });
  console.log("✓ 04-cart");

  await browser.close();
  await prisma.$disconnect();
  console.log("Готово →", OUT);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
