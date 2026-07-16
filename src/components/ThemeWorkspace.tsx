"use client";

import { useMemo, useState } from "react";
import { CapturePanel } from "@/components/CapturePanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { AdvancedAnalysisPanel } from "@/components/AdvancedAnalysisPanel";
import { ThemeIcon } from "@/components/ThemeIcon";
import { getRecordsForTheme } from "@/lib/data";
import type { ThemeConfig } from "@/lib/themes";

const TABS = [
  {
    id: "captura",
    short: "Captura",
    label: "Captura de datos",
  },
  {
    id: "analitica",
    short: "Descriptiva",
    label: "Analítica descriptiva",
  },
  {
    id: "avanzado",
    short: "Avanzado",
    label: "Análisis avanzado",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ThemeWorkspace({ theme }: { theme: ThemeConfig }) {
  const [tab, setTab] = useState<TabId>("analitica");
  const [version, setVersion] = useState(0);

  const records = useMemo(
    () => getRecordsForTheme(theme.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.id, version],
  );

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
          </div>
        </div>
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
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 px-3 py-3 text-sm font-extrabold transition sm:px-4 ${
              tab === t.id
                ? "text-ungrd-heading"
                : "text-ungrd-muted hover:text-ungrd-heading"
            }`}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-1 rounded-full bg-ungrd-yellow" />
            )}
          </button>
        ))}
      </div>

      {tab === "captura" && (
        <CapturePanel theme={theme} onSaved={() => setVersion((v) => v + 1)} />
      )}
      {tab === "analitica" && (
        <AnalyticsPanel theme={theme} records={records} />
      )}
      {tab === "avanzado" && (
        <AdvancedAnalysisPanel theme={theme} records={records} />
      )}
    </div>
  );
}
