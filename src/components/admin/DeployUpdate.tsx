"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type State = { enabled: boolean; status: string; updateAvailable: boolean; currentCommit: string | null; remoteCommit: string | null };

export function DeployUpdate() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const startedRef = useRef(false);
  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch("/api/admin/deploy", { cache: "no-store" });
        const result = await response.json();
        if (!result.ok) throw new Error(result.error);
        if (!stopped) {
          if (startedRef.current && result.data.status === "success") {
            setCompleted(true);
            startedRef.current = false;
          }
          setState(result.data); setError("");
        }
      } catch {
        if (!stopped) setError("Нет связи с сервером. При обновлении сайт может временно перезапускаться; проверка продолжится автоматически.");
      }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  async function start() {
    if (!window.confirm("Загрузить обновления из origin/main и перезапустить сайт? Во время обновления сайт может быть временно недоступен.")) return;
    setStarting(true);
    startedRef.current = true;
    setCompleted(false);
    setError("");
    try {
      const response = await fetch("/api/admin/deploy", { method: "POST" });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error);
      setState((current) => ({ ...(current ?? { updateAvailable: false, currentCommit: null, remoteCommit: null }), enabled: true, status: "running" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить обновление");
    } finally { setStarting(false); }
  }

  const running = starting || state?.status === "running";
  return <Card>
    <CardHeader><CardTitle>Обновление сайта</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {state?.currentCommit && <p className="text-sm text-muted-foreground">Установленная версия: <code>{state.currentCommit}</code></p>}
      {state?.updateAvailable && !running && <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">В Git доступна новая версия.</p>}
      <Button type="button" disabled={!state?.enabled || running} onClick={start}>
        {running ? "Обновление выполняется…" : "Обновить и задеплоить из Git"}
      </Button>
      <div role="status" className="text-sm">
        {!state && "Проверка состояния…"}
        {state && !state.enabled && "Для запуска нужно настроить сервис обновлений на сервере по инструкции DEPLOY.md."}
        {state && !state.updateAvailable && !running && !completed && "Установлена последняя версия"}
        {completed && "Обновление завершено. Сайт перезапущен."}
        {state?.status === "failed" && "Обновление завершилось с ошибкой. Подробности доступны в журнале сервиса booking-update и файле .deploy/update.log на сервере."}
        {running && "Обновление может занять несколько минут. Можно закрыть страницу — процесс продолжится."}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}
