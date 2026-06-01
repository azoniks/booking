"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InstallAppHint } from "@/components/client/InstallAppHint";

type NavItem = { href: string; label: string };

export function AdminMobileNav({
  navItems,
  siteName,
  logoUrl,
  userEmail,
  mainSiteUrl,
  signOutAction,
}: {
  navItems: NavItem[];
  siteName: string;
  logoUrl: string;
  userEmail: string | null | undefined;
  mainSiteUrl: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden sticky top-0 z-30 border-b bg-white">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2 min-w-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={siteName}
              className="h-8 w-8 object-contain shrink-0"
            />
          )}
          <div className="font-semibold truncate">{siteName}</div>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Открыть меню">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b !pt-6">
              <div className="flex items-center gap-3 min-w-0 pr-6">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={siteName}
                    className="h-9 w-9 object-contain shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <SheetTitle className="truncate">{siteName}</SheetTitle>
                  {userEmail && (
                    <div className="text-xs text-muted-foreground truncate">
                      {userEmail}
                    </div>
                  )}
                </div>
              </div>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {navItems.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={`px-3 py-2 rounded-md text-sm ${
                        active
                          ? "bg-slate-100 font-medium"
                          : "hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
            <div className="p-3 border-t flex flex-col gap-2">
              <div className="[&_button]:w-full">
                <InstallAppHint
                  siteName={siteName}
                  appTitle={`Админка — ${siteName}`}
                  dismissKey="installHintDismissed:admin"
                  showBanner={false}
                />
              </div>
              {mainSiteUrl && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href={mainSiteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    На основной сайт
                  </a>
                </Button>
              )}
              <form action={signOutAction} className="w-full">
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Выйти
                </Button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
