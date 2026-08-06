import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";
import { dbToRow } from "@/lib/records/db-to-row";
import { aguaCapaLookupVariants } from "@/themes/agua-y-saneamiento/capture-forms";

export type OrderLookupMatchKind = "unica" | "x_pago";

export type OrderLookupHit = {
  id: string;
  /** OP de negocio (clave / seguimiento). Siempre la OP única del alta. */
  orden_de_proveeduria: string;
  /** OP por pago cuando existe en el alta o se seleccionó esa variante. */
  orden_de_proveeduria_x_pago?: string;
  /** Texto mostrado en el autocomplete (única o x_pago). */
  display_op?: string;
  /** Variante seleccionable en Pagos. */
  match_kind?: OrderLookupMatchKind;
  proveedor: string;
  nit: string;
  departamento: string;
  municipio: string;
  objeto: string;
  valor: number | string;
  vigencia: string;
  tipo_de_orden: string;
  fecha: string;
  /** Payload completo del alta para heredar campos compartidos. */
  payload: RecordRow;
};

function opOf(r: RecordRow): string {
  return String(r.orden_de_proveeduria || r.clave_seguimiento || "").trim();
}

function paymentOpOf(r: RecordRow): string {
  return String(r.orden_de_proveeduria_x_pago || "").trim();
}

/** Valor de negocio: columna o payload (ValorOP / valorop de la maqueta). */
function resolveValor(r: RecordRow): number | string {
  const candidates = [
    r.valor,
    r.valorop,
    r.ValorOP,
    r.valor_op,
    r.valor_de_la_orden,
  ];
  for (const c of candidates) {
    if (c === undefined || c === null || c === "") continue;
    const n =
      typeof c === "number" ? c : Number(String(c).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && n !== 0) return n;
  }
  // Si todo es 0, devolver 0 explícito solo cuando existe alguno
  const first = candidates.find((c) => c !== undefined && c !== null && c !== "");
  return first ?? "";
}

function toHit(
  r: RecordRow,
  opts?: {
    matchKind?: OrderLookupMatchKind;
    displayOp?: string;
    paymentOp?: string;
  },
): OrderLookupHit {
  const main = opOf(r);
  const payment = (opts?.paymentOp ?? paymentOpOf(r)).trim();
  const matchKind = opts?.matchKind ?? "unica";
  const displayOp = (opts?.displayOp ?? (matchKind === "x_pago" ? payment : main)).trim() || main;
  return {
    id: String(r.id),
    orden_de_proveeduria: main,
    orden_de_proveeduria_x_pago: payment || undefined,
    display_op: displayOp,
    match_kind: matchKind,
    proveedor: String(r.proveedor || ""),
    nit: String(r.nit || ""),
    departamento: String(r.departamento || ""),
    municipio: String(r.municipio || ""),
    objeto: String(r.objeto || ""),
    valor: resolveValor(r),
    vigencia: String(r.vigencia || ""),
    tipo_de_orden: String(r.tipo_de_orden || ""),
    fecha: String(r.fecha || ""),
    payload: r,
  };
}

/** Una o dos filas de lookup por registro de alta (OP única + OP x pago). */
function expandHits(r: RecordRow, expandPaymentOps: boolean): OrderLookupHit[] {
  const main = opOf(r);
  if (!main) return [];
  const payment = paymentOpOf(r);
  const mainHit = toHit(r, {
    matchKind: "unica",
    displayOp: main,
    paymentOp: payment,
  });
  if (!expandPaymentOps) return [mainHit];
  if (!payment || payment.toLowerCase() === main.toLowerCase()) {
    return [mainHit];
  }
  return [
    mainHit,
    toHit(r, {
      matchKind: "x_pago",
      displayOp: payment,
      paymentOp: payment,
    }),
  ];
}

/** Capas equivalentes al buscar (legacy Excel ↔ canónica UI). */
function capaVariants(themeId: string, capa: string): string[] {
  if (themeId === "agua-y-saneamiento") {
    return aguaCapaLookupVariants(capa);
  }
  return [capa.trim()].filter(Boolean);
}

/**
 * Busca registros de una capa (p. ej. Alta / orden) por OP, proveedor, municipio u objeto.
 * En Agua también encuentra «Maqueta / orden» (nombre legacy de la base real).
 * Con `expandPaymentOps` (Pagos) incluye hits por `orden_de_proveeduria_x_pago`.
 */
export async function searchThemeOrders(params: {
  themeId: string;
  q: string;
  capa: string;
  limit?: number;
  expandPaymentOps?: boolean;
}): Promise<OrderLookupHit[]> {
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 40);
  const q = params.q.trim().toLowerCase();
  const variants = capaVariants(params.themeId, params.capa);
  if (!variants.length) return [];
  const expandPaymentOps = Boolean(params.expandPaymentOps);

  const capaFilter = sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;

  const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;
  const textFilter = like
    ? sql`(
        coalesce(${records.payload}->>'orden_de_proveeduria','') ILIKE ${like}
        OR coalesce(${records.payload}->>'clave_seguimiento','') ILIKE ${like}
        OR coalesce(${records.payload}->>'orden_de_proveeduria_x_pago','') ILIKE ${like}
        OR coalesce(${records.payload}->>'orden_de_proveeduria_segmentado','') ILIKE ${like}
        OR coalesce(${records.payload}->>'op2','') ILIKE ${like}
        OR coalesce(${records.payload}->>'proveedor','') ILIKE ${like}
        OR coalesce(${records.payload}->>'nit','') ILIKE ${like}
        OR coalesce(${records.payload}->>'objeto','') ILIKE ${like}
        OR coalesce(${records.payload}->>'vigencia','') ILIKE ${like}
        OR coalesce(${records.payload}->>'tipo_de_orden','') ILIKE ${like}
        OR ${records.departamento} ILIKE ${like}
        OR ${records.municipio} ILIKE ${like}
      )`
    : undefined;

  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, params.themeId),
        isNull(records.deletedAt),
        capaFilter,
        textFilter,
      ),
    )
    .orderBy(desc(records.createdAt))
    .limit(q ? 400 : Math.max(limit * 4, 60));

  let hits = rows
    .map(dbToRow)
    .flatMap((r) => expandHits(r, expandPaymentOps))
    .filter((h) => h.orden_de_proveeduria);

  // Preferir OPs reales sobre smoke/test en resultados recientes
  hits.sort((a, b) => {
    const score = (op: string) => (/^(SMOKE|TEST)-/i.test(op) ? 1 : 0);
    const displayA = a.display_op || a.orden_de_proveeduria;
    const displayB = b.display_op || b.orden_de_proveeduria;
    const smoke = score(displayA) - score(displayB);
    if (smoke !== 0) return smoke;
    // Preferir filas que ya traen OP x pago en el alta
    const payA = a.orden_de_proveeduria_x_pago ? 0 : 1;
    const payB = b.orden_de_proveeduria_x_pago ? 0 : 1;
    return payA - payB;
  });

  // Una fila por variante de OP mostrada (única / x_pago)
  const seen = new Set<string>();
  const unique: OrderLookupHit[] = [];
  for (const h of hits) {
    const display = (h.display_op || h.orden_de_proveeduria).toLowerCase();
    const kind = h.match_kind || "unica";
    const key = `${kind}:${display}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(h);
    if (unique.length >= limit) break;
  }
  return unique;
}

/**
 * Registro exacto de una capa para una OP (p. ej. Variables líder de GS-SMD-…).
 * Usado para precargar el formulario upsert y editar con trazabilidad.
 * También encuentra por `orden_de_proveeduria_x_pago` (la clave de negocio sigue siendo la OP única).
 */
export async function findThemeRecordByOpAndCapa(params: {
  themeId: string;
  op: string;
  capa: string;
}): Promise<OrderLookupHit | null> {
  const op = params.op.trim();
  if (!op) return null;
  const variants = capaVariants(params.themeId, params.capa);
  if (!variants.length) return null;

  const capaFilter = sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;

  const opFilter = sql`(
    lower(trim(coalesce(${records.payload}->>'orden_de_proveeduria',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'orden_de_proveeduria_x_pago',''))) = ${op.toLowerCase()}
  )`;

  const [row] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, params.themeId),
        isNull(records.deletedAt),
        capaFilter,
        opFilter,
      ),
    )
    .orderBy(desc(records.updatedAt), desc(records.createdAt))
    .limit(1);

  if (!row) return null;
  const record = dbToRow(row);
  const hit = toHit(record);
  const payment = paymentOpOf(record);
  // Si la búsqueda exacta coincidió con la OP x pago, marcar la variante.
  if (
    payment &&
    payment.toLowerCase() === op.toLowerCase() &&
    hit.orden_de_proveeduria.toLowerCase() !== op.toLowerCase()
  ) {
    return toHit(record, {
      matchKind: "x_pago",
      displayOp: payment,
      paymentOp: payment,
    });
  }
  return hit;
}

/**
 * Todas las filas de una OP en una capa (p. ej. historial de modificaciones).
 * Orden: más antiguas primero (createdAt ASC) para tablas append.
 * La clave es la OP de negocio; también incluye filas ligadas por OP x pago.
 */
export async function listThemeRecordsByOpAndCapa(params: {
  themeId: string;
  op: string;
  capa: string;
  limit?: number;
}): Promise<OrderLookupHit[]> {
  const op = params.op.trim();
  if (!op) return [];
  const variants = capaVariants(params.themeId, params.capa);
  if (!variants.length) return [];
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  const capaFilter = sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;

  const opFilter = sql`(
    lower(trim(coalesce(${records.payload}->>'orden_de_proveeduria',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'orden_de_proveeduria_x_pago',''))) = ${op.toLowerCase()}
  )`;

  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, params.themeId),
        isNull(records.deletedAt),
        capaFilter,
        opFilter,
      ),
    )
    .orderBy(asc(records.createdAt), asc(records.id))
    .limit(limit);

  return rows.map(dbToRow).map((r) => toHit(r));
}
