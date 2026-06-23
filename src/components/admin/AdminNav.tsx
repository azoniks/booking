"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  CalendarDays,
  Settings,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type NavLeaf = { href: string; label: string };
type NavGroup = { label: string; icon: LucideIcon; items: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).items !== undefined;
}

const NAV: NavEntry[] = [
  { href: "/admin", label: "Дашборд" },
  {
    label: "Каталог",
    icon: Boxes,
    items: [
      { href: "/admin/categories", label: "Категории" },
      { href: "/admin/object-types", label: "Типы объектов" },
      { href: "/admin/objects", label: "Объекты" },
    ],
  },
  {
    label: "Бронирования",
    icon: CalendarDays,
    items: [
      { href: "/admin/bookings", label: "Брони" },
      { href: "/admin/blocks", label: "Блокировки" },
      { href: "/admin/reports", label: "Отчёты" },
    ],
  },
  {
    label: "Система",
    icon: Settings,
    items: [
      { href: "/admin/settings", label: "Настройки" },
      { href: "/admin/admins", label: "Админы" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  // Группа, содержащая активный маршрут.
  const activeGroup = NAV.find(
    (e) => isGroup(e) && e.items.some((it) => isActive(pathname, it.href)),
  ) as NavGroup | undefined;

  const [open, setOpen] = useState<Set<string>>(
    () => new Set(activeGroup ? [activeGroup.label] : []),
  );

  // При смене маршрута дораскрываем группу с активным пунктом.
  useEffect(() => {
    if (activeGroup) {
      setOpen((prev) => {
        if (prev.has(activeGroup.label)) return prev;
        const next = new Set(prev);
        next.add(activeGroup.label);
        return next;
      });
    }
  }, [activeGroup]);

  function toggle(label: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const leafCls = (active: boolean) =>
    `block px-3 py-2 rounded-md text-sm ${
      active ? "bg-slate-100 font-medium" : "hover:bg-slate-100"
    }`;

  return (
    <div className="flex flex-col gap-1">
      {NAV.map((entry) => {
        if (!isGroup(entry)) {
          const active = isActive(pathname, entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              className={`flex items-center gap-2 ${leafCls(active)}`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
              {entry.label}
            </Link>
          );
        }

        const Icon = entry.icon;
        const expanded = open.has(entry.label);
        const groupActive = entry.items.some((it) => isActive(pathname, it.href));

        return (
          <div key={entry.label}>
            <button
              type="button"
              onClick={() => toggle(entry.label)}
              aria-expanded={expanded}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                groupActive && !expanded ? "bg-slate-100 font-medium" : "hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left">{entry.label}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {expanded && (
              <div className="mt-1 ml-3 pl-3 border-l flex flex-col gap-1">
                {entry.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={onNavigate}
                    className={leafCls(isActive(pathname, it.href))}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
