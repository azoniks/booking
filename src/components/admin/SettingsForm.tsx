"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useFormDirty } from "./_hooks";

const MASK = "***";

type Initial = Record<string, unknown>;

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tinkoffMode, setTinkoffMode] = useState<string>(String(initial.tinkoffMode ?? "mock"));
  const { dirty, formProps, reset } = useFormDirty();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      siteName: fd.get("siteName") || "",
      siteContact: fd.get("siteContact") || "",
      adminNotifyEmails: String(fd.get("adminNotifyEmails") || "")
        .split(",").map((s) => s.trim()).filter(Boolean),
      paymentPercent: Math.max(1, Math.min(100, Number(fd.get("paymentPercent") || 100))),

      tinkoffMode: String(fd.get("tinkoffMode") || "mock"),
      tinkoffApiUrl: String(fd.get("tinkoffApiUrl") || ""),
      tinkoffTestTerminalKey: String(fd.get("tinkoffTestTerminalKey") || ""),
      tinkoffTestPassword: String(fd.get("tinkoffTestPassword") || ""),
      tinkoffProdTerminalKey: String(fd.get("tinkoffProdTerminalKey") || ""),
      tinkoffProdPassword: String(fd.get("tinkoffProdPassword") || ""),

      telegramEnabled: fd.get("telegramEnabled") === "on" ? "true" : "false",
      telegramBotToken: String(fd.get("telegramBotToken") || ""),
      telegramChatId: String(fd.get("telegramChatId") || ""),
      telegramBotUsername: String(fd.get("telegramBotUsername") || ""),
      telegramClientEnabled: fd.get("telegramClientEnabled") === "on" ? "true" : "false",

      maxEnabled: fd.get("maxEnabled") === "on" ? "true" : "false",
      maxBotToken: String(fd.get("maxBotToken") || ""),
      maxChatId: String(fd.get("maxChatId") || ""),
      maxApiUrl: String(fd.get("maxApiUrl") || ""),
      maxBotUsername: String(fd.get("maxBotUsername") || ""),
      maxClientEnabled: fd.get("maxClientEnabled") === "on" ? "true" : "false",

      smtpEnabled: fd.get("smtpEnabled") === "on" ? "true" : "false",
      smtpHost: String(fd.get("smtpHost") || ""),
      smtpPort: String(fd.get("smtpPort") || "465"),
      smtpUser: String(fd.get("smtpUser") || ""),
      smtpPassword: String(fd.get("smtpPassword") || ""),
      smtpFrom: String(fd.get("smtpFrom") || ""),
    };
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const j = await res.json();
    setSaving(false);
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось сохранить", variant: "destructive" });
      return;
    }
    toast({ title: "Сохранено" });
    reset();
    router.refresh();
  }

  const tinkoffTestPwdSet = initial.tinkoffTestPassword === MASK;
  const tinkoffProdPwdSet = initial.tinkoffProdPassword === MASK;
  const tinkoffTestKey = String(initial.tinkoffTestTerminalKey ?? "");
  const tinkoffProdKey = String(initial.tinkoffProdTerminalKey ?? "");
  const tinkoffTestReady = tinkoffTestKey.trim() !== "" && tinkoffTestPwdSet;
  const tinkoffProdReady = tinkoffProdKey.trim() !== "" && tinkoffProdPwdSet;

  const tgTokenSet = initial.telegramBotToken === MASK;
  const tgEnabled = initial.telegramEnabled !== "false" && initial.telegramEnabled !== undefined;
  const maxTokenSet = initial.maxBotToken === MASK;
  const maxEnabled = initial.maxEnabled !== "false" && initial.maxEnabled !== undefined;

  return (
    <form {...formProps} onSubmit={onSubmit} className="space-y-6">
      <Tabs defaultValue="site" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="site">Сайт</TabsTrigger>
          <TabsTrigger value="payments">Эквайринг</TabsTrigger>
          <TabsTrigger value="notifications">Уведомления</TabsTrigger>
        </TabsList>

        {/* ─── Вкладка: Сайт ─── */}
        <TabsContent value="site" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Сайт</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Название сайта</Label>
                <Input name="siteName" defaultValue={String(initial.siteName ?? "")} />
              </div>
              <div>
                <Label>Контакт (телефон/email для футера)</Label>
                <Input name="siteContact" defaultValue={String(initial.siteContact ?? "")} />
              </div>
              <div className="md:col-span-2">
                <Label>Email для уведомлений админу (через запятую)</Label>
                <Input
                  name="adminNotifyEmails"
                  defaultValue={
                    Array.isArray(initial.adminNotifyEmails)
                      ? (initial.adminNotifyEmails as string[]).join(", ")
                      : ""
                  }
                  placeholder="manager@example.com, owner@example.com"
                />
              </div>
              <div>
                <Label>% предоплаты по умолчанию</Label>
                <Input
                  name="paymentPercent"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={Number(initial.paymentPercent ?? 100)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  100 — полная оплата онлайн. На уровне типа объекта можно переопределить.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Вкладка: Эквайринг ─── */}
        <TabsContent value="payments" className="space-y-6">

      {/* === Tinkoff === */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Tinkoff Acquiring</CardTitle>
            <TinkoffModeBadge
              mode={tinkoffMode}
              testReady={tinkoffTestReady}
              prodReady={tinkoffProdReady}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Режим</Label>
            <select
              name="tinkoffMode"
              value={tinkoffMode}
              onChange={(e) => setTinkoffMode(e.target.value)}
              className="w-full md:w-1/2 h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="mock">mock — имитация оплаты внутри сайта (для разработки)</option>
              <option value="test">test — реальный Tinkoff с тестовыми ключами</option>
              <option value="production">production — боевой Tinkoff</option>
            </select>
            {tinkoffMode === "production" && !tinkoffProdReady && (
              <Warning>В режиме production не заданы боевые TerminalKey/Password.</Warning>
            )}
            {tinkoffMode === "test" && !tinkoffTestReady && (
              <Warning>В режиме test не заданы тестовые TerminalKey/Password.</Warning>
            )}
          </div>
          <div>
            <Label>API URL (опционально)</Label>
            <Input
              name="tinkoffApiUrl"
              defaultValue={String(initial.tinkoffApiUrl ?? "")}
              placeholder="https://securepay.tinkoff.ru/v2"
            />
          </div>
          <CredsBlock
            title="Тестовые ключи"
            color="info"
            keyName="tinkoffTestTerminalKey"
            pwdName="tinkoffTestPassword"
            keyValue={tinkoffTestKey}
            pwdSet={tinkoffTestPwdSet}
          />
          <CredsBlock
            title="Боевые ключи"
            color="warning"
            keyName="tinkoffProdTerminalKey"
            pwdName="tinkoffProdPassword"
            keyValue={tinkoffProdKey}
            pwdSet={tinkoffProdPwdSet}
          />
          <p className="text-xs text-muted-foreground">
            Webhook URL для Tinkoff:{" "}
            <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/api/payments/tinkoff/webhook`}</code>
          </p>
        </CardContent>
      </Card>
        </TabsContent>

        {/* ─── Вкладка: Уведомления ─── */}
        <TabsContent value="notifications" className="space-y-6">
          {/* Email (SMTP) */}
          <SmtpCard initial={initial} />

          {/* === Telegram === */}
      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="telegramEnabled"
              name="telegramEnabled"
              defaultChecked={tgEnabled}
            />
            <Label htmlFor="telegramEnabled">Включить интеграцию</Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bot Token</Label>
              <Input
                name="telegramBotToken"
                type="password"
                placeholder={tgTokenSet ? "уже задан — оставьте пустым, чтобы не менять" : "123456:ABC-DEF..."}
                autoComplete="off"
              />
            </div>
            <div>
              <Label className="text-xs">Username бота (без @)</Label>
              <Input
                name="telegramBotUsername"
                defaultValue={String(initial.telegramBotUsername ?? "")}
                placeholder="my_bookings_bot"
              />
            </div>
          </div>

          <Tabs defaultValue="admin">
            <TabsList>
              <TabsTrigger value="admin">Админу</TabsTrigger>
              <TabsTrigger value="client">Клиенту</TabsTrigger>
            </TabsList>
            <TabsContent value="admin" className="space-y-3">
              <div>
                <Label className="text-xs">Chat ID администратора</Label>
                <Input
                  name="telegramChatId"
                  defaultValue={String(initial.telegramChatId ?? "")}
                  placeholder="-1001234567890 или ваш user_id"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Сюда бот будет писать о новых бронях. Узнать ID: <code>@getmyid_bot</code>.
                </p>
              </div>
              <TestNotificationButton channel="telegram" />
            </TabsContent>
            <TabsContent value="client" className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="telegramClientEnabled"
                  name="telegramClientEnabled"
                  defaultChecked={initial.telegramClientEnabled === "true"}
                />
                <Label htmlFor="telegramClientEnabled">
                  Отправлять клиенту уведомления (после опт-ина в боте)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Клиент получает на success-странице кнопку «Подключить Telegram» — она ведёт в чат с
                ботом с кодом брони. После «Старт» бот привязывает chat_id к броне и шлёт ему оплату,
                напоминание за 24 часа, изменения статуса.
              </p>
              <WebhookBlock channel="telegram" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* === MAX === */}
      <Card>
        <CardHeader>
          <CardTitle>MAX (Tamtam)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="maxEnabled"
              name="maxEnabled"
              defaultChecked={maxEnabled}
            />
            <Label htmlFor="maxEnabled">Включить интеграцию</Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bot Token (access_token)</Label>
              <Input
                name="maxBotToken"
                type="password"
                placeholder={maxTokenSet ? "уже задан — оставьте пустым, чтобы не менять" : "получите у @MasterBot"}
                autoComplete="off"
              />
            </div>
            <div>
              <Label className="text-xs">Username бота</Label>
              <Input
                name="maxBotUsername"
                defaultValue={String(initial.maxBotUsername ?? "")}
                placeholder="my_bookings_bot"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">API URL (опц.)</Label>
              <Input
                name="maxApiUrl"
                defaultValue={String(initial.maxApiUrl ?? "")}
                placeholder="https://botapi.max.ru"
              />
            </div>
          </div>

          <Tabs defaultValue="admin">
            <TabsList>
              <TabsTrigger value="admin">Админу</TabsTrigger>
              <TabsTrigger value="client">Клиенту</TabsTrigger>
            </TabsList>
            <TabsContent value="admin" className="space-y-3">
              <div>
                <Label className="text-xs">Chat ID администратора</Label>
                <Input
                  name="maxChatId"
                  defaultValue={String(initial.maxChatId ?? "")}
                  placeholder="ID чата админа"
                />
              </div>
              <TestNotificationButton channel="max" />
            </TabsContent>
            <TabsContent value="client" className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="maxClientEnabled"
                  name="maxClientEnabled"
                  defaultChecked={initial.maxClientEnabled === "true"}
                />
                <Label htmlFor="maxClientEnabled">
                  Отправлять клиенту уведомления (после опт-ина в боте)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Аналогично Telegram — после клика по deep-link и «Старт» бот привязывает chat_id и
                будет слать клиенту изменения по брони.
              </p>
              <WebhookBlock channel="max" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Сохранение…" : "Сохранить все настройки"}
        </Button>
      </div>
    </form>
  );
}

function CredsBlock({
  title,
  color,
  keyName,
  pwdName,
  keyValue,
  pwdSet,
}: {
  title: string;
  color: "info" | "warning";
  keyName: string;
  pwdName: string;
  keyValue: string;
  pwdSet: boolean;
}) {
  return (
    <div
      className={
        "border rounded-md p-3 space-y-2 " +
        (color === "warning" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50/50")
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {keyValue && pwdSet ? (
          <Badge variant="success">настроены</Badge>
        ) : (
          <Badge variant="outline">не заданы</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">TerminalKey</Label>
          <Input name={keyName} defaultValue={keyValue} placeholder="TinkoffMerchant_TEST" />
        </div>
        <div>
          <Label className="text-xs">Password</Label>
          <Input
            name={pwdName}
            type="password"
            placeholder={pwdSet ? "уже задан — оставьте пустым, чтобы не менять" : "введите пароль"}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}

function TinkoffModeBadge({
  mode,
  testReady,
  prodReady,
}: {
  mode: string;
  testReady: boolean;
  prodReady: boolean;
}) {
  if (mode === "mock") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="w-3 h-3" /> mock
      </Badge>
    );
  }
  if (mode === "test") {
    return (
      <Badge variant={testReady ? "success" : "destructive"} className="gap-1">
        {testReady ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        test
      </Badge>
    );
  }
  return (
    <Badge variant={prodReady ? "warning" : "destructive"} className="gap-1">
      {prodReady ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      production
    </Badge>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2 text-xs text-amber-700">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function TestNotificationButton({ channel }: { channel: "telegram" | "max" }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    setOut(null);
    try {
      const res = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const j = await res.json();
      setOut(j.ok ? `Отправлено в ${j.data.recipient}` : `Ошибка: ${j.error}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button type="button" variant="outline" size="sm" onClick={send} disabled={busy}>
        {busy ? "Отправка…" : "Отправить тестовое сообщение админу"}
      </Button>
      {out && <span className="text-xs text-muted-foreground">{out}</span>}
    </div>
  );
}

function WebhookBlock({ channel }: { channel: "telegram" | "max" }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  async function setWebhook() {
    setBusy(true);
    setOut(null);
    try {
      const res = await fetch(`/api/admin/notifications/${channel}/set-webhook`, {
        method: "POST",
      });
      const j = await res.json();
      setOut(j.ok ? `Установлен: ${j.data.webhookUrl}` : `Ошибка: ${j.error}`);
    } finally {
      setBusy(false);
    }
  }
  async function deleteWebhook() {
    if (!confirm("Снять webhook?")) return;
    setBusy(true);
    setOut(null);
    try {
      const res = await fetch(`/api/admin/notifications/${channel}/set-webhook`, {
        method: "DELETE",
      });
      const j = await res.json();
      setOut(j.ok ? "Webhook снят" : `Ошибка: ${j.error}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="border rounded-md p-3 space-y-2 bg-slate-50/50">
      <div className="text-sm font-medium">Webhook</div>
      <p className="text-xs text-muted-foreground">
        Чтобы бот понимал нажатие «Старт» от клиента, нужно зарегистрировать webhook у{" "}
        {channel === "telegram" ? "Telegram" : "MAX"}. Делается одной кнопкой ниже после
        сохранения настроек. APP_URL должен быть публично доступным (на dev — через ngrok).
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" variant="outline" size="sm" onClick={setWebhook} disabled={busy}>
          {busy ? "..." : "Установить webhook"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={deleteWebhook} disabled={busy}>
          Снять webhook
        </Button>
        {out && <span className="text-xs text-muted-foreground">{out}</span>}
      </div>
    </div>
  );
}


const SMTP_PRESETS: { name: string; host: string; port: number; hint: string }[] = [
  { name: "Yandex 360", host: "smtp.yandex.ru", port: 465, hint: "Логин = ваш email; пароль приложения создайте в Yandex ID → Безопасность" },
  { name: "Mail.ru", host: "smtp.mail.ru", port: 465, hint: "Создайте пароль для внешнего приложения в настройках Mail.ru" },
  { name: "Gmail", host: "smtp.gmail.com", port: 465, hint: "Используйте App Password, обычный не подойдёт" },
  { name: "SendPulse", host: "smtp-pulse.com", port: 465, hint: "Тариф SMTP" },
];

function SmtpCard({ initial }: { initial: Record<string, unknown> }) {
  const [host, setHost] = useState<string>(String(initial.smtpHost ?? ""));
  const [port, setPort] = useState<string>(String(initial.smtpPort ?? "465"));
  const [hint, setHint] = useState<string | null>(null);
  const pwdSet = initial.smtpPassword === MASK;
  const enabled = initial.smtpEnabled !== "false" && initial.smtpEnabled !== undefined;
  const ready = !!host && (pwdSet || !initial.smtpUser);

  function applyPreset(p: (typeof SMTP_PRESETS)[number]) {
    setHost(p.host);
    setPort(String(p.port));
    setHint(p.hint);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Email (SMTP)</CardTitle>
          {enabled && ready ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="w-3 h-3" /> отправляются
            </Badge>
          ) : enabled ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> не настроено
            </Badge>
          ) : (
            <Badge variant="secondary">только в консоль</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="smtpEnabled"
            name="smtpEnabled"
            defaultChecked={enabled}
          />
          <Label htmlFor="smtpEnabled">Отправлять реальные письма (иначе пишутся только в журнал сервера)</Label>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Быстрый выбор провайдера:</p>
          <div className="flex flex-wrap gap-2">
            {SMTP_PRESETS.map((p) => (
              <Button
                key={p.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </Button>
            ))}
          </div>
          {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">SMTP host</Label>
            <Input
              name="smtpHost"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.yandex.ru"
            />
          </div>
          <div>
            <Label className="text-xs">Port</Label>
            <Input
              name="smtpPort"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="465"
            />
            <p className="text-xs text-muted-foreground mt-1">465 = SSL, 587 = STARTTLS</p>
          </div>
          <div>
            <Label className="text-xs">Логин (полный email)</Label>
            <Input
              name="smtpUser"
              defaultValue={String(initial.smtpUser ?? "")}
              placeholder="booking@yourdomain.ru"
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="text-xs">Пароль</Label>
            <Input
              name="smtpPassword"
              type="password"
              placeholder={pwdSet ? "уже задан — оставьте пустым, чтобы не менять" : "пароль приложения"}
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="text-xs">From (отправитель)</Label>
            <Input
              name="smtpFrom"
              defaultValue={String(initial.smtpFrom ?? "")}
              placeholder='"Бронирование" <booking@yourdomain.ru>'
            />
          </div>
        </div>

        <EmailTestButton />
      </CardContent>
    </Card>
  );
}

function EmailTestButton() {
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState("");
  const [out, setOut] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    setOut(null);
    try {
      const res = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email", to: to || undefined }),
      });
      const j = await res.json();
      setOut(j.ok ? `Отправлено на ${j.data.recipient} (${j.data.source})` : `Ошибка: ${j.error}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="border rounded-md p-3 space-y-2 bg-slate-50/50">
      <div className="text-sm font-medium">Тестовое письмо</div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="email получателя (пусто = первый из списка админов)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="max-w-md"
        />
        <Button type="button" variant="outline" size="sm" onClick={send} disabled={busy}>
          {busy ? "Отправка…" : "Отправить"}
        </Button>
        {out && <span className="text-xs text-muted-foreground">{out}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Сначала сохраните настройки SMTP, затем нажмите «Отправить».
      </p>
    </div>
  );
}
