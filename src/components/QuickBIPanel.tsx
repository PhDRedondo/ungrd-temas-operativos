"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  Maximize2,
} from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";
import {
  getQuickBiDashboards,
  type QuickBiDashboard,
} from "@/lib/quickbi/catalog";

type Props = {
  theme: ThemeConfig;
};

function resolveDashboards(theme: ThemeConfig): QuickBiDashboard[] {
  if (theme.quickBiDashboards?.length) {
    return theme.quickBiDashboards.map((b) => ({
      title: b.title,
      description: b.description,
      url: b.url,
    }));
  }
  const fromCatalog = getQuickBiDashboards(theme.id);
  if (fromCatalog.length) return fromCatalog;
  // Compat: un solo quickBiUrl legado en la config del tema
  const legacy = theme.quickBiUrl?.trim();
  if (legacy) {
    return [
      {
        title: "Tablero Único",
        description:
          "Tablero ejecutivo QuickBI configurado para este tema.",
        url: legacy,
      },
    ];
  }
  return [];
}

export function QuickBIPanel({ theme }: Props) {
  const boards = useMemo(() => resolveDashboards(theme), [theme]);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = boards[Math.min(activeIdx, Math.max(boards.length - 1, 0))];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-5" id="vista-quickbi">
      <section className="overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface">
        <div className="border-b border-ungrd-border bg-[linear-gradient(105deg,var(--ungrd-navy-deep)_0%,var(--ungrd-navy)_55%,rgba(0,45,90,0.92)_100%)] px-4 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.14em] text-ungrd-yellow uppercase">
                QuickBI · Subdirección de Manejo
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
                {theme.name}
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm text-white/75">
                Tableros ejecutivos embebidos. Elija una vista; cada una resume
                un ángulo distinto de la operación.
              </p>
            </div>
            {active && (
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-extrabold text-white backdrop-blur transition hover:bg-white/20"
              >
                Abrir en QuickBI
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {boards.length > 0 && (
          <div className="border-b border-ungrd-border bg-ungrd-bg/60 px-3 py-3 sm:px-5">
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="tablist"
              aria-label="Tableros QuickBI"
            >
              {boards.map((b, i) => {
                const selected = i === activeIdx;
                return (
                  <button
                    key={`${b.title}-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveIdx(i)}
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-left text-sm font-bold transition ${
                      selected
                        ? "bg-ungrd-navy text-white shadow-sm"
                        : "border border-ungrd-border bg-ungrd-surface text-ungrd-heading hover:border-ungrd-navy/35"
                    }`}
                  >
                    {b.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {boards.length === 0 ? (
        <section className="flex min-h-[min(60vh,480px)] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ungrd-border bg-ungrd-surface px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ungrd-navy text-ungrd-yellow">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-base font-extrabold text-ungrd-heading">
              QuickBI pendiente de configurar
            </h3>
            <p className="text-sm text-ungrd-muted">
              Este tema aún no tiene tablero publicado en la relación SMD.
              Mientras tanto puede usar el Dashboard Operativo.
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-bold text-ungrd-muted">
            <BarChart3 className="h-3.5 w-3.5" />
            {theme.shortName}
          </div>
        </section>
      ) : (
        <>
          {active && (
            <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ungrd-navy/10 text-ungrd-navy">
                  <Maximize2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-ungrd-heading">
                    {active.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ungrd-muted">
                    {active.description}
                  </p>
                </div>
                {boards.length > 1 && (
                  <p className="shrink-0 text-xs font-bold text-ungrd-muted">
                    {activeIdx + 1} / {boards.length}
                  </p>
                )}
              </div>
            </section>
          )}

          {active && (
            <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface shadow-[0_12px_40px_rgba(0,45,90,0.06)]">
              <iframe
                key={active.url}
                title={`QuickBI — ${theme.name} — ${active.title}`}
                src={active.url}
                className="h-[min(82vh,860px)] w-full border-0 bg-ungrd-bg"
                allow="fullscreen"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </section>
          )}

          {boards.length > 1 && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {boards.map((b, i) => {
                const selected = i === activeIdx;
                return (
                  <button
                    key={`card-${b.title}-${i}`}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-ungrd-navy/40 bg-ungrd-navy/[0.06] shadow-sm"
                        : "border-ungrd-border bg-ungrd-surface hover:border-ungrd-navy/25"
                    }`}
                  >
                    <p className="text-sm font-extrabold text-ungrd-heading">
                      {b.title}
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ungrd-muted">
                      {b.description}
                    </p>
                  </button>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
