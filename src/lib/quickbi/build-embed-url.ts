import type { QuickBiDashboard, QuickBiParamValue, QuickBiParams } from "./types";

const DEFAULT_HOST = "bi-us-east-1.alibabacloud.com";

export function serializeQuickBiParam(value: QuickBiParamValue): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.length ? value.join(",") : null;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/**
 * URL de embed al estilo SNI:
 * `https://{host}/token3rd/dashboard/view/{client}.htm?pageId=…&accessTicket=…`
 * Sin ticket: `…/dashboard/view/…` (solo si el tablero es público).
 */
export function buildQuickBiEmbedUrl(
  dashboard: Pick<QuickBiDashboard, "pageId" | "accessTicket" | "host" | "client"> & {
    accessTicket?: string;
  },
  params: QuickBiParams = {},
): string {
  const host = (dashboard.host || DEFAULT_HOST).replace(/^https?:\/\//, "");
  const client = dashboard.client ?? "pc";
  const hasTicket = Boolean(dashboard.accessTicket?.trim());
  const path = hasTicket ? "token3rd/dashboard/view" : "dashboard/view";
  const url = new URL(`https://${host}/${path}/${client}.htm`);
  url.searchParams.set("pageId", dashboard.pageId);
  if (hasTicket) {
    url.searchParams.set("accessTicket", dashboard.accessTicket!.trim());
  }
  url.searchParams.set("dd_orientation", "auto");
  for (const [k, v] of Object.entries(params)) {
    const serialized = serializeQuickBiParam(v);
    if (serialized !== null) url.searchParams.set(k, serialized);
  }
  return url.toString();
}

/** Extrae pageId / accessTicket / host de una URL QuickBI pegada. */
export function parseQuickBiUrl(raw: string): {
  pageId: string;
  accessTicket?: string;
  host: string;
} | null {
  try {
    const url = new URL(raw.trim());
    const pageId = url.searchParams.get("pageId")?.trim();
    if (!pageId) return null;
    const accessTicket = url.searchParams.get("accessTicket")?.trim() || undefined;
    return { pageId, accessTicket, host: url.host };
  } catch {
    return null;
  }
}
