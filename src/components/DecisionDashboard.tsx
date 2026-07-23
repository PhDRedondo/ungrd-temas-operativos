"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ShieldAlert,
  Siren,
} from "lucide-react";
import {
  buildDecisionBrief,
  isSourceTheme,
  type DecisionAlert,
  type SemaphoreLevel,
} from "@/lib/analytics/decision";
import { enrichRecordsForDecision } from "@/lib/analytics/enrichRecords";
import { formatCop, formatNumber, type RecordRow } from "@/lib/records/types";

type Props = {
  themeId: string;
  themeName: string;
  records: RecordRow[];
};

const LEVEL_STYLE: Record<
  SemaphoreLevel,
  { bar: string; bg: string; text: string; dot: string }
> = {
  rojo: {
    bar: "bg-[#b42318]",
    bg: "bg-[#b42318]/10",
    text: "text-[#b42318]",
    dot: "bg-[#b42318]",
  },
  amarillo: {
    bar: "bg-[#b54708]",
    bg: "bg-[#b54708]/10",
    text: "text-[#b54708]",
    dot: "bg-[#b54708]",
  },
  verde: {
    bar: "bg-[#1f7a4d]",
    bg: "bg-[#1f7a4d]/10",
    text: "text-[#1f7a4d]",
    dot: "bg-[#1f7a4d]",
  },
  gris: {
    bar: "bg-[#5a6b7d]",
    bg: "bg-[#5a6b7d]/10",
    text: "text-[#5a6b7d]",
    dot: "bg-[#5a6b7d]",
  },
};

function severityIcon(s: DecisionAlert["severity"]) {
  if (s === "critica") return <Siren className="h-4 w-4 shrink-0" />;
  if (s === "alta") return <ShieldAlert className="h-4 w-4 shrink-0" />;
  if (s === "media") return <AlertTriangle className="h-4 w-4 shrink-0" />;
  return <CheckCircle2 className="h-4 w-4 shrink-0" />;
}

function severityClass(s: DecisionAlert["severity"]) {
  if (s === "critica") return "border-[#b42318]/40 bg-[#b42318]/8 text-[#7a1a12]";
  if (s === "alta") return "border-[#b54708]/40 bg-[#b54708]/8 text-[#7a3208]";
  if (s === "media") return "border-ungrd-yellow/50 bg-ungrd-yellow/10 text-ungrd-navy";
  return "border-ungrd-border bg-ungrd-bg text-ungrd-muted";
}

export function DecisionDashboard({ themeId, themeName, records }: Props) {
  const brief = useMemo(() => {
    const rows = isSourceTheme(themeId)
      ? enrichRecordsForDecision(records)
      : records;
    return buildDecisionBrief(themeId, rows);
  }, [themeId, records]);

  const totalSem = brief.semaphores.reduce((a, s) => a + s.count, 0) || 1;
  const source = isSourceTheme(themeId);

  return (
    <section
      className="min-w-0 space-y-4 rounded-2xl border border-ungrd-navy/20 bg-[linear-gradient(160deg,#001a36_0%,#0a3d6b_45%,#002d5a_100%)] p-4 text-white shadow-[0_20px_50px_rgba(0,26,54,0.35)] sm:p-5"
      aria-label={`Tablero de decisión ${themeName}`}
    >
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-ungrd-yellow uppercase">
            Centro de mando · UNGRD
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
            {brief.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-white/70">{brief.subtitle}</p>
        </div>
        {source ? (
          <span className="rounded-full bg-ungrd-yellow px-3 py-1 text-[11px] font-extrabold tracking-wide text-ungrd-navy-deep uppercase">
            Base oficial conectada
          </span>
        ) : null}
      </header>

      {brief.kpis.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {brief.kpis.map((kpi) => {
            return (
              <article
                key={kpi.id}
                className="rounded-xl border border-white/12 bg-white/5 p-3 backdrop-blur-sm"
              >
                <p className="text-[11px] font-bold tracking-wide text-white/55 uppercase">
                  {kpi.label}
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  <span
                    className={
                      kpi.tone === "rojo"
                        ? "text-[#ff9a92]"
                        : kpi.tone === "amarillo"
                          ? "text-ungrd-yellow"
                          : kpi.tone === "verde"
                            ? "text-[#7ddeb5]"
                            : "text-white"
                    }
                  >
                    {kpi.value}
                  </span>
                </p>
                {kpi.hint ? (
                  <p className="mt-1 text-xs text-white/55">{kpi.hint}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <h3 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            Semáforo operativo
          </h3>
          {brief.semaphores.length === 0 ? (
            <p className="text-sm text-white/60">Sin clasificación disponible.</p>
          ) : (
            <ul className="space-y-2">
              {brief.semaphores.map((s) => {
                const st = LEVEL_STYLE[s.level];
                const pct = Math.round((s.count / totalSem) * 100);
                return (
                  <li
                    key={s.level}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-2 font-bold">
                        <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
                        {s.label}
                      </span>
                      <span className="tabular-nums text-white/80">
                        {formatNumber(s.count)} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${st.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-white/50">
                      Valor asociado: {formatCop(s.valor)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3 lg:col-span-3">
          <h3 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            Alertas para el tomador de decisión
          </h3>
          {brief.alerts.length === 0 ? (
            <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              Sin alertas críticas con los datos actuales.
            </p>
          ) : (
            <ul className="space-y-2">
              {brief.alerts.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-xl border px-3 py-3 text-sm ${severityClass(a.severity)}`}
                >
                  <p className="flex items-start gap-2 font-extrabold text-ungrd-heading dark:text-inherit">
                    {severityIcon(a.severity)}
                    <span>{a.title}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-snug opacity-90">
                    {a.detail}
                  </p>
                  {(a.count != null || a.valor != null) && (
                    <p className="mt-2 text-xs font-bold opacity-80">
                      {a.count != null ? `${formatNumber(a.count)} casos` : ""}
                      {a.count != null && a.valor != null ? " · " : ""}
                      {a.valor != null ? formatCop(a.valor) : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            <CircleDot className="h-3.5 w-3.5" />
            Distribución por capa / tipo de registro
          </h3>
          {brief.byLayer.length === 0 ? (
            <p className="text-sm text-white/50">Sin capas.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-auto pr-1">
              {brief.byLayer.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 border-b border-white/8 py-1.5 text-sm last:border-0"
                >
                  <span className="min-w-0 truncate font-semibold text-white/90">
                    {item.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/65">
                    {formatNumber(item.count)} · {formatCop(item.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="mb-3 text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            {brief.focusLabel}
          </h3>
          {brief.priorityList.length === 0 ? (
            <p className="text-sm text-white/50">
              No hay claves prioritarias con los criterios actuales.
            </p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-auto pr-1">
              {brief.priorityList.map((item, idx) => (
                <li
                  key={item.key}
                  className="grid grid-cols-[1.5rem_1fr_auto] items-start gap-2 border-b border-white/8 py-1.5 text-sm last:border-0"
                >
                  <span className="pt-0.5 text-xs font-extrabold text-ungrd-yellow">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{item.label}</p>
                    {item.extra ? (
                      <p className="truncate text-xs text-white/50">{item.extra}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-right text-xs tabular-nums text-white/70">
                    {formatCop(item.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
