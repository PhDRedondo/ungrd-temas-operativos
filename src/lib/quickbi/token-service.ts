/**
 * Equivalente React del `QuickBiTokenService` de SNI (Angular).
 *
 * Flujo:
 *   QuickBIPanel / QuickBiEmbed
 *     → getQuickBiDashboard(meta)
 *     → POST /api/quickbi/embed-url  (mismo origen, BFF Next.js)
 *     → CreateTicket local O proxy al backend SNI publicado
 *
 * Cachea por pageId mientras la pestaña viva; `invalidateQuickBiTicket` fuerza renovación.
 */

"use client";

import type { EmbedUrlResponse, QuickBiDashboard } from "./types";
import type { QuickBiDashboard as QuickBiDashboardMeta } from "./catalog";

export type QuickBiTicketResult = {
  dashboard: QuickBiDashboard;
  fallback: boolean;
};

type CacheEntry = {
  promise: Promise<QuickBiTicketResult>;
  expiresAtMs: number;
};

const cache = new Map<string, CacheEntry>();

/** Renueva ~2 min antes de expiresAt del ticket (o a los 30 min si no hay fecha). */
const SAFETY_MS = 2 * 60_000;
const DEFAULT_TTL_MS = 30 * 60_000;

export function invalidateQuickBiTicket(pageId: string): void {
  cache.delete(pageId);
}

export function invalidateAllQuickBiTickets(): void {
  cache.clear();
}

/**
 * Pide un descriptor embebible (pageId + accessTicket + host),
 * igual que `QuickBiTokenService.getDashboard` en SNI.
 */
export function getQuickBiDashboard(
  meta: QuickBiDashboardMeta,
): Promise<QuickBiTicketResult> {
  const pageId = meta.pageId;
  const now = Date.now();
  const hit = cache.get(pageId);
  if (hit && hit.expiresAtMs > now) {
    return hit.promise;
  }

  const promise = fetchTicket(pageId)
    .then((r) => {
      const result: QuickBiTicketResult = {
        dashboard: {
          ...meta,
          accessTicket: r.accessTicket,
          host: r.host || meta.host,
        },
        fallback: Boolean(r.fallback),
      };
      const exp = Date.parse(r.expiresAt);
      const expiresAtMs = Number.isFinite(exp)
        ? exp - SAFETY_MS
        : now + DEFAULT_TTL_MS;
      cache.set(pageId, { promise: Promise.resolve(result), expiresAtMs });
      return result;
    })
    .catch((err) => {
      cache.delete(pageId);
      throw err;
    });

  cache.set(pageId, { promise, expiresAtMs: now + DEFAULT_TTL_MS });
  return promise;
}

async function fetchTicket(pageId: string): Promise<EmbedUrlResponse> {
  const res = await fetch("/api/quickbi/embed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId }),
  });
  const data = (await res.json().catch(() => ({}))) as EmbedUrlResponse & {
    error?: string;
    detail?: { error?: string } | string;
  };
  if (!res.ok) {
    const detail =
      typeof data.detail === "object" && data.detail?.error
        ? data.detail.error
        : typeof data.detail === "string"
          ? data.detail
          : data.error;
    throw new Error(detail || `Error ${res.status} al pedir ticket QuickBI`);
  }
  if (!data.accessTicket) {
    throw new Error("La API no devolvió accessTicket");
  }
  return data;
}
