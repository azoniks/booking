"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Phone,
  BookOpen,
  CalendarX,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InstallAppHint } from "@/components/client/InstallAppHint";

/**
 * Навигация в шапке клиентской витрины.
 * Десктоп — пункты в строку; мобайл — всё прячется в бургер.
 * Кнопка установки приложения (InstallAppHint) рендерится двумя экземплярами:
 * десктопный владеет нижним баннером (showBanner по умолчанию), мобильный — без
 * баннера, чтобы баннер не дублировался. Так же сделано в AdminMobileNav.
 */
export function ClientHeaderNav({
  siteName,
  siteContact,
  mainSiteUrl,
}: {
  siteName: string;
  siteContact: string;
  mainSiteUrl: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Десктоп: пункты в строку */}
      <div className="hidden md:flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="group inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground whitespace-nowrap outline-none data-[state=open]:text-foreground">
            Инструкции
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/how-to-book">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                Как сделать бронь
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/cancel-booking">
                <CalendarX className="w-4 h-4 text-primary shrink-0" />
                Отмена брони
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {siteContact && <ContactsButton siteContact={siteContact} />}
        <InstallAppHint siteName={siteName} />
        {mainSiteUrl && (
          <a
            href={mainSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 rounded-md border bg-secondary text-secondary-foreground hover:bg-secondary/80 whitespace-nowrap"
          >
            На основной сайт
          </a>
        )}
      </div>

      {/* Мобайл: бургер со всеми пунктами */}
      <div className="md:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Открыть меню">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 flex flex-col">
            <SheetHeader className="border-b !pt-6">
              <SheetTitle className="pr-6">Меню</SheetTitle>
            </SheetHeader>

            <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Инструкции
              </div>
              <Link
                href="/how-to-book"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100"
              >
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                <span className="font-medium">Как сделать бронь</span>
              </Link>
              <Link
                href="/cancel-booking"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100"
              >
                <CalendarX className="w-4 h-4 text-primary shrink-0" />
                <span className="font-medium">Отмена брони</span>
              </Link>
              <div className="my-1 border-t" />
              {siteContact && (
                <a
                  href={`tel:${siteContact}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100"
                >
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      Контакты
                    </span>
                    <span className="font-medium">{siteContact}</span>
                  </span>
                </a>
              )}
            </nav>

            <div className="p-3 border-t flex flex-col gap-2">
              <div className="[&_button]:w-full">
                <InstallAppHint siteName={siteName} showBanner={false} />
              </div>
              {mainSiteUrl && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href={mainSiteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    На основной сайт
                  </a>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

/** Кнопка «Контакты» для десктопа: по клику открывает диалог с телефоном. */
function ContactsButton({ siteContact }: { siteContact: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Phone className="w-4 h-4" />
          Контакты
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Контакты</DialogTitle>
          <DialogDescription>
            Нажмите на номер, чтобы позвонить.
          </DialogDescription>
        </DialogHeader>
        <a
          href={`tel:${siteContact}`}
          className="flex items-center justify-center gap-2 rounded-md border bg-slate-50 py-3 text-lg font-semibold hover:bg-slate-100"
        >
          <Phone className="w-5 h-5 text-primary" />
          {siteContact}
        </a>
      </DialogContent>
    </Dialog>
  );
}
