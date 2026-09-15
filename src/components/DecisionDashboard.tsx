"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Download,
  Microscope,
  Search,
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
import { downloadThemeBriefingPdf } from "@/lib/analytics/themeBriefingPdf";
import { formatCop, formatNumber, type RecordRow } from "@/lib/records/types";
import { ThemeBriefDetail } from "@/components/ThemeBriefDetail";
import { displayCapaLabel } from "@/lib/capa-display";
import {
  buildFicOperativeRows,
  matchFicOperativeRow,
} from "@/themes/fic/dashboard";

type Props = {
  themeId: string;
  themeName: string;
  records: RecordRow[];
  /** Resumen de filtros activos (para el PDF). */
  filterSummary?: string;
};

type Scale = "macro" | "micro";

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
      cardClass: "border-[#c62828]/35 bg-ungrd-surface",
      accent: "border-l-[#c62828]",
    };
  if (s === "alta")
    return {
      icon: <ShieldAlert className="h-4 w-4" aria-hidden />,
      badge: "Alta",
      badgeClass: "bg-[#ef6c00] text-white",
      cardClass: "border-[#ef6c00]/35 bg-ungrd-surface",
      accent: "border-l-[#ef6c00]",
    };
  if (s === "media")
    return {
      icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
      badge: "Media",
      badgeClass: "bg-[#f9a825] text-[#1a237e]",
      cardClass: "border-[#f9a825]/50 bg-ungrd-surface",
      accent: "border-l-[#f9a825]",
    };
  return {
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    badge: "Info",
    badgeClass: "bg-[#455a64] text-white",
    cardClass: "border-ungrd-border bg-ungrd-surface",
    accent: "border-l-[#455a64]",
  };
}

export function DecisionDashboard({
  themeId,
  themeName,
  records,
  filterSummary = "Sin filtros · base completa",
}: Props) {
  const [scale, setScale] = useState<Scale>("macro");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [ficQuery, setFicQuery] = useState("");
  const working = useMemo(() => {
    return isSourceTheme(themeId)
      ? enrichRecordsForDecision(records)
      : records;
  }, [themeId, records]);
  const brief = useMemo(
    () => buildDecisionBrief(themeId, working),
    [themeId, working],
  );
  const ficRows = useMemo(
    () => (themeId === "fic" ? buildFicOperativeRows(working) : []),
    [themeId, working],
  );
  const visibleFicRows = useMemo(() => {
    const q = ficQuery.trim();
    if (!q) return ficRows;
    return ficRows.filter((row) => matchFicOperativeRow(row, q));
  }, [ficRows, ficQuery]);

  const totalSem = brief.semaphores.reduce((a, s) => a + s.count, 0) || 1;
  const source = isSourceTheme(themeId);
  const isFic = themeId === "fic";
  // FIC: sin Macro/Micro — el tablero muestra el detalle completo de una sola vez.
  const visibleAlerts = isFic
    ? brief.alerts
    : scale === "macro"
      ? brief.alerts.slice(0, 5)
      : brief.alerts;
  const visibleLayers = isFic
    ? brief.byLayer
    : scale === "macro"
      ? brief.byLayer.slice(0, 8)
      : brief.byLayer;
  const visiblePriority = isFic
    ? brief.priorityList
    : scale === "macro"
      ? brief.priorityList.slice(0, 10)
      : brief.priorityList;

  async function onDownloadPdf() {
    if (records.length === 0 || pdfBusy) return;
    setPdfBusy(true);
    try {
      await downloadThemeBriefingPdf({
        themeId,
        themeName,
        brief,
        filterSummary,
        recordCount: records.length,
      });
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section
      className="min-w-0 space-y-4 rounded-2xl border border-ungrd-navy/20 bg-[linear-gradient(160deg,#001a36_0%,#0a3d6b_45%,#002d5a_100%)] p-4 text-white shadow-[0_20px_50px_rgba(0,26,54,0.35)] sm:p-5"
      aria-label={`Dashboard operativo ${themeName}`}
    >
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-ungrd-yellow uppercase">
            {isFic ? "FIC · Legalización" : "Dashboard Operativo · UNGRD"}
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
            {brief.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/75">
            {brief.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onDownloadPdf()}
            disabled={records.length === 0 || pdfBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ungrd-yellow px-3 py-1.5 text-[11px] font-extrabold text-ungrd-navy-deep hover:brightness-105 disabled:opacity-50"
            title={
              isFic
                ? "Descargar reporte PDF del resumen FIC (respeta filtros)"
                : "Descargar briefing PDF con identidad UNGRD (respeta filtros)"
            }
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {pdfBusy
              ? "Generando…"
              : isFic
                ? "Descargar reporte PDF"
                : "Briefing PDF"}
          </button>
          {!isFic ? (
            <div className="inline-flex rounded-lg bg-black/30 p-1 ring-1 ring-white/20">
              <button
                type="button"
                onClick={() => setScale("macro")}
                className={`rounded-md px-3 py-1.5 text-[11px] font-extrabold ${
                  scale === "macro"
                    ? "bg-ungrd-yellow text-ungrd-navy-deep"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Macro
              </button>
              <button
                type="button"
                onClick={() => setScale("micro")}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-extrabold ${
                  scale === "micro"
                    ? "bg-ungrd-yellow text-ungrd-navy-deep"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <Microscope className="h-3.5 w-3.5" />
                Micro
              </button>
            </div>
          ) : null}
          {!isFic && source ? (
            <span className="rounded-full bg-ungrd-yellow px-3 py-1 text-[11px] font-extrabold tracking-wide text-ungrd-navy-deep uppercase">
              Base oficial conectada
            </span>
          ) : null}
        </div>
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

      {isFic ? (
        <div className="rounded-xl border border-ungrd-border bg-ungrd-surface p-3.5 text-ungrd-heading shadow-sm sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-navy uppercase">
                Tabla operativa
              </h3>
              <p className="mt-1 text-xs text-ungrd-muted">
                Departamento, municipio, plazos, formato, actos y desembolso.
                Desplace la tabla para ver todas las columnas; el texto largo
                queda completo.
              </p>
            </div>
            <span className="text-xs font-bold text-ungrd-muted">
              {formatNumber(visibleFicRows.length)}
              {visibleFicRows.length !== ficRows.length
                ? ` de ${formatNumber(ficRows.length)}`
                : ""}{" "}
              FIC
            </span>
          </div>
          {ficRows.length > 0 ? (
            <label className="mb-3 flex items-center gap-2 rounded-lg border border-ungrd-border bg-ungrd-bg px-3 py-2 text-sm">
              <Search className="h-4 w-4 shrink-0 text-ungrd-muted" aria-hidden />
              <input
                type="search"
                value={ficQuery}
                onChange={(e) => setFicQuery(e.target.value)}
                placeholder="Buscar FIC, depto, municipio, resolución, plazo…"
                className="w-full bg-transparent text-ungrd-heading outline-none placeholder:text-ungrd-muted"
              />
            </label>
          ) : null}
          {visibleFicRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ungrd-border px-3 py-6 text-center text-sm text-ungrd-muted">
              {ficRows.length === 0
                ? "No hay FIC en este filtro. Quite filtros arriba para ver la base."
                : "Ningún FIC coincide con esa búsqueda."}
            </p>
          ) : (
            <div className="scroll-thin max-h-[min(70vh,44rem)] overflow-auto rounded-lg border border-ungrd-border">
              <table className="min-w-[118rem] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-ungrd-bg text-[11px] tracking-wide text-ungrd-muted uppercase">
                  <tr>
                    <th className="px-3 py-2.5 font-bold">#</th>
                    <th className="px-3 py-2.5 font-bold">Nº FIC</th>
                    <th className="px-3 py-2.5 font-bold">Departamento</th>
                    <th className="px-3 py-2.5 font-bold">Municipio</th>
                    <th className="px-3 py-2.5 font-bold">Vigencia</th>
                    <th className="px-3 py-2.5 font-bold">Estado</th>
                    <th className="px-3 py-2.5 font-bold">Plazo ejecución</th>
                    <th className="px-3 py-2.5 font-bold">Plazo final</th>
                    <th className="px-3 py-2.5 font-bold">Nº RC</th>
                    <th className="px-3 py-2.5 font-bold">Formato</th>
                    <th className="px-3 py-2.5 font-bold">Acto admin.</th>
                    <th className="px-3 py-2.5 font-bold">Acto 2</th>
                    <th className="px-3 py-2.5 font-bold">Fecha acto</th>
                    <th className="px-3 py-2.5 font-bold">Fecha acto 2</th>
                    <th className="px-3 py-2.5 font-bold">Desembolso</th>
                    <th className="px-3 py-2.5 font-bold">Fecha mod.</th>
                    <th className="px-3 py-2.5 font-bold">% avance</th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      Valor desembolso
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      Por legalizar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFicRows.map((item, idx) => (
                    <tr
                      key={item.key}
                      className="border-t border-ungrd-border align-top hover:bg-ungrd-yellow/10"
                    >
                      <td className="px-3 py-2.5 text-xs font-extrabold text-ungrd-navy">
                        {idx + 1}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-bold text-ungrd-heading">
                        {item.noCdp}
                      </td>
                      <td className="min-w-[9rem] px-3 py-2.5 leading-snug text-ungrd-text">
                        {item.departamento}
                      </td>
                      <td className="min-w-[9rem] px-3 py-2.5 leading-snug text-ungrd-text">
                        {item.municipio}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                        {item.vigencia}
                      </td>
                      <td className="min-w-[8rem] px-3 py-2.5 leading-snug text-ungrd-text">
                        {item.estado}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                        {item.plazoEjecucion}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                        {item.plazoFinal}
                      </td>
                      <td className="px-3 py-2.5 text-ungrd-text">
                        {item.noRc}
                      </td>
                      <td className="min-w-[14rem] max-w-[22rem] px-3 py-2.5 leading-snug text-ungrd-text">
                        {item.formatoAprobacion}
                      </td>
                      <td className="min-w-[16rem] max-w-[28rem] px-3 py-2.5 leading-snug text-ungrd-text">
                        {item.acto}
                      </td>
                      <td className="min-w-[12rem] max-w-[22rem] px-3 py-2.5 leading-snug text-ungrd-text">
                        {item.acto2}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                        {item.fechaActo}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                        {item.fechaActo2}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                        {item.fechaDesembolso}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                        {item.fechaModificacion}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-ungrd-heading">
                        {item.avancePct}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ungrd-heading">
                        {formatCop(item.valor)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ungrd-heading">
                        {formatCop(item.porLegalizar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <h3 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            {isFic ? "Estado de legalización" : "Semáforo operativo"}
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
            {isFic ? "Alertas" : "Alertas para el tomador de decisión"}
          </h3>
          {visibleAlerts.length === 0 ? (
            <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-ungrd-surface px-3 py-3 text-sm font-semibold text-ungrd-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Sin alertas críticas con los datos actuales.
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleAlerts.map((a) => {
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

      <div className={`grid gap-4 ${isFic ? "" : "lg:grid-cols-2"}`}>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
            <CircleDot className="h-3.5 w-3.5" />
            {brief.layerLabel ||
              (isFic
                ? "Por vigencia"
                : "Distribución por capa / tipo de registro")}
          </h3>
          {visibleLayers.length === 0 ? (
            <p className="text-sm text-white/55">Sin capas.</p>
          ) : (
            <ul
              className={`space-y-2 overflow-auto pr-1 ${
                isFic || scale === "micro" ? "max-h-96" : "max-h-56"
              }`}
            >
              {visibleLayers.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 border-b border-white/10 py-1.5 text-sm last:border-0"
                >
                  <span className="min-w-0 truncate font-semibold text-white">
                    {isFic
                      ? displayCapaLabel(themeId, item.label)
                      : item.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/70">
                    {formatNumber(item.count)} · {formatCop(item.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isFic ? (
          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <h3 className="mb-3 text-xs font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
              {brief.focusLabel}
              {scale === "micro"
                ? ` · ${formatNumber(visiblePriority.length)}`
                : ""}
            </h3>
            {visiblePriority.length === 0 ? (
              <p className="text-sm text-white/55">
                No hay claves prioritarias con los criterios actuales.
              </p>
            ) : (
              <ul
                className={`space-y-2 overflow-auto pr-1 ${
                  scale === "micro" ? "max-h-96" : "max-h-56"
                }`}
              >
                {visiblePriority.map((item, idx) => (
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
                        <p className="truncate text-xs text-white/55">
                          {item.extra}
                        </p>
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
        ) : null}
      </div>

      {!isFic && scale === "micro" && source ? (
        <div className="rounded-xl border border-ungrd-border bg-ungrd-surface p-3 text-ungrd-heading">
          <p className="mb-2 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
            Ficha micro completa de la base
          </p>
          <ThemeBriefDetail
            themeId={themeId}
            themeLabel={themeName}
            brief={brief}
            defaultOpen
          />
        </div>
      ) : null}

      {!isFic &&
      scale === "macro" &&
      (brief.alerts.length > 5 ||
        brief.byLayer.length > 8 ||
        brief.priorityList.length > 10) ? (
        <button
          type="button"
          onClick={() => setScale("micro")}
          className="w-full rounded-xl border border-ungrd-yellow/40 bg-ungrd-yellow/15 px-3 py-2.5 text-sm font-extrabold text-ungrd-yellow hover:bg-ungrd-yellow/25"
        >
          Hay más detalle — pasar a Micro
        </button>
      ) : null}
    </section>
  );
}
