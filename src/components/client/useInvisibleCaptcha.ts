"use client";

import { useEffect, useRef, useState } from "react";

type SmartCaptcha = {
  render: (
    container: HTMLElement,
    opts: {
      sitekey: string;
      invisible?: boolean;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
    },
  ) => number;
  execute: (id: number) => void;
  reset: (id: number) => void;
};

/**
 * Невидимая Yandex SmartCaptcha. Возвращает признак необходимости капчи,
 * ref для контейнера виджета и ensureToken() — получить токен перед отправкой.
 * Логика повторяет BookingForm, вынесена для переиспользования (корзина).
 */
export function useInvisibleCaptcha() {
  const [state, setState] = useState<{ enabled: boolean; required: boolean; siteKey: string }>({
    enabled: false,
    required: false,
    siteKey: "",
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const resolverRef = useRef<((token: string | null) => void) | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch("/api/public/bookings/captcha-status")
      .then((r) => r.json())
      .then((j) => {
        if (aborted || !j?.ok) return;
        setState({
          enabled: !!j.data.enabled,
          required: !!j.data.required,
          siteKey: String(j.data.siteKey || ""),
        });
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    if (!state.required || !state.siteKey || typeof window === "undefined") return;
    const w = window as unknown as { smartCaptcha?: SmartCaptcha };

    function init() {
      if (!w.smartCaptcha || !containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = w.smartCaptcha.render(containerRef.current, {
        sitekey: state.siteKey,
        invisible: true,
        callback: (token: string) => {
          const resolve = resolverRef.current;
          resolverRef.current = null;
          resolve?.(token);
        },
        "error-callback": () => {
          const resolve = resolverRef.current;
          resolverRef.current = null;
          resolve?.(null);
        },
      });
    }

    if (w.smartCaptcha) {
      init();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-captcha="1"]');
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://smartcaptcha.yandexcloud.net/captcha.js";
    s.async = true;
    s.dataset.yandexCaptcha = "1";
    s.onload = init;
    document.head.appendChild(s);
  }, [state.required, state.siteKey]);

  async function ensureToken(): Promise<string | null> {
    if (!state.required) return null;
    if (typeof window === "undefined") return null;
    const w = window as unknown as { smartCaptcha?: SmartCaptcha };
    const id = widgetIdRef.current;
    if (!w.smartCaptcha || id === null) return null;
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      try {
        w.smartCaptcha!.reset(id);
      } catch {
        // первый запуск
      }
      w.smartCaptcha!.execute(id);
      setTimeout(() => {
        if (resolverRef.current === resolve) {
          resolverRef.current = null;
          resolve(null);
        }
      }, 30_000);
    });
  }

  return { required: state.required, containerRef, ensureToken };
}
