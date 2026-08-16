"use client";

import { useEffect, useState } from "react";
import { CapturePanel } from "@/components/CapturePanel";
import { TrackingGrid } from "@/components/TrackingGrid";
import { MaquetaExcelView } from "@/components/MaquetaExcelView";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { AdvancedAnalysisPanel } from "@/components/AdvancedAnalysisPanel";
import { QuickBIPanel } from "@/components/QuickBIPanel";
import { UploadsInbox } from "@/components/UploadsInbox";
import { ThemeIcon } from "@/components/ThemeIcon";
import type { RecordRow } from "@/lib/records/types";
import type { ThemeConfig } from "@/lib/themes";
import {
  EMPTY_RECORD_FILTERS,
  parseFiltersFromParams,
  writeFiltersToParams,
  type RecordFilterState,
} from "@/lib/analytics/recordFilters";

const TABS = [
  { id: "cargas", short: "Excel", label: "Cargar Excel" },
  { id: "captura", short: "Captura", label: "Captura" },
  { id: "seguimiento", short: "Tabla", label: "Registros" },
  {
    id: "analitica",
    short: "Dashboard",
    label: "Dashboard Operativo",
  },
  { id: "quickbi", short: "QuickBI", label: "QuickBI" },
  /** Oculto por ahora (sin análisis avanzado en UI). No eliminar: reactivar quitando `hidden`. */
  {
    id: "avanzado",
    short: "Análisis",
    label: "Análisis",
    hidden: true,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VISIBLE_TABS = TABS.filter((t) => !("hidden" in t && t.hidden));

function isTabId(v: string | undefined | null): v is TabId {
  return (
    v === "captura" ||
    v === "seguimiento" ||
    v === "analitica" ||
    v === "quickbi" ||
    v === "avanzado" ||
    v === "cargas"
  );
}

export function ThemeWorkspace({
  theme,
  initialTab,
  initialFilters,
}: {
  theme: ThemeConfig;
  initialTab?: string;
  initialFilters?: Partial<RecordFilterState>;
}) {
  const [tab, setTab] = useState<TabId>(() => {
    if (!isTabId(initialTab)) return "captura";
    const def = TABS.find((t) => t.id === initialTab);
    if (def && "hidden" in def && def.hidden) return "analitica";
    return initialTab;
  });
  const [version, setVersion] = useState(0);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RecordFilterState>(() => ({
    ...EMPTY_RECORD_FILTERS,
    ...initialFilters,
  }));

  const [seguimientoMode, setSeguimientoMode] = useState<"excel" | "capas">(
    "excel",
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/themes/${theme.id}/records`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar");
        if (!cancelled) setRecords(data.records || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error");
          setRecords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [theme.id, version]);

  // Sync tab + filtros a la URL (compartible / deep-link).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = writeFiltersToParams(filters, tab);
    const next = params.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (next === current) return;
    const url = next
      ? `${window.location.pathname}?${next}`
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [filters, tab]);

  // Si el usuario navega atrás/adelante, rehidratar filtros/tab.
  useEffect(() => {
    function onPopState() {
      const sp = new URLSearchParams(window.location.search);
      const nextTab = sp.get("tab");
      if (isTabId(nextTab)) {
        const def = TABS.find((t) => t.id === nextTab);
        if (def && "hidden" in def && def.hidden) setTab("analitica");
        else setTab(nextTab);
      }
      setFilters(parseFiltersFromParams(sp));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function bump() {
    setVersion((v) => v + 1);
  }

  return (
    <div
      className="min-w-0 max-w-full space-y-5"
      data-theme-visual={theme.id}
    >
      <div className="theme-hero flex min-w-0 flex-wrap items-start justify-between gap-4 rounded-2xl px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="theme-mark shrink-0 rounded-xl p-3">
            <ThemeIcon name={theme.icon} className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="theme-hero-title text-xl font-extrabold sm:text-2xl">
              {theme.name}
            </h1>
            <p className="theme-hero-desc mt-1 max-w-2xl text-sm">
              {theme.description}
            </p>
            <p className="theme-hero-meta mt-1 text-xs">
              {loading
                ? "Cargando registros…"
                : `${records.length.toLocaleString("es-CO")} registros`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={bump}
          className="theme-btn-ghost px-3 py-2 text-sm"
        >
          Actualizar
        </button>
      </div>

      <div
        id="tour-tabs"
        className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-ungrd-border bg-ungrd-surface p-1"
        role="tablist"
      >
        {VISIBLE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              const switching = tab !== t.id;
              setTab(t.id);
              if (
                switching &&
                (t.id === "analitica" ||
                  t.id === "seguimiento" ||
                  t.id === "cargas" ||
                  t.id === "avanzado")
              ) {
                bump();
              }
            }}
            className={`relative shrink-0 rounded-lg px-3 py-2 text-sm font-extrabold transition sm:px-4 ${
              tab === t.id
                ? "theme-mark"
                : "text-ungrd-muted hover:bg-ungrd-bg hover:text-ungrd-heading"
            }`}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-ungrd-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 rounded-xl border border-ungrd-border bg-ungrd-surface px-4 py-6 text-sm text-ungrd-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ungrd-navy border-t-transparent" />
          Cargando registros de la base…
        </p>
      ) : null}

      {!loading && tab === "cargas" && (
        <div className="space-y-6">
          <CapturePanel
            theme={theme}
            records={records}
            onSaved={bump}
            variant="excel"
          />
          <UploadsInbox key={`inbox-${version}`} themeId={theme.id} compact />
        </div>
      )}
      {!loading && tab === "captura" && (
        <CapturePanel
          theme={theme}
          records={records}
          onSaved={bump}
          variant="form"
        />
      )}
      {!loading && tab === "seguimiento" && theme.captureForms?.length ? (
        <div className="space-y-3">
          <div className="theme-seg" role="group" aria-label="Vista de registros">
            <button
              type="button"
              data-active={seguimientoMode === "excel" ? "true" : "false"}
              onClick={() => setSeguimientoMode("excel")}
            >
              Tabla
            </button>
            <button
              type="button"
              data-active={seguimientoMode === "capas" ? "true" : "false"}
              onClick={() => setSeguimientoMode("capas")}
            >
              Por formulario
            </button>
          </div>
          {seguimientoMode === "excel" ? (
            <MaquetaExcelView
              key={`excel-${version}`}
              theme={theme}
              records={records}
              onChanged={bump}
            />
          ) : (
            <TrackingGrid
              key={`tracking-${version}`}
              theme={theme}
              records={records}
              onChanged={bump}
            />
          )}
        </div>
      ) : null}
      {!loading && tab === "seguimiento" && !theme.captureForms?.length ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          La vista Excel de seguimiento está disponible en temas con
          formularios por capa (p. ej. Agua y Saneamiento).
        </p>
      ) : null}
      {!loading && tab === "analitica" && (
        <AnalyticsPanel
          key={`analytics-${version}`}
          theme={theme}
          records={records}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
      {!loading && tab === "avanzado" && (
        <AdvancedAnalysisPanel
          theme={theme}
          records={records}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
      {!loading && tab === "quickbi" && <QuickBIPanel theme={theme} />}
    </div>
  );
}
