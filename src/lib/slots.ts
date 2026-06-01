// Чистые хелперы для работы со слотами (ObjectTypeSlot).
// Используются и на сервере, и на клиенте — никаких серверных импортов.

export type SlotLike = {
  startTime: string;
  endTime: string;
  endDayOffset: number;
};

export function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function slotDurationMinutes(s: SlotLike): number {
  return s.endDayOffset * 1440 + timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
}

export function slotDurationHours(s: SlotLike): number {
  return slotDurationMinutes(s) / 60;
}

export function formatSlotEndSuffix(offset: number): string {
  if (offset <= 0) return "";
  if (offset === 1) return " (след. день)";
  return ` (+${offset} дн.)`;
}

export const SLOT_END_DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "в этот же день" },
  { value: 1, label: "на след. день" },
  { value: 2, label: "через 2 дня" },
  { value: 3, label: "через 3 дня" },
];
