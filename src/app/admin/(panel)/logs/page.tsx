import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLocal } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CollapsibleFilters } from "@/components/admin/CollapsibleFilters";
import { AuditLogFilters } from "@/components/admin/AuditLogFilters";
import { ServerErrorFilters } from "@/components/admin/ServerErrorFilters";
import {
  ResolveErrorButton,
  ClearErrorsButton,
} from "@/components/admin/ServerErrorActions";
import {
  buildAuditWhere,
  countActiveAuditFilters,
  ENTITY_LABELS,
  ACTION_LABELS,
} from "@/lib/audit-filters";
import {
  buildServerErrorWhere,
  countActiveServerErrorFilters,
  SOURCE_LABELS,
} from "@/lib/server-error-filters";
import type { AuditAction } from "@prisma/client";

export const dynamic = "force-dynamic";

function actionVariant(
  action: AuditAction,
): "success" | "info" | "warning" | "destructive" | "secondary" {
  switch (action) {
    case "CREATE":
      return "success";
    case "UPDATE":
      return "info";
    case "DELETE":
      return "destructive";
    case "CANCEL":
    case "REFUND":
      return "warning";
    default:
      return "secondary";
  }
}

// Компактный показ контекста попытки (какой объект, гость и т.п.).
function ContextMeta({ context }: { context: unknown }) {
  if (!context || typeof context !== "object") return null;
  const entries = Object.entries(context as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
  );
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {entries.map(([k, v]) => (
        <span key={k}>
          <span className="font-medium">{k}:</span>{" "}
          {Array.isArray(v) ? v.join(", ") : String(v)}
        </span>
      ))}
    </div>
  );
}

function ChangedMeta({ meta }: { meta: unknown }) {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const changed = m.changed as Record<string, { from: unknown; to: unknown }> | undefined;
  if (!changed || Object.keys(changed).length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {Object.entries(changed).map(([field, v]) => (
        <span key={field}>
          <span className="font-medium">{field}:</span> {String(v.from ?? "—")} →{" "}
          {String(v.to ?? "—")}
        </span>
      ))}
    </div>
  );
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    // аудит
    entity?: string;
    action?: string;
    actor?: string;
    // ошибки
    source?: string;
    q?: string;
    unresolved?: string;
    // общие
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "errors" ? "errors" : "actions";

  const tabCls = (active: boolean) =>
    cn(
      "px-3 py-1.5 rounded-md text-sm border",
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background text-muted-foreground border-input hover:bg-slate-50",
    );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Логи</h1>

      <div className="flex gap-2">
        <Link href="/admin/logs?tab=actions" className={tabCls(tab === "actions")}>
          Действия
        </Link>
        <Link href="/admin/logs?tab=errors" className={tabCls(tab === "errors")}>
          Ошибки сервера
        </Link>
      </div>

      {tab === "actions" ? (
        <AuditView from={sp.from} to={sp.to} entity={sp.entity} action={sp.action} actor={sp.actor} />
      ) : (
        <ErrorsView from={sp.from} to={sp.to} source={sp.source} q={sp.q} unresolved={sp.unresolved} />
      )}
    </div>
  );
}

async function AuditView(filters: {
  from?: string;
  to?: string;
  entity?: string;
  action?: string;
  actor?: string;
}) {
  const [items, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where: buildAuditWhere(filters),
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.adminUser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <CollapsibleFilters activeCount={countActiveAuditFilters(filters)}>
        <AuditLogFilters actors={actors} current={filters} />
      </CollapsibleFilters>

      <div className="grid gap-2">
        {items.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={actionVariant(log.action)}>{ACTION_LABELS[log.action]}</Badge>
                    <Badge variant="outline">{ENTITY_LABELS[log.entity]}</Badge>
                    <span className="text-sm">{log.summary}</span>
                  </div>
                  <ChangedMeta meta={log.meta} />
                </div>
                <div className="text-xs text-right text-muted-foreground shrink-0">
                  <div>{formatLocal(log.createdAt)}</div>
                  <div className="font-medium text-foreground">{log.actorName}</div>
                  {log.ip && <div>{log.ip}</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Событий не найдено</p>
        )}
      </div>
    </>
  );
}

async function ErrorsView(filters: {
  from?: string;
  to?: string;
  source?: string;
  q?: string;
  unresolved?: string;
}) {
  const [items, total] = await Promise.all([
    prisma.serverErrorLog.findMany({
      where: buildServerErrorWhere(filters),
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.serverErrorLog.count(),
  ]);

  return (
    <>
      <CollapsibleFilters activeCount={countActiveServerErrorFilters(filters)}>
        <ServerErrorFilters current={filters} />
      </CollapsibleFilters>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">
          Показано: {items.length}
          {items.length === 200 ? "+ (последние)" : ""} · всего: {total}
        </span>
        <ClearErrorsButton total={total} />
      </div>

      <div className="grid gap-2">
        {items.map((e) => (
          <Card key={e.id} className={cn(e.resolvedAt && "opacity-60")}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{SOURCE_LABELS[e.source]}</Badge>
                    {e.statusCode != null && (
                      <Badge variant="destructive">{e.statusCode}</Badge>
                    )}
                    {(e.method || e.path) && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {e.method ? `${e.method} ` : ""}
                        {e.path}
                      </span>
                    )}
                    {e.resolvedAt && <Badge variant="success">Разобрано</Badge>}
                  </div>
                  {e.action && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">Действие:</span>{" "}
                      <span className="font-medium">{e.action}</span>
                    </div>
                  )}
                  <ContextMeta context={e.context} />
                  <div className="mt-1 text-sm break-words">
                    <span className="text-muted-foreground">Ошибка:</span> {e.message}
                  </div>
                  {e.stack && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Стек
                      </summary>
                      <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-snug whitespace-pre-wrap break-words">
                        {e.stack}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-xs text-muted-foreground">{formatLocal(e.createdAt)}</div>
                  <ResolveErrorButton id={e.id} resolved={!!e.resolvedAt} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Ошибок не найдено 🎉</p>
        )}
      </div>
    </>
  );
}
