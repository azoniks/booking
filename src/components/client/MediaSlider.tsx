"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type MediaItem = {
  id: string;
  type: "IMAGE" | "VIDEO" | "PANO360" | string;
  url: string;
};

export function MediaSlider({
  items,
  alt = "",
  aspect = "4/3",
}: {
  items: MediaItem[];
  alt?: string;
  aspect?: string;
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const total = items.length;

  const go = useCallback(
    (next: number) => {
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      setIndex(wrapped);
    },
    [total],
  );

  // Стрелки клавиатуры
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!trackRef.current) return;
      const inside = trackRef.current.contains(document.activeElement);
      if (!inside) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(index + 1);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, index]);

  // Свайп
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      go(index + (dx < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  }

  if (total === 0) {
    return (
      <div
        className="relative bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center text-muted-foreground"
        style={{ aspectRatio: aspect }}
      >
        <ImageOff className="w-10 h-10" />
      </div>
    );
  }

  const cur = items[index];

  return (
    <div
      ref={trackRef}
      tabIndex={0}
      className="relative rounded-lg overflow-hidden bg-slate-100 group focus:outline-none focus:ring-2 focus:ring-primary"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ aspectRatio: aspect }}
    >
      {cur.type === "VIDEO" ? (
        <video
          key={cur.id}
          src={cur.url}
          className="w-full h-full object-cover"
          controls
          playsInline
        />
      ) : (
        <img
          key={cur.id}
          src={cur.url}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Предыдущее"
            onClick={(e) => {
              e.preventDefault();
              go(index - 1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Следующее"
            onClick={(e) => {
              e.preventDefault();
              go(index + 1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {/* Индикаторы */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {items.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/60",
                )}
              />
            ))}
          </div>
          {/* Счётчик */}
          <div className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/50 text-white">
            {index + 1} / {total}
          </div>
        </>
      )}
    </div>
  );
}
