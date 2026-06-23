"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/components/client/CartProvider";
import {
  ObjectSchedulePicker,
  type ScheduleState,
} from "@/components/client/ObjectSchedulePicker";
import { useInvisibleCaptcha } from "@/components/client/useInvisibleCaptcha";
import { ConsentCheckbox } from "@/components/client/ConsentCheckbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CartPage() {
  const { items, remove, clear } = useCart();
  const { required: captchaRequired, containerRef, ensureToken } = useInvisibleCaptcha();

  const [states, setStates] = useState<Record<string, ScheduleState>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleItemChange = useCallback((s: ScheduleState) => {
    setStates((prev) => ({ ...prev, [s.objectId]: s }));
  }, []);

  const activeStates = items.map((i) => states[i.id]).filter(Boolean) as ScheduleState[];
  const totalPrice = activeStates.reduce((s, x) => s + x.price, 0);
  const totalPrepay = activeStates.reduce((s, x) => s + x.prepayment, 0);
  const allValid =
    items.length > 0 && items.every((i) => states[i.id]?.valid);

  const contactValid = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 5;
  const canSubmit = allValid && contactValid && agreed && !submitting;

  const fmt = (n: number) => n.toLocaleString("ru-RU");

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payloadItems = items
        .map((i) => states[i.id]?.payload)
        .filter(Boolean) as Record<string, unknown>[];

      const body: Record<string, unknown> = {
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        guestComment: comment,
        items: payloadItems,
      };

      if (captchaRequired) {
        const token = await ensureToken();
        if (!token) {
          setError("Не удалось пройти проверку. Попробуйте ещё раз.");
          return;
        }
        body.captchaToken = token;
      }

      const res = await fetch("/api/public/booking-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Не удалось оформить заказ");
        return;
      }
      clear();
      window.location.href = j.data.confirmationUrl;
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const empty = items.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <div className="container max-w-5xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-1" /> К выбору объектов
          </Link>
        </Button>

        <h1 className="text-2xl font-bold tracking-tight">Оформление заказа</h1>

        {empty ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                Корзина пуста. Откройте карточку объекта на{" "}
                <Link href="/" className="underline">
                  главной
                </Link>
                , выберите даты и нажмите «Добавить в корзину».
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
            {/* Левая колонка: объекты + контакты */}
            <div className="space-y-4">
              {items.map((i) => (
                <ObjectSchedulePicker
                  key={i.id}
                  objectId={i.id}
                  objectName={i.name}
                  initial={i.schedule}
                  onChange={handleItemChange}
                  onRemove={() => remove(i.id)}
                />
              ))}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Контактные данные</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Имя</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <Label className="text-xs">Телефон</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" required />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Комментарий (необязательно)</Label>
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Правая колонка: итог (липкая) */}
            <Card className="lg:sticky lg:top-4">
              <CardHeader>
                <CardTitle className="text-base">Итого</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Объектов</span>
                  <span>{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Полная стоимость</span>
                  <span className="font-semibold">{fmt(totalPrice)} ₽</span>
                </div>
                {totalPrepay > 0 && totalPrepay < totalPrice && (
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Предоплата онлайн</span>
                    <span className="font-semibold text-emerald-700">{fmt(totalPrepay)} ₽</span>
                  </div>
                )}

                {error && <p className="text-destructive">{error}</p>}
                {!allValid && (
                  <p className="text-xs text-muted-foreground">
                    Укажите дату/время и число гостей для каждого объекта.
                  </p>
                )}

                <ConsentCheckbox checked={agreed} onChange={setAgreed} id="consent-cart" />

                <Button className="w-full" disabled={!canSubmit} onClick={submit}>
                  {submitting
                    ? "Оформляем…"
                    : `Перейти к оплате${totalPrepay > 0 ? ` — ${fmt(totalPrepay)} ₽` : ""}`}
                </Button>
                <div ref={containerRef} className="cf-turnstile" />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
