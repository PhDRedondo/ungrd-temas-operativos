"use client";

import { useEffect, useMemo, useState } from "react";
import { buildQuickBiEmbedUrl } from "@/lib/quickbi/build-embed-url";
import type { QuickBiDashboard, QuickBiParams } from "@/lib/quickbi/types";

type Props = {
  dashboard: QuickBiDashboard;
  /** Parámetros de consulta QuickBI (opcional). */
  params?: QuickBiParams;
  title?: string;
  className?: string;
  minHeightClassName?: string;
};

/**
 * Embed QuickBI (port React del componente SNI `quick-bi-embed`).
 * URL: token3rd + pageId + accessTicket.
 */
export function QuickBiEmbed({
  dashboard,
  params = {},
  title = "QuickBI Dashboard",
  className = "",
  minHeightClassName = "h-[min(82vh,860px)]",
}: Props) {
  const [loaded, setLoaded] = useState(false);

  const src = useMemo(
    () => buildQuickBiEmbedUrl(dashboard, params),
    [dashboard, params],
  );

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div
      className={`relative min-w-0 overflow-hidden bg-ungrd-bg ${minHeightClassName} ${className}`}
    >
      {!loaded && (
        <div
          className="absolute inset-0 z-[1] flex items-center justify-center gap-3 text-sm text-ungrd-muted"
          aria-live="polite"
        >
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-ungrd-border border-t-ungrd-navy"
            aria-hidden
          />
          Cargando tablero…
        </div>
      )}
      <iframe
        key={src}
        title={title}
        src={src}
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full border-0 bg-ungrd-bg"
        allow="fullscreen; clipboard-read; clipboard-write"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
