"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";
import {
  getQuickBiDashboards,
  metaFromEmbedUrl,
  type QuickBiDashboard as QuickBiDashboardMeta,
} from "@/lib/quickbi/catalog";
import { buildQuickBiEmbedUrl } from "@/lib/quickbi/build-embed-url";
import {
  getQuickBiDashboard,
  invalidateQuickBiTicket,
} from "@/lib/quickbi/token-service";
import type { QuickBiDashboard } from "@/lib/quickbi/types";
import { QuickBiEmbed } from "@/components/QuickBiEmbed";

type Props = {
  theme: ThemeConfig;
};

function resolveMetas(theme: ThemeConfig): QuickBiDashboardMeta[] {
  if (theme.quickBiDashboards?.length) {
    const fromTheme: QuickBiDashboardMeta[] = [];
    for (const b of theme.quickBiDashboards) {
      const meta = metaFromEmbedUrl(b.title, b.url, b.description);
      if (meta) fromTheme.push(meta);
    }
    if (fromTheme.length) return fromTheme;
  }
  const fromCatalog = getQuickBiDashboards(theme.id);
  if (fromCatalog.length) return fromCatalog;
  const legacy = theme.quickBiUrl?.trim();
  if (legacy) {
    const meta = metaFromEmbedUrl("Tablero Único", legacy);
    if (meta) return [meta];
  }
  return [];
}

export function QuickBIPanel({ theme }: Props) {
  const boards = useMemo(() => resolveMetas(theme), [theme]);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeMeta = boards[Math.min(activeIdx, Math.max(boards.length - 1, 0))];

  const [ticketBoard, setTicketBoard] = useState<QuickBiDashboard | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeMeta) {
      setTicketBoard(null);
      setTicketError(null);
      return;
    }

    let cancelled = false;
    setLoadingTicket(true);
    setTicketError(null);
    setTicketBoard(null);

    // Equivalente a QuickBiTokenService.getDashboard(key) en SNI.
    if (reloadKey > 0) {
      invalidateQuickBiTicket(activeMeta.pageId);
    }
    getQuickBiDashboard(activeMeta)
      .then((result) => {
        if (cancelled) return;
        setTicketBoard(result.dashboard);
        // fallback silencioso: el tablero puede cargar igual con ticket de catálogo
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (activeMeta.accessTicket) {
          setTicketBoard({
            ...activeMeta,
            accessTicket: activeMeta.accessTicket,
          });
          setTicketError(null);
          return;
        }
        setTicketError(
          err instanceof Error ? err.message : "No se pudo obtener el ticket",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingTicket(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMeta, reloadKey]);

  const openUrl = ticketBoard
    ? buildQuickBiEmbedUrl(ticketBoard)
    : activeMeta
      ? buildQuickBiEmbedUrl({
          pageId: activeMeta.pageId,
          accessTicket: activeMeta.accessTicket || "",
          host: activeMeta.host,
        })
      : undefined;

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
                Tableros ejecutivos embebidos con ticket dinámico. Elija una
                vista; cada una resume un ángulo distinto de la operación.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-extrabold text-white backdrop-blur transition hover:bg-white/20"
                title="Renovar ticket y recargar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Renovar
              </button>
              {openUrl && (
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-extrabold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Abrir en QuickBI
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
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
                    key={b.id}
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
          {activeMeta && (
            <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ungrd-navy/10 text-ungrd-navy">
                  <Maximize2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-ungrd-heading">
                    {activeMeta.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ungrd-muted">
                    {activeMeta.description}
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

          <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface shadow-[0_12px_40px_rgba(0,45,90,0.06)]">
            {loadingTicket && (
              <div className="flex h-[min(82vh,860px)] flex-col items-center justify-center gap-3 text-sm text-ungrd-muted">
                <Loader2 className="h-6 w-6 animate-spin text-ungrd-navy" />
                Solicitando accessTicket…
              </div>
            )}
            {!loadingTicket && ticketError && (
              <div className="flex h-[min(40vh,360px)] flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
                <p className="max-w-md text-sm font-bold text-ungrd-heading">
                  No se pudo embeber el tablero
                </p>
                <p className="max-w-md text-sm text-ungrd-muted">{ticketError}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-ungrd-navy px-4 py-2 text-xs font-extrabold text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reintentar
                </button>
              </div>
            )}
            {!loadingTicket && !ticketError && ticketBoard && (
              <QuickBiEmbed
                dashboard={ticketBoard}
                title={`QuickBI — ${theme.name} — ${ticketBoard.title}`}
              />
            )}
          </section>

          {boards.length > 1 && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {boards.map((b, i) => {
                const selected = i === activeIdx;
                return (
                  <button
                    key={`card-${b.id}`}
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
