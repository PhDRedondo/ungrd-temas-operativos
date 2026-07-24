"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { DecisionBrief } from "@/lib/analytics/decision";
import { buildThemeHref } from "@/lib/analytics/recordFilters";
import { formatCop, formatNumber } from "@/lib/records/types";

/** Detalle desplegable de una base (micro) reutilizable en mando nacional y tema. */
export function ThemeBriefDetail({
  themeId,
  themeLabel,
  brief,
  defaultOpen = false,
}: {
  themeId: string;
  themeLabel: string;
  brief: DecisionBrief;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-ungrd-border bg-ungrd-surface open:bg-ungrd-bg/40"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-extrabold text-ungrd-heading">{themeLabel}</p>
          <p className="truncate text-xs text-ungrd-muted">
            {brief.kpis[0]?.value || "—"} · {formatNumber(brief.alerts.length)}{" "}
            alertas · {formatNumber(brief.priorityList.length)} claves
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-ungrd-muted transition group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-ungrd-border px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {brief.kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="rounded-lg border border-ungrd-border bg-white px-3 py-2"
            >
              <p className="text-[10px] font-bold tracking-wide text-ungrd-muted uppercase">
                {kpi.label}
              </p>
              <p className="mt-0.5 text-lg font-extrabold text-ungrd-heading">
                {kpi.value}
              </p>
              {kpi.hint ? (
                <p className="mt-0.5 text-[11px] text-ungrd-muted">{kpi.hint}</p>
              ) : null}
            </div>
          ))}
        </div>

        {brief.semaphores.length > 0 ? (
          <div>
            <h4 className="text-[11px] font-extrabold tracking-wide text-ungrd-navy uppercase">
              Semáforo
            </h4>
            <ul className="mt-2 space-y-1 text-sm">
              {brief.semaphores.map((s) => (
                <li
                  key={s.level}
                  className="flex justify-between gap-2 rounded-lg bg-white px-3 py-1.5 ring-1 ring-ungrd-border"
                >
                  <span className="font-semibold text-ungrd-heading">
                    {s.label}
                  </span>
                  <span className="tabular-nums text-ungrd-muted">
                    {formatNumber(s.count)} · {formatCop(s.valor)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {brief.alerts.length > 0 ? (
          <div>
            <h4 className="text-[11px] font-extrabold tracking-wide text-ungrd-navy uppercase">
              Alertas de la base
            </h4>
            <ul className="mt-2 max-h-64 space-y-2 overflow-auto">
              {brief.alerts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-l-4 border-ungrd-border border-l-ungrd-navy bg-white px-3 py-2 text-sm"
                >
                  <p className="font-extrabold text-ungrd-heading">{a.title}</p>
                  <p className="mt-0.5 text-ungrd-muted">{a.detail}</p>
                  {a.action ? (
                    <p className="mt-1 text-xs font-semibold text-ungrd-navy">
                      Qué hacer: {a.action}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-ungrd-muted">Sin alertas en esta base.</p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="text-[11px] font-extrabold tracking-wide text-ungrd-navy uppercase">
              Capas / tipo de registro
            </h4>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
              {brief.byLayer.length === 0 ? (
                <li className="text-ungrd-muted">Sin capas.</li>
              ) : (
                brief.byLayer.map((item) => (
                  <li
                    key={item.key}
                    className="flex justify-between gap-2 border-b border-ungrd-border py-1"
                  >
                    <span className="truncate font-semibold">{item.label}</span>
                    <span className="shrink-0 tabular-nums text-ungrd-muted">
                      {formatNumber(item.count)} · {formatCop(item.valor)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-extrabold tracking-wide text-ungrd-navy uppercase">
              {brief.focusLabel}
            </h4>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
              {brief.priorityList.length === 0 ? (
                <li className="text-ungrd-muted">Sin claves prioritarias.</li>
              ) : (
                brief.priorityList.map((item, idx) => (
                  <li
                    key={item.key}
                    className="grid grid-cols-[1.25rem_1fr_auto] gap-2 border-b border-ungrd-border py-1"
                  >
                    <span className="text-xs font-extrabold text-ungrd-navy">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.label}</p>
                      {item.extra ? (
                        <p className="truncate text-xs text-ungrd-muted">
                          {item.extra}
                        </p>
                      ) : null}
                    </div>
                    <span className="tabular-nums text-xs text-ungrd-muted">
                      {formatCop(item.valor)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <Link
          href={buildThemeHref(themeId, { tab: "analitica" })}
          className="inline-flex items-center gap-1 text-sm font-extrabold text-ungrd-navy underline-offset-2 hover:underline"
        >
          Abrir centro de mando del tema <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </details>
  );
}
