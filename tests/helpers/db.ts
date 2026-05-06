import { PrismaClient } from "@prisma/client";

// Использует DATABASE_URL_TEST если задан, иначе DATABASE_URL.
const url = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL/DATABASE_URL_TEST not set");

export const testDb = new PrismaClient({
  datasources: { db: { url } },
  log: ["error"],
});

export async function cleanDb() {
  // Порядок важен из-за FK
  await testDb.notificationLog.deleteMany();
  await testDb.payment.deleteMany();
  await testDb.booking.deleteMany();
  await testDb.objectBlock.deleteMany();
  await testDb.objectMedia.deleteMany();
  await testDb.bookingObject.deleteMany();
  await testDb.objectType.deleteMany();
  await testDb.category.deleteMany();
  await testDb.adminUser.deleteMany();
  await testDb.settings.deleteMany();
}
