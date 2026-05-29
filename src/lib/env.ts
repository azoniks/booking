import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  // NextAuth рекомендует минимум 32 символа. Сгенерировать: openssl rand -base64 32
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET должен быть минимум 32 символа (openssl rand -base64 32)"),
  AUTH_URL: z.string().url().optional(),

  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Europe/Moscow"),
  PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(15),

  TINKOFF_TEST_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  TINKOFF_TERMINAL_KEY: z.string().optional().default(""),
  TINKOFF_PASSWORD: z.string().optional().default(""),
  TINKOFF_API_URL: z.string().url().default("https://securepay.tinkoff.ru/v2"),
  MOCK_PAYMENT_SECRET: z.string().min(8).default("dev-mock-secret"),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM: z.string().default("Booking <noreply@example.com>"),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional().default(""),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
