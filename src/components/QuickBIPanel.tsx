"use client";

import { BarChart3, ExternalLink, LayoutDashboard } from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";

type Props = {
  theme: ThemeConfig;
};

export function QuickBIPanel({ theme }: Props) {
  const embedUrl = theme.quickBiUrl?.trim() || "";

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-5" id="vista-quickbi">
      <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] text-ungrd-navy uppercase">
              QuickBI
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-ungrd-heading sm:text-xl">
              Tablero ejecutivo — {theme.name}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ungrd-muted">
              Espacio para el tablero Quick BI del tema (Alibaba Cloud). Cuando
              haya una URL de publicación o embed, el informe se muestra aquí
              embebido a pantalla completa del panel.
            </p>
          </div>
          {embedUrl && (
            <a
              href={embedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-ungrd-border bg-ungrd-bg px-3 py-2 text-xs font-extrabold text-ungrd-heading transition hover:border-ungrd-navy/30"
            >
              Abrir en Quick BI
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </section>

      {embedUrl ? (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface">
          <iframe
            title={`QuickBI — ${theme.name}`}
            src={embedUrl}
            className="h-[min(78vh,720px)] w-full border-0 bg-ungrd-bg"
            allow="fullscreen"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>
      ) : (
        <section className="flex min-h-[min(60vh,480px)] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ungrd-border bg-ungrd-surface px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ungrd-navy text-ungrd-yellow">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-base font-extrabold text-ungrd-heading">
              Tablero Quick BI pendiente de configurar
            </h3>
            <p className="text-sm text-ungrd-muted">
              Defina <code className="text-xs font-bold">quickBiUrl</code> en la
              configuración del tema para incrustar el informe publicado de
              Quick BI.
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-bold text-ungrd-muted">
            <BarChart3 className="h-3.5 w-3.5" />
            {theme.shortName} · embed no asignado
          </div>
        </section>
      )}
    </div>
  );
}
