"use client";

import { useEffect, useState } from "react";
import { Download, Share, MoreVertical, Plus } from "lucide-react";
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

export function InstallAppHint({
  siteName,
  appTitle,
  dismissKey = DEFAULT_DISMISS_KEY,
}: {
  siteName: string;
  appTitle?: string;
  dismissKey?: string;
}) {
  const title = appTitle ?? siteName;
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
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
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted || standalone || dismissed) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      setOpen(false);
    }
  }

  function handleDismiss() {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {}
    setDismissed(true);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
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
