"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share, MoreVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Windows|Linux/i.test(ua)) return "desktop";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  if (mql?.matches) return true;
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;
  return Boolean(navStandalone);
}

const DEFAULT_DISMISS_KEY = "installHintDismissed";
const BANNER_DELAY_MS = 2500;

export function InstallAppHint({
  siteName,
  appTitle,
  dismissKey = DEFAULT_DISMISS_KEY,
  showBanner = true,
  showButton = true,
}: {
  siteName: string;
  appTitle?: string;
  dismissKey?: string;
  showBanner?: boolean;
  showButton?: boolean;
}) {
  const title = appTitle ?? siteName;
  const sessionKey = `${dismissKey}:session`;

  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [permDismissed, setPermDismissed] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [bannerReady, setBannerReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
    try {
      setPermDismissed(localStorage.getItem(dismissKey) === "1");
      setSessionDismissed(sessionStorage.getItem(sessionKey) === "1");
    } catch {}

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const t = window.setTimeout(() => setBannerReady(true), BANNER_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(t);
    };
  }, [dismissKey, sessionKey]);

  if (!mounted || standalone) return null;

  async function handleInstall() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "accepted") {
        setOpen(false);
      }
    } else {
      setOpen(true);
    }
  }

  function handlePermDismiss() {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {}
    setPermDismissed(true);
    setOpen(false);
  }

  function handleSessionDismiss() {
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch {}
    setSessionDismissed(true);
  }

  const bannerVisible =
    showBanner && bannerReady && !permDismissed && !sessionDismissed;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {showButton && (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="Установить как приложение"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Установить приложение</span>
              <span className="sm:hidden">Приложение</span>
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Установить «{title}»</DialogTitle>
            <DialogDescription>
              Добавьте сайт на главный экран — он будет открываться как обычное
              приложение, без адресной строки браузера.
            </DialogDescription>
          </DialogHeader>

          <Instructions platform={platform} canPrompt={Boolean(deferred)} />

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={handlePermDismiss}>
              Больше не показывать
            </Button>
            {deferred && (
              <Button size="sm" onClick={handleInstall}>
                Установить
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {bannerVisible &&
        typeof document !== "undefined" &&
        createPortal(
          <InstallBanner
            title={title}
            canPrompt={Boolean(deferred)}
            onInstall={handleInstall}
            onDetails={() => setOpen(true)}
            onClose={handleSessionDismiss}
          />,
          document.body,
        )}
    </>
  );
}

function InstallBanner({
  title,
  canPrompt,
  onInstall,
  onDetails,
  onClose,
}: {
  title: string;
  canPrompt: boolean;
  onInstall: () => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Установка приложения"
      className="fixed z-50 bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm rounded-xl border bg-white shadow-xl p-3.5 flex items-start gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
    >
      <div className="rounded-full bg-primary/10 p-2 shrink-0">
        <Download className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm leading-tight">
          Установить «{title}»
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Откройте сайт как приложение, без адресной строки.
        </p>
        <div className="flex flex-wrap gap-2 mt-2.5">
          <Button size="sm" onClick={onInstall} className="h-8">
            {canPrompt ? "Установить" : "Как установить"}
          </Button>
          {canPrompt && (
            <Button variant="ghost" size="sm" onClick={onDetails} className="h-8">
              Инструкция
            </Button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="text-muted-foreground hover:text-foreground p-1 -m-1 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function Instructions({
  platform,
  canPrompt,
}: {
  platform: Platform;
  canPrompt: boolean;
}) {
  if (canPrompt) {
    return (
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        Нажмите кнопку <span className="font-medium">«Установить»</span> ниже —
        браузер сам предложит подтвердить установку.
      </div>
    );
  }

  if (platform === "ios") {
    return (
      <ol className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">1.</span>
          <span>
            Откройте сайт в <span className="font-medium">Safari</span> (в других
            браузерах эта функция недоступна).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">2.</span>
          <span className="flex items-center gap-1 flex-wrap">
            Нажмите кнопку «Поделиться»
            <Share className="w-4 h-4 inline" /> в нижней панели.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">3.</span>
          <span>
            Выберите <span className="font-medium">«На экран Домой»</span>{" "}
            (<span className="inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
            </span>).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">4.</span>
          <span>
            Нажмите <span className="font-medium">«Добавить»</span> — ярлык
            появится на рабочем столе.
          </span>
        </li>
      </ol>
    );
  }

  if (platform === "android") {
    return (
      <ol className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">1.</span>
          <span className="flex items-center gap-1 flex-wrap">
            В Chrome нажмите меню
            <MoreVertical className="w-4 h-4 inline" /> в правом верхнем углу.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">2.</span>
          <span>
            Выберите <span className="font-medium">«Установить приложение»</span>{" "}
            или <span className="font-medium">«Добавить на главный экран»</span>.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">3.</span>
          <span>Подтвердите — ярлык появится на главном экране.</span>
        </li>
      </ol>
    );
  }

  if (platform === "desktop") {
    return (
      <ol className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">1.</span>
          <span>
            В Chrome, Edge или Yandex Browser нажмите иконку{" "}
            <span className="font-medium">«Установить»</span> справа в адресной
            строке (значок с экраном и стрелкой).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">2.</span>
          <span>
            Либо откройте меню браузера → <span className="font-medium">«Установить…»</span>{" "}
            или <span className="font-medium">«Создать ярлык…»</span>.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold w-5 shrink-0">3.</span>
          <span>
            Подтвердите — ярлык появится на рабочем столе или в меню «Пуск».
          </span>
        </li>
      </ol>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Откройте сайт в Chrome, Edge или Safari — в меню браузера будет пункт
      «Установить приложение» или «Добавить на главный экран».
    </p>
  );
}
