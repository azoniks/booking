import { config } from "dotenv";
config();

// Подменяем DATABASE_URL на тестовый ДО любых импортов prisma.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
