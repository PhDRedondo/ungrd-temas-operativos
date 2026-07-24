"use client";

import { useEffect, useState } from "react";
import { CapturePanel } from "@/components/CapturePanel";
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
  {
    id: "captura",
    short: "Captura",
    label: "Captura de datos",
    highlight: false,
  },
  {
    id: "analitica",
    short: "Decisión",
    label: "Centro de mando",
    highlight: true,
  },
  {
    id: "quickbi",
    short: "QuickBI",
    label: "QuickBI",
    highlight: false,
  },
  {
    id: "avanzado",
    short: "Avanzado",
    label: "Análisis avanzado",
    highlight: false,
  },
  {
    id: "cargas",
    short: "Cargas",
    label: "Cargas Excel",
    highlight: false,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(v: string | undefined | null): v is TabId {
  return (
    v === "captura" ||
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
  const [tab, setTab] = useState<TabId>(
    isTabId(initialTab) ? initialTab : "analitica",
  );
  const [version, setVersion] = useState(0);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RecordFilterState>(() => ({
    ...EMPTY_RECORD_FILTERS,
    ...initialFilters,
  }));

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
      if (isTabId(nextTab)) setTab(nextTab);
      setFilters(parseFiltersFromParams(sp));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function bump() {
    setVersion((v) => v + 1);
  }

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-xl bg-ungrd-navy p-3 text-ungrd-yellow">
            <ThemeIcon name={theme.icon} className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-ungrd-heading sm:text-2xl">
              {theme.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ungrd-muted">
              {theme.description}
            </p>
            <p className="mt-1 text-xs text-ungrd-muted">
              Persistencia PostgreSQL · {records.length} registros
              {loading ? " · cargando…" : ""} · Geo DIVIPOLA DANE · mapa MGN
              2024
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={bump}
          className="rounded-lg border border-ungrd-border px-3 py-2 text-sm font-bold text-ungrd-heading hover:bg-ungrd-bg"
        >
          Actualizar datos
        </button>
      </div>

      <div
        id="tour-tabs"
        className="flex min-w-0 gap-1 overflow-x-auto border-b border-ungrd-border"
        role="tablist"
      >
        {TABS.map((t) => (
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
                  t.id === "cargas" ||
                  t.id === "avanzado")
              ) {
                bump();
              }
            }}
            className={`relative shrink-0 px-3 py-3 text-sm font-extrabold transition sm:px-4 ${
              t.highlight
                ? tab === t.id
                  ? "text-ungrd-heading"
                  : "text-ungrd-heading/80 hover:text-ungrd-heading"
                : tab === t.id
                  ? "text-ungrd-heading"
                  : "text-ungrd-muted hover:text-ungrd-heading"
            }`}
          >
            {t.highlight ? (
              <>
                <span className="rounded-full bg-ungrd-yellow px-2.5 py-1 text-ungrd-navy sm:hidden">
                  {t.short}
                </span>
                <span className="hidden rounded-full bg-ungrd-yellow px-2.5 py-1 text-ungrd-navy sm:inline">
                  {t.label}
                </span>
              </>
            ) : (
              <>
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </>
            )}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-1 rounded-full bg-ungrd-yellow" />
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-ungrd-danger">
          {error}
        </p>
      )}

      {tab === "captura" && <CapturePanel theme={theme} onSaved={bump} />}
      {tab === "analitica" && (
        <AnalyticsPanel
          key={`analytics-${version}`}
          theme={theme}
          records={records}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
      {tab === "avanzado" && (
        <AdvancedAnalysisPanel
          theme={theme}
          records={records}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
      {tab === "quickbi" && <QuickBIPanel theme={theme} />}
      {tab === "cargas" && (
        <UploadsInbox key={`inbox-${version}`} themeId={theme.id} compact />
      )}
    </div>
  );
}
