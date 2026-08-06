import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeRead } from "@/lib/auth/session";
import {
  findThemeRecordByOpAndCapa,
  listThemeRecordsByOpAndCapa,
  searchThemeOrders,
} from "@/lib/records/order-lookup";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Busca órdenes del alta (u otra capa) por OP / proveedor / municipio / objeto.
 * Usado en formularios posteriores para no reescribir datos del registro inicial.
 *
 * Query:
 *  - q + capa → búsqueda parcial (lookup)
 *  - op + capa → registro exacto de esa capa (precarga upsert / edición)
 *  - op + capa + all=1 → todas las filas de esa OP+capa (historial append)
 */
export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const exactOp = (url.searchParams.get("op") || "").trim();
  const listAll = url.searchParams.get("all") === "1";
  const expandPaymentOps =
    url.searchParams.get("expandPaymentOps") === "1" ||
    url.searchParams.get("expand_payment_ops") === "1";
  const capa =
    url.searchParams.get("capa") ||
    theme.captureForms?.find((f) => f.mode === "create-once")?.capa ||
    "Alta / orden";
  const limit = Math.min(
    40,
    Math.max(1, Number(url.searchParams.get("limit") || 15) || 15),
  );

  if (exactOp) {
    if (listAll) {
      const hits = await listThemeRecordsByOpAndCapa({
        themeId: theme.id,
        op: exactOp,
        capa,
        limit: 300,
      });
      return NextResponse.json({
        themeId: theme.id,
        capa,
        op: exactOp,
        exact: true,
        all: true,
        found: hits.length > 0,
        count: hits.length,
        orders: hits,
      });
    }
    const hit = await findThemeRecordByOpAndCapa({
      themeId: theme.id,
      op: exactOp,
      capa,
    });
    return NextResponse.json({
      themeId: theme.id,
      capa,
      op: exactOp,
      exact: true,
      found: Boolean(hit),
      count: hit ? 1 : 0,
      orders: hit ? [hit] : [],
    });
  }

  const orders = await searchThemeOrders({
    themeId: theme.id,
    q,
    capa,
    limit,
    expandPaymentOps,
  });

  return NextResponse.json({
    themeId: theme.id,
    capa,
    q,
    expandPaymentOps,
    count: orders.length,
    orders,
  });
}
