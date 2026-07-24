"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Microscope,
  Radar,
  RefreshCw,
  ShieldAlert,
  Siren,
} from "lucide-react";
import type { NationalBrief } from "@/lib/analytics/national";
import { downloadNationalBriefingPdf } from "@/lib/analytics/nationalBriefingPdf";
import { downloadNationalBriefingExcel } from "@/lib/analytics/nationalBriefingExcel";
import { DECISION_THRESHOLDS } from "@/lib/analytics/decision";
import { buildThemeHref } from "@/lib/analytics/recordFilters";
import { formatCop, formatNumber } from "@/lib/records/types";
import { ExpedienteTimeline } from "@/components/ExpedienteTimeline";
import { ThemeBriefDetail } from "@/components/ThemeBriefDetail";
import type { MapPoint } from "@/components/ColombiaMap";

const ColombiaMap = dynamic(
  () => import("./ColombiaMap").then((m) => m.ColombiaMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-ungrd-border bg-ungrd-bg text-sm text-ungrd-muted">
        Cargando mapa…
      </div>
    ),
  },
);

type Scale = "macro" | "micro";

function severityMeta(s: NationalBrief["alerts"][number]["severity"]) {
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

function themeHrefFromAlertId(id: string, departamento?: string) {
  const themeId = id.includes(":") ? id.split(":")[0]! : "";
  if (!themeId || themeId.startsWith("nat-")) return null;
  return buildThemeHref(themeId, {
    tab: "analitica",
    departamento: departamento || "",
  });
}

export function NationalCommandCenter() {
  const [brief, setBrief] = useState<NationalBrief | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedMuni, setSelectedMuni] = useState("");
  const [scale, setScale] = useState<Scale>("macro");
  const [openThemeId, setOpenThemeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/national");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el mando nacional");
        setBrief(null);
        return;
      }
      setBrief(data as NationalBrief);
    } catch {
      setError("Error de conexión al cargar el tablero nacional");
      setBrief(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCell = useMemo(() => {
    if (!brief || !selectedDept) return null;
    return (
      brief.territories.find((t) => t.departamento === selectedDept) || null
    );
  }, [brief, selectedDept]);

  const munisInDept = useMemo(() => {
    if (!brief || !selectedDept) return [];
    return brief.municipalities.filter(
      (m) => m.departamento === selectedDept,
    );
  }, [brief, selectedDept]);

  const selectedMuniCell = useMemo(() => {
    if (!selectedMuni) return null;
    return munisInDept.find((m) => m.municipio === selectedMuni) || null;
  }, [munisInDept, selectedMuni]);

  const visibleAlerts =
    scale === "macro"
      ? brief?.alerts.slice(0, 5) || []
      : brief?.alertsAll || brief?.alerts || [];

  const visibleKeys =
    scale === "macro"
      ? brief?.priorityKeys.slice(0, 10) || []
      : brief?.priorityKeys || [];

  function goMicroTheme(themeId: string) {
    setScale("micro");
    setOpenThemeId(themeId);
    requestAnimationFrame(() => {
      document
        .getElementById(`base-${themeId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-5 sm:py-6">
      <header className="rounded-2xl border border-ungrd-navy/20 bg-[linear-gradient(160deg,#001a36_0%,#0a3d6b_45%,#002d5a_100%)] p-4 text-white shadow-[0_20px_50px_rgba(0,26,54,0.35)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[10px] font-extrabold tracking-[0.22em] text-ungrd-yellow uppercase">
              <Radar className="h-3.5 w-3.5" />
              Centro de mando nacional · UNGRD
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              País en una sola vista
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75">
              Macro: presión país y briefing. Micro: despliegue cada una de las
              8 bases, municipios y claves con todo el detalle.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg bg-black/30 p-1 ring-1 ring-white/20">
              <button
                type="button"
                onClick={() => setScale("macro")}
                className={`rounded-md px-3 py-1.5 text-xs font-extrabold ${
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
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-extrabold ${
                  scale === "micro"
                    ? "bg-ungrd-yellow text-ungrd-navy-deep"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <Microscope className="h-3.5 w-3.5" />
                Micro
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Actualizar
            </button>
            <button
              type="button"
              disabled={!brief}
              onClick={() => brief && downloadNationalBriefingPdf(brief)}
              className="inline-flex items-center gap-2 rounded-lg bg-ungrd-yellow px-3 py-2 text-sm font-extrabold text-ungrd-navy-deep disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Briefing PDF
            </button>
            <button
              type="button"
              disabled={!brief}
              onClick={() => brief && downloadNationalBriefingExcel(brief)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          </div>
        </div>
        {brief ? (
          <p className="mt-3 text-xs text-white/55">
            Generado{" "}
            {new Date(brief.generatedAt).toLocaleString("es-CO")} · Criterios v
            {brief.criteriaVersion} · {formatNumber(brief.totals.departamentosConDato)}{" "}
            deptos · {formatNumber(brief.totals.municipiosConDato ?? 0)} municipios
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {busy && !brief ? (
        <div className="flex items-center justify-center gap-2 py-20 text-ungrd-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Construyendo tablero nacional…
        </div>
      ) : null}

      {brief ? (
        <>
          <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
            <h2 className="text-sm font-extrabold text-ungrd-heading">
              Briefing Director
            </h2>
            <p className="mt-1 text-sm font-semibold text-ungrd-navy">
              {brief.briefing.headline}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-ungrd-muted">
              {brief.briefing.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ungrd-navy" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {brief.kpis.map((kpi) => (
              <article
                key={kpi.id}
                className="rounded-xl border border-ungrd-border bg-ungrd-surface p-3.5"
              >
                <p className="text-[11px] font-bold tracking-wide text-ungrd-muted uppercase">
                  {kpi.label}
                </p>
                <p
                  className={`mt-1.5 text-2xl font-extrabold tabular-nums ${
                    kpi.tone === "rojo"
                      ? "text-[#c62828]"
                      : kpi.tone === "amarillo"
                        ? "text-[#ef6c00]"
                        : kpi.tone === "verde"
                          ? "text-[#2e7d32]"
                          : "text-ungrd-heading"
                  }`}
                >
                  {kpi.value}
                </p>
                {kpi.hint ? (
                  <p className="mt-1.5 text-xs text-ungrd-muted">{kpi.hint}</p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              <ColombiaMap
                areas={brief.mapAreas}
                metric="valor"
                metricLabel="Coropleta · presión territorial (0–100)"
                legendTitle="Presión territorial"
                legendHint="Cuantiles de presión 0–100 · más cálido = mayor presión (declaratoria + brecha + carga)"
                tooltipPrimaryLabel="Presión"
                formatValue={(v) => `${Math.round(v)}`}
                selectedDepartment={selectedDept}
                onSelect={(p: MapPoint) => {
                  setSelectedDept(p.name);
                  setSelectedMuni("");
                  if (scale === "macro") setScale("micro");
                }}
                onClearDepartment={() => {
                  setSelectedDept("");
                  setSelectedMuni("");
                }}
              />
            </div>
            <div className="min-w-0 space-y-3 lg:col-span-2">
              <div className="rounded-xl border border-ungrd-border bg-ungrd-surface p-3">
                <h3 className="text-xs font-extrabold tracking-[0.14em] text-ungrd-navy uppercase">
                  {scale === "macro"
                    ? "Dónde mirar hoy · top deptos"
                    : "Drill territorial · deptos y municipios"}
                </h3>
                <ol className="mt-3 max-h-56 space-y-1.5 overflow-auto">
                  {(scale === "macro"
                    ? brief.priorityDepts
                    : brief.territories
                  ).map((d, i) => (
                    <li key={d.departamento}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDept(d.departamento);
                          setSelectedMuni("");
                          setScale("micro");
                        }}
                        className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                          selectedDept === d.departamento
                            ? "bg-ungrd-navy/10 ring-1 ring-ungrd-navy/30"
                            : "hover:bg-ungrd-bg"
                        }`}
                      >
                        <span className="w-5 shrink-0 font-extrabold text-ungrd-muted">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-extrabold text-ungrd-heading">
                            {d.departamento}
                          </span>
                          <span className="mt-0.5 block text-xs text-ungrd-muted">
                            presión {d.pressure}
                            {d.gapRespuesta ? " · brecha" : ""} · decl.{" "}
                            {d.declaratoriaAbierta} · interv. {d.intervenciones}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              {selectedCell ? (
                <div className="rounded-xl border border-ungrd-border bg-ungrd-bg/60 p-3 text-sm">
                  <p className="font-extrabold text-ungrd-heading">
                    {selectedCell.departamento}
                  </p>
                  <p className="mt-1 text-xs text-ungrd-muted">
                    Valor {formatCop(selectedCell.valorTotal)} · presión{" "}
                    {selectedCell.pressure}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {Object.entries(selectedCell.byTheme).map(([id, v]) => (
                      <li key={id} className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goMicroTheme(id)}
                          className="font-semibold text-ungrd-navy underline-offset-2 hover:underline"
                        >
                          {id}
                        </button>
                        <span>
                          {formatNumber(v.count)} · {formatCop(v.valor)}
                        </span>
                        <Link
                          href={buildThemeHref(id, {
                            tab: "analitica",
                            departamento: selectedCell.departamento,
                            municipio: selectedMuni || "",
                          })}
                          className="text-ungrd-muted hover:text-ungrd-navy"
                        >
                          abrir →
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {munisInDept.length > 0 ? (
                    <div className="mt-3 border-t border-ungrd-border pt-3">
                      <p className="text-[11px] font-extrabold tracking-wide text-ungrd-navy uppercase">
                        Municipios ({formatNumber(munisInDept.length)})
                      </p>
                      <ul className="mt-2 max-h-44 space-y-1 overflow-auto">
                        {munisInDept.slice(0, scale === "micro" ? 80 : 8).map(
                          (m) => (
                            <li key={`${m.departamento}-${m.municipio}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMuni(m.municipio);
                                  setScale("micro");
                                }}
                                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                                  selectedMuni === m.municipio
                                    ? "bg-ungrd-navy/10 font-bold"
                                    : "hover:bg-white"
                                }`}
                              >
                                <span className="text-ungrd-heading">
                                  {m.municipio}
                                </span>
                                <span className="ml-2 text-ungrd-muted">
                                  p{m.pressure}
                                  {m.gapRespuesta ? " · brecha" : ""} ·{" "}
                                  {formatCop(m.valorTotal)}
                                </span>
                              </button>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  ) : null}

                  {selectedMuniCell ? (
                    <div className="mt-3 rounded-lg border border-ungrd-navy/20 bg-white p-2.5">
                      <p className="text-xs font-extrabold text-ungrd-heading">
                        Micro · {selectedMuniCell.municipio}
                      </p>
                      <ul className="mt-1.5 space-y-1 text-[11px]">
                        {Object.entries(selectedMuniCell.byTheme).map(
                          ([id, v]) => (
                            <li key={id}>
                              <button
                                type="button"
                                onClick={() => goMicroTheme(id)}
                                className="font-semibold text-ungrd-navy"
                              >
                                {id}
                              </button>
                              : {formatNumber(v.count)} · {formatCop(v.valor)}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {scale === "micro" && !selectedDept ? (
            <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
              <h2 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-navy uppercase">
                Top municipios prioritarios
              </h2>
              <ul className="mt-3 max-h-72 space-y-1.5 overflow-auto text-sm">
                {(brief.priorityMunicipalities || []).map((m, i) => (
                  <li key={`${m.departamento}-${m.municipio}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDept(m.departamento);
                        setSelectedMuni(m.municipio);
                      }}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-ungrd-bg"
                    >
                      <span className="w-5 font-extrabold text-ungrd-muted">
                        {i + 1}
                      </span>
                      <span>
                        <span className="font-extrabold text-ungrd-heading">
                          {m.municipio}
                        </span>
                        <span className="text-ungrd-muted">
                          {" "}
                          · {m.departamento}
                        </span>
                        <span className="mt-0.5 block text-xs text-ungrd-muted">
                          presión {m.pressure}
                          {m.gapRespuesta ? " · brecha" : ""} ·{" "}
                          {formatCop(m.valorTotal)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-navy uppercase">
                {scale === "macro"
                  ? "5 alertas prioritarias"
                  : `Todas las alertas (${formatNumber(visibleAlerts.length)})`}
              </h2>
              {scale === "macro" ? (
                <button
                  type="button"
                  onClick={() => setScale("micro")}
                  className="text-xs font-extrabold text-ungrd-navy underline-offset-2 hover:underline"
                >
                  Ver todas en Micro →
                </button>
              ) : null}
            </div>
            {visibleAlerts.length === 0 ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                Sin alertas críticas con los datos actuales.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {visibleAlerts.map((a) => {
                  const meta = severityMeta(a.severity);
                  const href = themeHrefFromAlertId(a.id, selectedDept);
                  return (
                    <li
                      key={a.id}
                      className={`rounded-xl border border-l-4 px-4 py-3.5 shadow-sm ${meta.cardClass} ${meta.accent}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${meta.badgeClass}`}
                        >
                          {meta.icon}
                          {meta.badge}
                        </span>
                        <p className="font-extrabold text-ungrd-heading">
                          {a.title}
                        </p>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-700">{a.detail}</p>
                      {a.action ? (
                        <p className="mt-2 text-sm font-semibold text-ungrd-navy">
                          Qué hacer: {a.action}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1 text-sm font-extrabold text-ungrd-navy underline-offset-2 hover:underline"
                          >
                            Ir al tema <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                        {href ? (
                          <button
                            type="button"
                            onClick={() =>
                              goMicroTheme(a.id.split(":")[0] || "")
                            }
                            className="text-sm font-bold text-ungrd-muted hover:text-ungrd-navy"
                          >
                            Desplegar base aquí
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <details className="mt-4 rounded-lg border border-ungrd-border bg-ungrd-bg/40 px-3 py-2 text-xs text-ungrd-muted">
              <summary className="cursor-pointer font-bold text-ungrd-heading">
                Por qué un territorio queda en rojo (criterios)
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  +40 si hay declaratoria abierta; +35 si además no hay
                  intervenciones visibles (agua/obras/flota).
                </li>
                <li>
                  Cola Agua ≥{DECISION_THRESHOLDS.aguaDiasCola} días; carrotanque
                  estancado &gt;{DECISION_THRESHOLDS.carrotanqueDiasEstancado}{" "}
                  días (criterios v{DECISION_THRESHOLDS.version}).
                </li>
                <li>
                  Dinero en riesgo = suma de valores en alertas críticas/altas
                  por tema.
                </li>
              </ul>
            </details>
          </section>

          <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-navy uppercase">
                {scale === "macro"
                  ? "10 claves a desbloquear"
                  : `Todas las claves prioritarias (${formatNumber(visibleKeys.length)})`}
              </h2>
              {scale === "macro" ? (
                <button
                  type="button"
                  onClick={() => setScale("micro")}
                  className="text-xs font-extrabold text-ungrd-navy underline-offset-2 hover:underline"
                >
                  Ver todas en Micro →
                </button>
              ) : null}
            </div>
            <ul className="mt-3 max-h-[28rem] divide-y divide-ungrd-border overflow-auto">
              {visibleKeys.map((k) => (
                <li
                  key={`${k.themeId}-${k.key}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-ungrd-heading">
                      {k.label}
                    </p>
                    {k.extra ? (
                      <p className="text-xs text-ungrd-muted">{k.extra}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold text-ungrd-muted">
                      {formatCop(k.valor)}
                    </span>
                    <button
                      type="button"
                      onClick={() => goMicroTheme(k.themeId)}
                      className="text-xs font-bold text-ungrd-muted hover:text-ungrd-navy"
                    >
                      Detalle
                    </button>
                    <Link
                      href={k.href}
                      className="inline-flex items-center gap-1 font-extrabold text-ungrd-navy"
                    >
                      Abrir <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section
            id="bases-detalle"
            className="space-y-3 rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xs font-extrabold tracking-[0.18em] text-ungrd-navy uppercase">
                  Detalle por base oficial (8)
                </h2>
                <p className="mt-1 text-sm text-ungrd-muted">
                  Despliegue cada base para ver KPIs, semáforo, alertas, capas y
                  claves. En Micro se abren con más contexto.
                </p>
              </div>
              {scale === "macro" ? (
                <button
                  type="button"
                  onClick={() => setScale("micro")}
                  className="text-xs font-extrabold text-ungrd-navy underline-offset-2 hover:underline"
                >
                  Modo Micro →
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              {brief.themeBriefs.map(({ themeId, themeLabel, brief: tb }) => {
                const shouldOpen =
                  scale === "micro" && openThemeId === themeId;
                return (
                  <div key={themeId} id={`base-${themeId}`}>
                    <ThemeBriefDetail
                      key={`${themeId}-${shouldOpen ? "open" : "closed"}`}
                      themeId={themeId}
                      themeLabel={themeLabel || themeId}
                      brief={tb}
                      defaultOpen={shouldOpen}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <ExpedienteTimeline />
        </>
      ) : null}
    </div>
  );
}
