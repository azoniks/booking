"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

// Форматирует произвольный ввод в российский номер: +7 (XXX) XXX-XX-XX.
// Берёт только цифры; ведущую 8 трактует как 7; недостающий код страны — 7.
export function formatRuPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d[0] === "8") d = "7" + d.slice(1);
  if (d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11); // 7 + 10 цифр

  const area = d.slice(1, 4);
  const p1 = d.slice(4, 7);
  const p2 = d.slice(7, 9);
  const p3 = d.slice(9, 11);

  let out = "+7";
  if (area) out += ` (${area}`;
  if (area.length === 3) out += ")";
  if (p1) out += ` ${p1}`;
  if (p2) out += `-${p2}`;
  if (p3) out += `-${p3}`;
  return out;
}

type PhoneInputProps = {
  name?: string;
  /** Контролируемое значение (если задано — компонент управляется родителем). */
  value?: string;
  /** Начальное значение для неконтролируемого режима (FormData). */
  defaultValue?: string;
  onChange?: (value: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type"
>;

/**
 * Поле ввода телефона с маской +7 (XXX) XXX-XX-XX. Работает в двух режимах:
 * контролируемом (value/onChange) — для форм на стейте, и неконтролируемом
 * (name + FormData) — для форм без стейта.
 */
export function PhoneInput({
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "+7 (___) ___-__-__",
  ...props
}: PhoneInputProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(() => formatRuPhone(defaultValue ?? ""));
  const display = isControlled ? formatRuPhone(value ?? "") : internal;

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatRuPhone(e.target.value);
    if (!isControlled) setInternal(formatted);
    onChange?.(formatted);
  }

  return (
    <Input
      {...props}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder}
      value={display}
      onChange={handle}
    />
  );
}
