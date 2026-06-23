"use client";

import { useSiteConfig } from "./SiteConfigProvider";

// Чекбокс согласия на обработку ПДн и принятие политики конфиденциальности.
// Ссылки берутся из настроек сайта (useSiteConfig). Если URL не задан —
// соответствующий фрагмент рендерится обычным текстом без ссылки.
export function ConsentCheckbox({
  checked,
  onChange,
  id = "consent",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  const { privacyPolicyUrl, personalDataUrl } = useSiteConfig();

  const link = (href: string, label: string) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline"
      >
        {label}
      </a>
    ) : (
      <span>{label}</span>
    );

  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 shrink-0"
        required
      />
      <span className="text-muted-foreground leading-relaxed">
        Я соглашаюсь на {link(personalDataUrl, "обработку персональных данных")} и
        принимаю {link(privacyPolicyUrl, "политику конфиденциальности")}.
      </span>
    </label>
  );
}
