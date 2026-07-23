"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
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
  { bar: string; dot: string; label: string }
> = {
  rojo: { bar: "bg-[#c62828]", dot: "bg-[#c62828]", label: "Crítico" },
  amarillo: { bar: "bg-[#ef6c00]", dot: "bg-[#ef6c00]", label: "En seguimiento" },
  verde: { bar: "bg-[#2e7d32]", dot: "bg-[#2e7d32]", label: "Al día" },
  gris: { bar: "bg-[#607d8b]", dot: "bg-[#607d8b]", label: "Sin clasificar" },
};

function severityMeta(s: DecisionAlert["severity"]) {
  if (s === "critica")
    return {
      icon: <Siren className="h-4 w-4" aria-hidden />,
      badge: "Crítica",
      badgeClass: "bg-[#c62828] text-white",
      cardClass: "border-[#c62828]/35 bg-white",
      accent: "border-l-[#c62828]",
    };
  if (s === "alta")
    return {
      icon: <ShieldAlert className="h-4 w-4" aria-hidden />,
      badge: "Alta",
      badgeClass: "bg-[#ef6c00] text-white",
      cardClass: "border-[#ef6c00]/35 bg-white",
      accent: "border-l-[#ef6c00]",
    };
  if (s === "media")
    return {
      icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
      badge: "Media",
      badgeClass: "bg-[#f9a825] text-[#1a237e]",
      cardClass: "border-[#f9a825]/50 bg-white",
      accent: "border-l-[#f9a825]",
    };
  return {
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    badge: "Info",
    badgeClass: "bg-[#455a64] text-white",
    cardClass: "border-slate-200 bg-white",
    accent: "border-l-[#455a64]",
  };
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
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/75">
            {brief.subtitle}
          </p>
        </div>
        {source ? (
          <span className="rounded-full bg-ungrd-yellow px-3 py-1 text-[11px] font-extrabold tracking-wide text-ungrd-navy-deep uppercase">
            Base oficial conectada
          </span>
        ) : null}
      </header>

      {brief.kpis.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {brief.kpis.map((kpi) => (
            <article
              key={kpi.id}
              className="rounded-xl border border-white/15 bg-white/[0.07] p-3.5 backdrop-blur-sm"
            >
              <p className="text-[11px] font-bold tracking-wide text-white/60 uppercase">
                {kpi.label}
              </p>
              <p
                className={`mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight ${
                  kpi.tone === "rojo"
                    ? "text-[#ffb4ae]"
                    : kpi.tone === "amarillo"
                      ? "text-ungrd-yellow"
                      : kpi.tone === "verde"
                        ? "text-[#9be7b8]"
                        : "text-white"
                }`}
              >
                {kpi.value}
              </p>
              {kpi.hint ? (
                <p className="mt-1.5 text-xs leading-snug text-white/55">
                  {kpi.hint}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <h3 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            Semáforo operativo
          </h3>
          {brief.semaphores.length === 0 ? (
            <p className="rounded-xl bg-white/5 px-3 py-3 text-sm text-white/65">
              Sin clasificación disponible.
            </p>
          ) : (
            <ul className="space-y-2">
              {brief.semaphores.map((s) => {
                const st = LEVEL_STYLE[s.level];
                const pct = Math.round((s.count / totalSem) * 100);
                return (
                  <li
                    key={s.level}
                    className="rounded-xl border border-white/10 bg-black/25 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-2 font-bold text-white">
                        <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
                        {s.label}
                      </span>
                      <span className="tabular-nums font-semibold text-white/85">
                        {formatNumber(s.count)} · {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
                      <div
                        className={`h-full rounded-full ${st.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-white/55">
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
            <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-white px-3 py-3 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Sin alertas críticas con los datos actuales.
            </p>
          ) : (
            <ul className="space-y-3">
              {brief.alerts.map((a) => {
                const meta = severityMeta(a.severity);
                return (
                  <li
                    key={a.id}
                    className={`rounded-xl border border-l-4 px-4 py-3.5 shadow-sm ${meta.cardClass} ${meta.accent}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide uppercase ${meta.badgeClass}`}
                      >
                        {meta.icon}
                        {meta.badge}
                      </span>
                      {(a.count != null || a.valor != null) && (
                        <span className="text-xs font-bold text-slate-600">
                          {a.count != null
                            ? `${formatNumber(a.count)} casos`
                            : ""}
                          {a.count != null && a.valor != null ? " · " : ""}
                          {a.valor != null ? formatCop(a.valor) : ""}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-base font-extrabold leading-snug text-slate-900">
                      {a.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                      {a.detail}
                    </p>
                    {a.action ? (
                      <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold leading-snug text-slate-800">
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ungrd-navy" />
                        <span>
                          <span className="text-ungrd-navy">Qué hacer: </span>
                          {a.action}
                        </span>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            <CircleDot className="h-3.5 w-3.5" />
            Distribución por capa / tipo de registro
          </h3>
          {brief.byLayer.length === 0 ? (
            <p className="text-sm text-white/55">Sin capas.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-auto pr-1">
              {brief.byLayer.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 border-b border-white/10 py-1.5 text-sm last:border-0"
                >
                  <span className="min-w-0 truncate font-semibold text-white">
                    {item.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/70">
                    {formatNumber(item.count)} · {formatCop(item.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
          <h3 className="mb-3 text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            {brief.focusLabel}
          </h3>
          {brief.priorityList.length === 0 ? (
            <p className="text-sm text-white/55">
              No hay claves prioritarias con los criterios actuales.
            </p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-auto pr-1">
              {brief.priorityList.map((item, idx) => (
                <li
                  key={item.key}
                  className="grid grid-cols-[1.5rem_1fr_auto] items-start gap-2 border-b border-white/10 py-1.5 text-sm last:border-0"
                >
                  <span className="pt-0.5 text-xs font-extrabold text-ungrd-yellow">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{item.label}</p>
                    {item.extra ? (
                      <p className="truncate text-xs text-white/55">{item.extra}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-right text-xs tabular-nums text-white/75">
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
