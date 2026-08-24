import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  findCatalogBoardByPageId,
  getKnownQuickBiPageIds,
} from "@/lib/quickbi/catalog";
import {
  getQuickBiHost,
  getQuickBiTicket,
  hasQuickBiCredentials,
  TicketUpstreamError,
} from "@/lib/quickbi/client";
import type { EmbedUrlResponse } from "@/lib/quickbi/types";

export const runtime = "nodejs";

type Body = {
  pageId?: string;
  globalParam?: unknown;
};

/**
 * BFF QuickBI (equivalente al backend SNI desde el punto de vista del React).
 *
 * Orden de resolución del ticket:
 * 1. `QUICKBI_UPSTREAM_BASE_URL` → proxy al backend SNI ya publicado
 *    (ej. https://apisni.soft180.co) — mismos AccessKey allí.
 * 2. CreateTicket local con `QUICKBI_ACCESS_KEY_*`.
 * 3. Ticket estático del catálogo (fallback).
 *
 * Contrato idéntico a SNI: POST { pageId } → { pageId, accessTicket, expiresAt, host }
 */
export async function POST(req: Request) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido", code: "bad_json" },
      { status: 400 },
    );
  }

  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  if (!pageId) {
    return NextResponse.json(
      { error: "pageId es obligatorio", code: "missing_page_id" },
      { status: 400 },
    );
  }

  const known = getKnownQuickBiPageIds();
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pageId,
    );
  if (!known.has(pageId) && !uuidLike) {
    return NextResponse.json(
      { error: "pageId no autorizado en este aplicativo", code: "unknown_page" },
      { status: 403 },
    );
  }

  const catalog = findCatalogBoardByPageId(pageId);
  const host = catalog?.host || getQuickBiHost();
  const upstreamBase = process.env.QUICKBI_UPSTREAM_BASE_URL?.trim().replace(
    /\/$/,
    "",
  );

  // 1) Proxy al backend SNI publicado (mismo contrato /api/quickbi/embed-url).
  if (upstreamBase) {
    try {
      const upstreamBody: Record<string, unknown> = { pageId };
      if (body.globalParam !== undefined) {
        upstreamBody.globalParam = body.globalParam;
      }
      const up = await fetch(`${upstreamBase}/api/quickbi/embed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(upstreamBody),
        cache: "no-store",
      });
      const raw = (await up.json().catch(() => ({}))) as EmbedUrlResponse & {
        error?: string;
        detail?: { error?: string } | string;
      };
      if (up.ok && raw.accessTicket) {
        const payload: EmbedUrlResponse = {
          pageId: raw.pageId || pageId,
          accessTicket: raw.accessTicket,
          expiresAt: raw.expiresAt || new Date(Date.now() + 3_600_000).toISOString(),
          host: raw.host || host,
        };
        return NextResponse.json(payload, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      console.warn("[quickbi] upstream falló", {
        status: up.status,
        error: raw.error || raw.detail,
      });
      // Si el upstream falla, seguir con CreateTicket / fallback.
    } catch (err) {
      console.warn("[quickbi] upstream unreachable", err);
    }
  }

  // 2) CreateTicket local (AccessKey en este proyecto).
  if (hasQuickBiCredentials()) {
    try {
      let globalParamJson: string | null = null;
      if (typeof body.globalParam === "string" && body.globalParam.trim()) {
        globalParamJson = body.globalParam.trim();
      } else if (Array.isArray(body.globalParam) && body.globalParam.length) {
        globalParamJson = JSON.stringify(body.globalParam);
      }

      const issued = await getQuickBiTicket(pageId, globalParamJson);
      const payload: EmbedUrlResponse = {
        pageId,
        accessTicket: issued.ticket,
        expiresAt: issued.expiresAt.toISOString(),
        host,
      };
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      if (err instanceof TicketUpstreamError) {
        if (catalog?.accessTicket) {
          return NextResponse.json(
            {
              pageId,
              accessTicket: catalog.accessTicket,
              expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
              host,
              fallback: true,
            } satisfies EmbedUrlResponse,
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        }
        return NextResponse.json(
          { error: err.message, code: "quickbi_upstream" },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
      console.error("[quickbi/embed-url]", err);
      return NextResponse.json(
        { error: "Error interno QuickBI", code: "quickbi_internal" },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // 3) Ticket estático del catálogo.
  if (catalog?.accessTicket) {
    return NextResponse.json(
      {
        pageId,
        accessTicket: catalog.accessTicket,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        host,
        fallback: true,
      } satisfies EmbedUrlResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      error:
        "QuickBI no configurado: defina QUICKBI_UPSTREAM_BASE_URL (backend SNI), o QUICKBI_ACCESS_KEY_ID/SECRET, o un accessTicket en el catálogo.",
      code: "quickbi_not_configured",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
