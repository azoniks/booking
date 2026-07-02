"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CartBadge } from "@/components/client/CartBadge";
import { ClientHeaderNav } from "@/components/client/ClientHeaderNav";
import { useSiteConfig } from "@/components/client/SiteConfigProvider";

export type Crumb = { label: string; href?: string };

/**
 * Общая шапка клиентской витрины: кликабельный логотип + название (ведут на
 * главную), корзина и меню (ClientHeaderNav). Данные берёт из SiteConfig
 * (заполняется в корневом layout), поэтому работает и на серверных, и на
 * клиентских страницах без проброса пропсов.
 *
 * breadcrumbs — путь для дочерних страниц. «Главная» добавляется автоматически
 * первой крошкой; передавать нужно только последующие уровни. На главной
 * крошки не передаются.
 */
export function SiteHeader({ breadcrumbs }: { breadcrumbs?: Crumb[] }) {
  const { siteName, siteLogoUrl, siteContact, mainSiteUrl } = useSiteConfig();

  return (
    <header className="border-b bg-white sticky top-0 z-10">
      <div className="container py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0 group">
          {siteLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={siteLogoUrl}
              alt={siteName}
              className="h-10 w-auto object-contain shrink-0"
            />
          )}
          <span className="text-xl md:text-2xl font-bold truncate group-hover:text-primary transition-colors">
            {siteName}
          </span>
        </Link>
        <div className="flex items-center gap-3 shrink-0">
          <CartBadge />
          <ClientHeaderNav
            siteName={siteName}
            siteContact={siteContact}
            mainSiteUrl={mainSiteUrl}
          />
        </div>
      </div>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="border-t bg-slate-50/60">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}
    </header>
  );
}

/** Хлебные крошки. «Главная» (ссылка на /) всегда идёт первой. */
function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "Главная", href: "/" }, ...items];
  return (
    <nav aria-label="Хлебные крошки" className="container py-2">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "font-medium text-foreground" : undefined} aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
