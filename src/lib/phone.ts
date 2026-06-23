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
