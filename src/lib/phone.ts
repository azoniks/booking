/**
 * Нормализует телефон к канону "+7XXXXXXXXXX" для устойчивого сопоставления
 * (ключ постоянной подписки гостя). Возвращает "" для пустого ввода.
 */
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if ((raw || "").trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return `+${digits}`;
}

/**
 * Проверяет, что телефон указан полностью: российский номер вида
 * +7XXXXXXXXXX (код страны 7 + 10 цифр). Принимает любой ввод, который
 * normalizePhone сводит к этому канону (с 8, +7, маской и т.п.).
 */
export function isCompleteRuPhone(raw: string): boolean {
  return /^\+7\d{10}$/.test(normalizePhone(raw));
}
