import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";
import { dbToRow } from "@/lib/records/db-to-row";
import { aguaCapaLookupVariants } from "@/themes/agua-y-saneamiento/capture-forms";
import { bmaqCapaLookupVariants } from "@/themes/banco-de-maquinaria/capture-forms";
import { carroCapaLookupVariants } from "@/themes/carrotanques/capture-forms";

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
  return String(
    r.orden_de_proveeduria ||
      r.clave_seguimiento ||
      r.placa ||
      r.serial ||
      r.no_convenio ||
      "",
  ).trim();
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
  if (themeId === "carrotanques") {
    return carroCapaLookupVariants(capa);
  }
  if (themeId === "banco-de-maquinaria") {
    return bmaqCapaLookupVariants(capa);
  }
  return [capa.trim()].filter(Boolean);
}

/**
 * Detalle maquinaria: filtrar por Nº orden de compra o contrato/convenio.
 * La lista sale de DETALLE (claves reales); se enriquece con fila Convenio si existe.
 */
function isRealBmaqContratoKey(raw: string): boolean {
  const t = String(raw || "").trim();
  if (!t) return false;
  // Basura del Excel CONVENIOS: códigos 1..46 = departamentos
  if (/^\d{1,3}$/.test(t)) return false;
  if (/^(sin registro|sin municipio|n\/?a|-|—)$/i.test(t)) return false;
  return true;
}

async function searchBmaqContratoOOrden(params: {
  q: string;
  limit?: number;
}): Promise<OrderLookupHit[]> {
  const THEME_ID = "banco-de-maquinaria";
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 40);
  const q = params.q.trim();
  const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;

  const convenioVariants = bmaqCapaLookupVariants("Convenio o proceso");
  const detalleVariants = bmaqCapaLookupVariants("Maqueta / inventario");
  const allVariants = [...new Set([...convenioVariants, ...detalleVariants])];

  const capaFilter = sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      allVariants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      allVariants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;

  // Buscar por convenio / OC / empresa del DETALLE (no por catálogo de departamentos).
  const textFilter = like
    ? sql`(
        coalesce(${records.payload}->>'no_convenio','') ILIKE ${like}
        OR coalesce(${records.payload}->>'clave_seguimiento','') ILIKE ${like}
        OR coalesce(${records.payload}->>'no_orden_de_compra','') ILIKE ${like}
        OR coalesce(${records.payload}->>'objeto','') ILIKE ${like}
        OR coalesce(${records.payload}->>'entidad_receptora','') ILIKE ${like}
        OR coalesce(${records.payload}->>'empresa','') ILIKE ${like}
        OR coalesce(${records.payload}->>'referencia','') ILIKE ${like}
      )`
    : undefined;

  const fetchLimit = q ? 500 : 2500;
  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter,
        textFilter,
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(fetchLimit);

  const mapped = rows.map(dbToRow);

  const isConvenioCapa = (r: RecordRow) => {
    const capa = String(r.tipo_registro || r.capa || "").trim().toLowerCase();
    return convenioVariants.some((v) => v.toLowerCase() === capa);
  };
  const isDetalleCapa = (r: RecordRow) => {
    const capa = String(r.tipo_registro || r.capa || "").trim().toLowerCase();
    return detalleVariants.some((v) => v.toLowerCase() === capa);
  };

  const pick = (...vals: unknown[]) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s && !/^(sin registro|sin municipio|n\/?a|-|—)$/i.test(s)) return s;
    }
    return "";
  };

  type Ctx = {
    no_convenio: string;
    no_orden_de_compra: string;
    empresa: string;
    entidad_receptora: string;
    departamento: string;
    municipio: string;
    tipo_maquinaria: string;
    modalidad: string;
    estado_maquina: string;
    estado_convenio: string;
    referencia: string;
    equipos: number;
  };

  const emptyCtx = (): Ctx => ({
    no_convenio: "",
    no_orden_de_compra: "",
    empresa: "",
    entidad_receptora: "",
    departamento: "",
    municipio: "",
    tipo_maquinaria: "",
    modalidad: "",
    estado_maquina: "",
    estado_convenio: "",
    referencia: "",
    equipos: 0,
  });

  const mergeCtx = (into: Ctx, r: RecordRow) => {
    into.no_convenio = pick(into.no_convenio, r.no_convenio);
    into.no_orden_de_compra = pick(into.no_orden_de_compra, r.no_orden_de_compra);
    into.empresa = pick(into.empresa, r.empresa);
    into.entidad_receptora = pick(into.entidad_receptora, r.entidad_receptora);
    into.departamento = pick(into.departamento, r.departamento);
    into.municipio = pick(into.municipio, r.municipio);
    into.tipo_maquinaria = pick(into.tipo_maquinaria, r.tipo_maquinaria);
    into.modalidad = pick(into.modalidad, r.modalidad);
    into.estado_maquina = pick(into.estado_maquina, r.estado_maquina);
    into.estado_convenio = pick(into.estado_convenio, r.estado_convenio);
    into.referencia = pick(into.referencia, r.referencia);
    into.equipos += 1;
  };

  const convenioByKey = new Map<string, RecordRow>();
  const detalleByConvenio = new Map<string, Ctx>();
  const detalleByOc = new Map<string, Ctx>();

  for (const r of mapped) {
    if (isConvenioCapa(r)) {
      const key = pick(r.no_convenio, r.clave_seguimiento);
      if (!isRealBmaqContratoKey(key)) continue;
      const k = key.toLowerCase();
      if (!convenioByKey.has(k)) convenioByKey.set(k, r);
      continue;
    }
    if (!isDetalleCapa(r)) continue;
    const convenio = pick(r.no_convenio);
    const oc = pick(r.no_orden_de_compra);
    if (isRealBmaqContratoKey(convenio)) {
      const k = convenio.toLowerCase();
      const ctx = detalleByConvenio.get(k) || emptyCtx();
      mergeCtx(ctx, r);
      detalleByConvenio.set(k, ctx);
    }
    if (isRealBmaqContratoKey(oc)) {
      const k = oc.toLowerCase();
      const ctx = detalleByOc.get(k) || emptyCtx();
      mergeCtx(ctx, r);
      detalleByOc.set(k, ctx);
    }
  }

  const buildRow = (
    convenioRow: RecordRow | undefined,
    ctx: Ctx,
    convenioKey: string,
    ocKey: string,
  ): RecordRow => {
    const estado = pick(convenioRow?.estado, ctx.estado_convenio);
    const expectativa = pick(
      convenioRow?.cantidad_maquinaria_expectativa,
      convenioRow?.cantidad_maquinaria_espectativa,
    );
    const entregada = pick(convenioRow?.cantidad_maquinaria_entregada);
    return {
      ...(convenioRow || {}),
      no_convenio: pick(convenioKey, convenioRow?.no_convenio, ctx.no_convenio),
      no_orden_de_compra: pick(
        ocKey,
        convenioRow?.no_orden_de_compra,
        ctx.no_orden_de_compra,
      ),
      // Solo datos reales: convenio si existe; si no, no inventar marco.
      empresa: pick(convenioRow?.empresa, ctx.empresa),
      entidad_receptora: pick(convenioRow?.entidad_receptora),
      departamento: pick(convenioRow?.departamento),
      municipio: pick(convenioRow?.municipio),
      tipo_maquinaria: "",
      modalidad: pick(convenioRow?.modalidad),
      estado_maquina: ctx.estado_maquina,
      estado_convenio: pick(convenioRow?.estado, ctx.estado_convenio),
      estado,
      referencia: "",
      objeto: pick(convenioRow?.objeto),
      cantidad_maquinaria_expectativa: expectativa,
      cantidad_maquinaria_entregada: entregada,
      equipos_en_clave: ctx.equipos,
      _from_convenio: convenioRow ? "1" : "",
      _lista_empresa: ctx.empresa,
      _lista_ubicacion: pick(ctx.municipio, ctx.departamento),
    } as RecordRow;
  };

  type Cand = {
    key: string;
    display: string;
    row: RecordRow;
    kind: "convenio" | "oc";
  };
  const cands: Cand[] = [];
  const seen = new Set<string>();

  // 1) Claves desde DETALLE (fuente del filtro)
  for (const [k, ctx] of detalleByConvenio) {
    const convenio = pick(ctx.no_convenio) || k;
    if (!isRealBmaqContratoKey(convenio)) continue;
    const sk = `c:${convenio.toLowerCase()}`;
    if (seen.has(sk)) continue;
    seen.add(sk);
    const convenioRow = convenioByKey.get(convenio.toLowerCase());
    cands.push({
      key: convenio,
      display: convenio,
      kind: "convenio",
      row: buildRow(convenioRow, ctx, convenio, ctx.no_orden_de_compra),
    });
  }
  for (const [k, ctx] of detalleByOc) {
    const oc = pick(ctx.no_orden_de_compra) || k;
    if (!isRealBmaqContratoKey(oc)) continue;
    const sk = `oc:${oc.toLowerCase()}`;
    if (seen.has(sk)) continue;
    seen.add(sk);
    const convenioKey = pick(ctx.no_convenio);
    const convenioRow = convenioKey
      ? convenioByKey.get(convenioKey.toLowerCase())
      : undefined;
    cands.push({
      key: convenioKey || oc,
      display: convenioKey ? `OC ${oc} · ${convenioKey}` : `OC ${oc}`,
      kind: "oc",
      row: buildRow(convenioRow, ctx, convenioKey, oc),
    });
  }

  // 2) Convenios reales sin detalle aún (p. ej. recién dados de alta)
  for (const [k, r] of convenioByKey) {
    if (!isRealBmaqContratoKey(k)) continue;
    const sk = `c:${k}`;
    if (seen.has(sk)) continue;
    seen.add(sk);
    const convenio = pick(r.no_convenio, r.clave_seguimiento) || k;
    cands.push({
      key: convenio,
      display: convenio,
      kind: "convenio",
      row: buildRow(r, emptyCtx(), convenio, ""),
    });
  }

  cands.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "convenio" ? -1 : 1;
    return a.display.localeCompare(b.display, "es");
  });

  const out: OrderLookupHit[] = [];
  for (const c of cands.slice(0, limit)) {
    const hit = toHit(c.row, { displayOp: c.display });
    hit.orden_de_proveeduria = c.key;
    hit.display_op = c.display;
    // Geo del convenio (para heredar en bitácora). El listado usa _lista_ubicacion.
    hit.departamento = String(c.row.departamento || "");
    hit.municipio = String(c.row.municipio || "");
    hit.objeto = String(c.row.objeto || "");
    out.push(hit);
  }
  return out;
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
  /** Banco Detalle: buscar por orden de compra o contrato de adquisición. */
  lookupBy?: "orden" | "placa" | "serial" | "convenio" | "contrato";
}): Promise<OrderLookupHit[]> {
  if (
    params.themeId === "banco-de-maquinaria" &&
    (params.lookupBy === "contrato" || params.lookupBy === "convenio")
  ) {
    return searchBmaqContratoOOrden({
      q: params.q,
      limit: params.limit,
    });
  }

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
        OR coalesce(${records.payload}->>'placa','') ILIKE ${like}
        OR coalesce(${records.payload}->>'placa_ungrd','') ILIKE ${like}
        OR coalesce(${records.payload}->>'orden_de_proveeduria_x_pago','') ILIKE ${like}
        OR coalesce(${records.payload}->>'orden_de_proveeduria_segmentado','') ILIKE ${like}
        OR coalesce(${records.payload}->>'op2','') ILIKE ${like}
        OR coalesce(${records.payload}->>'proveedor','') ILIKE ${like}
        OR coalesce(${records.payload}->>'nit','') ILIKE ${like}
        OR coalesce(${records.payload}->>'objeto','') ILIKE ${like}
        OR coalesce(${records.payload}->>'vigencia','') ILIKE ${like}
        OR coalesce(${records.payload}->>'tipo_de_orden','') ILIKE ${like}
        OR coalesce(${records.payload}->>'marca','') ILIKE ${like}
        OR coalesce(${records.payload}->>'serial','') ILIKE ${like}
        OR coalesce(${records.payload}->>'no_convenio','') ILIKE ${like}
        OR coalesce(${records.payload}->>'no_orden_de_compra','') ILIKE ${like}
        OR coalesce(${records.payload}->>'no_maquina','') ILIKE ${like}
        OR coalesce(${records.payload}->>'referencia','') ILIKE ${like}
        OR coalesce(${records.payload}->>'empresa','') ILIKE ${like}
        OR coalesce(${records.payload}->>'entidad_receptora','') ILIKE ${like}
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
    OR lower(trim(coalesce(${records.payload}->>'placa',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'serial',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'no_convenio',''))) = ${op.toLowerCase()}
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
    OR lower(trim(coalesce(${records.payload}->>'placa',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'serial',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'no_convenio',''))) = ${op.toLowerCase()}
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
