"use client";

import { useMemo, useState } from "react";
import { CapturePanel } from "@/components/CapturePanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { ThemeIcon } from "@/components/ThemeIcon";
import { getRecordsForTheme } from "@/lib/data";
import type { ThemeConfig } from "@/lib/themes";

export function ThemeWorkspace({ theme }: { theme: ThemeConfig }) {
  const [tab, setTab] = useState<"captura" | "analitica">("analitica");
  const [version, setVersion] = useState(0);

  const records = useMemo(
    () => getRecordsForTheme(theme.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.id, version],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-ungrd-navy p-3 text-ungrd-yellow">
            <ThemeIcon name={theme.icon} className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-ungrd-heading">
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
        className="flex gap-1 border-b border-ungrd-border"
        role="tablist"
      >
        {(
          [
            ["captura", "Captura de datos"],
            ["analitica", "Analítica"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`relative px-4 py-3 text-sm font-extrabold transition ${
              tab === id
                ? "text-ungrd-heading"
                : "text-ungrd-muted hover:text-ungrd-heading"
            }`}
          >
            {label}
            {tab === id && (
              <span className="absolute inset-x-2 -bottom-px h-1 rounded-full bg-ungrd-yellow" />
            )}
          </button>
        ))}
      </div>

      {tab === "captura" ? (
        <CapturePanel theme={theme} onSaved={() => setVersion((v) => v + 1)} />
      ) : (
        <AnalyticsPanel theme={theme} records={records} />
      )}
    </div>
  );
}
