/**
 * Ключи настроек, значения которых считаются секретами:
 * GET /api/admin/settings возвращает их как маркер "***",
 * PUT не перезаписывает их при пустом значении или маске.
 */
export const SECRET_KEYS = new Set<string>([
  // Tinkoff
  "tinkoffTestPassword",
  "tinkoffProdPassword",
  // Telegram
  "telegramBotToken",
  // MAX (Tamtam Bot API)
  "maxBotToken",
  // SMTP
  "smtpPassword",
]);

export const MASK = "***";

export function isMaskOrEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v !== "string") return false;
  return v === "" || v === MASK;
}
