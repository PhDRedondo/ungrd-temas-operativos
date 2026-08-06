import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";
import { dbToRow } from "@/lib/records/db-to-row";
import {
  normalizePuenteCapa,
  puenteCapaLookupVariants,
} from "@/themes/puentes/capture-forms";
import {
  applyProcesoKeys,
  normalizeClaveProceso,
} from "@/themes/puentes/process-keys";
import {
  ORIGEN_LABELS,
  expandSearchAliases,
  inferOrigenAdquisicion,
  procesoSigla,
  type OrigenAdquisicion,
} from "@/themes/puentes/asset-keys";

const THEME_ID = "puentes";

export type PuenteLookupHit = {
  id: string;
  id_puente: string;
  clase: string;
  tipo: string;
  configuracion: string;
  ubicacion_actual: string;
  contrato_convenio: string;
  /** Etiqueta Excel «convenio o cto» (filtro de bitácora). */
  convenio_o_cto: string;
  tipo_vinculo: string;
  clave_proceso: string;
  departamento: string;
  municipio: string;
  region: string;
  estado_puente: string;
  situacion_prestamo: string;
  entidad_receptora: string;
  valor: number | string;
  latitud: number | string;
  longitud: number | string;
  /** Llaves derivadas: alias legible del activo dentro de su proceso. */
  codigo_operativo: string;
  proceso_sigla: string;
  origen_adquisicion: string;
  numero_unidad: number | string;
  longitud_m: number | string;
  payload: RecordRow;
  /** Puentes en el mismo contrato (informativo). */
  puentes_en_proceso?: number;
  /** Eventos de bitácora registrados para este puente. */
  eventos_bitacora?: number;
};

export type PuenteFacetOption = {
  value: string;
  label: string;
  count: number;
  /** Texto completo (p. ej. contrato legal sin truncar) para tooltip. */
  title?: string;
};

export type PuenteFilterFacets = {
  /** Nivel 0 (raíz): proceso; value = clave_proceso, label = sigla + contrato. */
  procesos: PuenteFacetOption[];
  /** Nivel 0: Convenio o CTO (Excel bitácora) → value = etiqueta visible. */
  convenios: PuenteFacetOption[];
  /** Nivel 0 (raíz), variante textual: contrato_convenio literal. */
  contratos: PuenteFacetOption[];
  /** Nivel 1: origen de adquisición dentro del contrato elegido. */
  origenes: PuenteFacetOption[];
  tipos: PuenteFacetOption[];
  configuraciones: PuenteFacetOption[];
  ubicaciones: PuenteFacetOption[];
  /** Puentes en inventario que cumplen todos los filtros activos. */
  matching: number;
  /** Total de puentes en inventario (sin filtros). */
  total: number;
};

export type PuenteSearchFilters = {
  origen?: string;
  proceso?: string;
  /** Convenio o CTO (etiqueta Excel / inventario). */
  convenio?: string;
  departamento?: string;
  municipio?: string;
  tipo?: string;
  configuracion?: string;
  ubicacion?: string;
  contrato?: string;
};

export type ProcesoLookupHit = {
  id: string;
  contrato_convenio: string;
  clave_proceso: string;
  tipo_vinculo: string;
  valor: number | string;
  vigencia: string;
  /** Texto legal largo del proceso (columna «comentarios» del Excel). */
  descripcion_proceso?: string;
  payload: RecordRow;
  puentes_vinculados?: number;
  /** Etapas registradas en la capa Estructuración. */
  etapas_registradas?: number;
  /** true si el proceso existe en la capa Estructuración (no solo referenciado). */
  estructurado?: boolean;
};

function idPuenteOf(r: RecordRow): string {
  return String(
    r.id_puente || r.id_legacy || r.clave_seguimiento || "",
  ).trim();
}

function toPuenteHit(r: RecordRow, extras?: Partial<PuenteLookupHit>): PuenteLookupHit {
  const idp = idPuenteOf(r);
  const contrato = String(r.contrato_convenio || r.contrato || "").trim();
  const convenio = String(r.convenio_o_cto || contrato).trim();
  const proc = applyProcesoKeys({ contrato_convenio: contrato, tipo_vinculo: r.tipo_vinculo });
  return {
    id: String(r.id),
    id_puente: idp,
    clase: String(r.clase || ""),
    tipo: String(r.tipo || ""),
    configuracion: String(r.configuracion || r.segun_configuracion || ""),
    ubicacion_actual: String(r.ubicacion_actual || r.lugar || ""),
    contrato_convenio: contrato,
    convenio_o_cto: convenio,
    tipo_vinculo: String(proc.tipo_vinculo || ""),
    clave_proceso: String(proc.clave_proceso || ""),
    departamento: String(r.departamento || ""),
    municipio: String(r.municipio || ""),
    region: String(r.region || ""),
    estado_puente: String(r.estado_puente || r.estado || ""),
    situacion_prestamo: String(r.situacion_prestamo || ""),
    entidad_receptora: String(r.entidad_receptora || r.entidad || ""),
    valor: r.valor ?? "",
    latitud: r.latitud ?? "",
    longitud: r.longitud ?? "",
    codigo_operativo: String(r.codigo_operativo || ""),
    proceso_sigla: String(r.proceso_sigla || procesoSigla(contrato)),
    origen_adquisicion: String(
      r.origen_adquisicion || inferOrigenAdquisicion(contrato),
    ),
    numero_unidad: r.numero_unidad ?? "",
    longitud_m: r.longitud_m ?? r.longitud_puente ?? "",
    payload: r,
    ...extras,
  };
}

function eqNorm(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function truncateLabel(value: string, max = 72): string {
  const v = value.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

/**
 * Jerarquía de filtrado. El contrato/proceso es la raíz: el resto de filtros
 * opera siempre sobre el subconjunto que ya quedó acotado por él.
 * Un nivel solo se restringe por los niveles superiores, nunca por los de abajo
 * (esos se reinician en la UI al cambiar un nivel superior).
 */
const FACET_LEVEL: Record<keyof PuenteSearchFilters, number> = {
  proceso: 0,
  contrato: 0,
  convenio: 0,
  origen: 1,
  departamento: 2,
  municipio: 3,
  tipo: 4,
  configuracion: 5,
  ubicacion: 6,
};

const FACET_LEVEL_ALL = 99;

function hitConvenioLabel(hit: PuenteLookupHit): string {
  return (hit.convenio_o_cto || hit.contrato_convenio || "").trim();
}

function matchesFilter(
  hit: PuenteLookupHit,
  key: keyof PuenteSearchFilters,
  value: string,
): boolean {
  switch (key) {
    case "proceso":
      return eqNorm(hit.clave_proceso, value);
    case "contrato":
      return eqNorm(hit.contrato_convenio, value);
    case "convenio":
      return (
        eqNorm(hitConvenioLabel(hit), value) ||
        eqNorm(hit.contrato_convenio, value) ||
        eqNorm(hit.clave_proceso, value)
      );
    case "origen":
      return eqNorm(hit.origen_adquisicion, value);
    case "departamento":
      return eqNorm(hit.departamento, value);
    case "municipio":
      return eqNorm(hit.municipio, value);
    case "tipo":
      return eqNorm(hit.tipo, value);
    case "configuracion":
      return eqNorm(hit.configuracion, value);
    case "ubicacion":
      return eqNorm(hit.ubicacion_actual, value);
    default:
      return true;
  }
}

/** Aplica solo los filtros de nivel estrictamente superior a `level`. */
function rowMatchesPuenteFilters(
  hit: PuenteLookupHit,
  filters: PuenteSearchFilters,
  level: number = FACET_LEVEL_ALL,
): boolean {
  for (const [key, raw] of Object.entries(filters) as [
    keyof PuenteSearchFilters,
    string | undefined,
  ][]) {
    const value = String(raw || "").trim();
    if (!value) continue;
    if (FACET_LEVEL[key] >= level) continue;
    if (!matchesFilter(hit, key, value)) return false;
  }
  return true;
}

function facetFromRows(
  rows: PuenteLookupHit[],
  field: keyof Pick<
    PuenteLookupHit,
    | "tipo"
    | "configuracion"
    | "ubicacion_actual"
    | "contrato_convenio"
    | "origen_adquisicion"
  >,
  filters: PuenteSearchFilters,
  levelKey: keyof PuenteSearchFilters,
  labelOf?: (value: string) => string,
): PuenteFacetOption[] {
  const counts = new Map<string, number>();
  for (const hit of rows) {
    if (!rowMatchesPuenteFilters(hit, filters, FACET_LEVEL[levelKey])) continue;
    const value = String(hit[field] || "").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: truncateLabel(labelOf ? labelOf(value) : value),
      title: value,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/**
 * Facetas del nivel raíz: value = clave_proceso, label = sigla + contrato.
 * No se restringe por ningún otro filtro: es el punto de entrada del árbol.
 */
function procesoFacets(
  rows: PuenteLookupHit[],
  filters: PuenteSearchFilters,
): PuenteFacetOption[] {
  const counts = new Map<
    string,
    { sigla: string; contrato: string; count: number }
  >();
  for (const hit of rows) {
    if (!rowMatchesPuenteFilters(hit, filters, FACET_LEVEL.proceso)) continue;
    const value = hit.clave_proceso.trim();
    if (!value) continue;
    const prev = counts.get(value);
    counts.set(value, {
      sigla: prev?.sigla || hit.proceso_sigla.trim(),
      contrato: prev?.contrato || hit.contrato_convenio.trim(),
      count: (prev?.count || 0) + 1,
    });
  }
  return [...counts.entries()]
    .map(([value, { sigla, contrato, count }]) => ({
      value,
      label: truncateLabel(
        [sigla, contrato].filter(Boolean).join(" · ") || value,
        56,
      ),
      title: contrato || value,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Faceta raíz Bitácora: Convenio o CTO (etiqueta Excel). */
function convenioFacets(
  rows: PuenteLookupHit[],
  filters: PuenteSearchFilters,
): PuenteFacetOption[] {
  const counts = new Map<string, { title: string; count: number }>();
  for (const hit of rows) {
    if (!rowMatchesPuenteFilters(hit, filters, FACET_LEVEL.convenio)) continue;
    const value = hitConvenioLabel(hit);
    if (!value) continue;
    const prev = counts.get(value);
    counts.set(value, {
      title: hit.contrato_convenio || value,
      count: (prev?.count || 0) + 1,
    });
  }
  return [...counts.entries()]
    .map(([value, { title, count }]) => ({
      value,
      label: truncateLabel(value, 56),
      title,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Eventos de bitácora por id_puente (una sola agregación). */
async function countBitacoraEventos(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      idPuente: sql<string>`lower(trim(coalesce(${records.payload}->>'id_puente', ${records.payload}->>'clave_seguimiento','')))`,
      total: sql<number>`count(*)::int`,
    })
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter("Bitácora estado"),
      ),
    )
    .groupBy(
      sql`lower(trim(coalesce(${records.payload}->>'id_puente', ${records.payload}->>'clave_seguimiento','')))`,
    );

  const out = new Map<string, number>();
  for (const row of rows) {
    if (!row.idPuente) continue;
    out.set(row.idPuente, Number(row.total) || 0);
  }
  return out;
}

function enrichContratoCounts(hits: PuenteLookupHit[], all: PuenteLookupHit[]): void {
  const byContrato = new Map<string, number>();
  for (const h of all) {
    const c = h.contrato_convenio.trim();
    if (!c) continue;
    byContrato.set(c, (byContrato.get(c) || 0) + 1);
  }
  for (const h of hits) {
    const c = h.contrato_convenio.trim();
    if (c) h.puentes_en_proceso = byContrato.get(c) || 1;
  }
}

async function fetchInventarioPuenteHits(capa: string): Promise<PuenteLookupHit[]> {
  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter(capa),
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(500);

  const seen = new Set<string>();
  const hits: PuenteLookupHit[] = [];
  for (const row of rows) {
    const r = dbToRow(row);
    const idp = idPuenteOf(r);
    if (!idp) continue;
    const key = idp.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(toPuenteHit(r));
  }
  return hits;
}

async function loadAllInventarioPuentes(capa: string): Promise<PuenteLookupHit[]> {
  return fetchInventarioPuenteHits(capa);
}

export async function getPuenteFilterFacets(params: {
  capa?: string;
} & PuenteSearchFilters): Promise<PuenteFilterFacets> {
  const capa = params.capa || "Inventario puente";
  const rows = await loadAllInventarioPuentes(capa);
  const filters: PuenteSearchFilters = {
    origen: params.origen,
    proceso: params.proceso,
    convenio: params.convenio,
    departamento: params.departamento,
    municipio: params.municipio,
    tipo: params.tipo,
    configuracion: params.configuracion,
    ubicacion: params.ubicacion,
    contrato: params.contrato,
  };

  return {
    procesos: procesoFacets(rows, filters),
    convenios: convenioFacets(rows, filters),
    contratos: facetFromRows(rows, "contrato_convenio", filters, "contrato"),
    origenes: facetFromRows(
      rows,
      "origen_adquisicion",
      filters,
      "origen",
      (v) => ORIGEN_LABELS[v as OrigenAdquisicion] || v,
    ),
    tipos: facetFromRows(rows, "tipo", filters, "tipo"),
    configuraciones: facetFromRows(rows, "configuracion", filters, "configuracion"),
    ubicaciones: facetFromRows(rows, "ubicacion_actual", filters, "ubicacion"),
    matching: rows.filter((r) => rowMatchesPuenteFilters(r, filters)).length,
    total: rows.length,
  };
}

/** Prioriza llave exacta (código operativo / id_puente) sobre coincidencia parcial. */
function relevanceScore(hit: PuenteLookupHit, q: string): number {
  const term = q.trim().toLowerCase();
  if (!term) return 0;
  const aliases = expandSearchAliases(term).map((a) => a.toLowerCase());
  const codigo = hit.codigo_operativo.toLowerCase();
  const idp = hit.id_puente.toLowerCase();

  if (codigo && aliases.includes(codigo)) return 100;
  if (idp && aliases.includes(idp)) return 90;
  if (codigo && aliases.some((a) => codigo.endsWith(a))) return 70;
  if (codigo.startsWith(term) || idp.startsWith(term)) return 60;
  if (hit.ubicacion_actual.toLowerCase().includes(term)) return 40;
  if (hit.municipio.toLowerCase().includes(term)) return 30;
  if (hit.proceso_sigla.toLowerCase().includes(term)) return 20;
  return 10;
}

function capaFilter(capa: string) {
  const variants = puenteCapaLookupVariants(capa);
  return sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;
}

export async function searchThemePuentes(
  params: {
    q?: string;
    capa?: string;
    limit?: number;
  } & PuenteSearchFilters,
): Promise<PuenteLookupHit[]> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 300);
  const capa = params.capa || "Inventario puente";
  const q = String(params.q || "").trim().toLowerCase();

  const filters: ReturnType<typeof sql>[] = [
    eq(records.themeId, THEME_ID),
    isNull(records.deletedAt),
    capaFilter(capa),
  ];

  if (params.origen?.trim()) {
    const o = params.origen.trim().toLowerCase();
    filters.push(
      sql`lower(trim(coalesce(${records.payload}->>'origen_adquisicion',''))) = ${o}`,
    );
  }
  if (params.proceso?.trim()) {
    const p = params.proceso.trim().toLowerCase();
    filters.push(
      sql`lower(trim(coalesce(${records.payload}->>'clave_proceso',''))) = ${p}`,
    );
  }

  const dept = String(params.departamento || "").trim();
  if (dept) {
    filters.push(sql`${records.departamento} ILIKE ${dept}`);
  }
  const muni = String(params.municipio || "").trim();
  if (muni) {
    filters.push(sql`${records.municipio} ILIKE ${muni}`);
  }
  if (params.tipo?.trim()) {
    const t = params.tipo.trim().toLowerCase();
    filters.push(
      sql`lower(trim(coalesce(${records.payload}->>'tipo',''))) = ${t}`,
    );
  }
  if (params.configuracion?.trim()) {
    const c = params.configuracion.trim().toLowerCase();
    filters.push(
      sql`(
        lower(trim(coalesce(${records.payload}->>'configuracion',''))) = ${c}
        OR lower(trim(coalesce(${records.payload}->>'segun_configuracion',''))) = ${c}
      )`,
    );
  }
  if (params.ubicacion?.trim()) {
    const u = params.ubicacion.trim().toLowerCase();
    filters.push(
      sql`(
        lower(trim(coalesce(${records.payload}->>'ubicacion_actual',''))) = ${u}
        OR lower(trim(coalesce(${records.payload}->>'lugar',''))) = ${u}
      )`,
    );
  }
  if (params.contrato?.trim()) {
    const c = params.contrato.trim().toLowerCase();
    filters.push(
      sql`lower(trim(coalesce(${records.payload}->>'contrato_convenio',''))) = ${c}`,
    );
  }
  if (params.convenio?.trim()) {
    const c = params.convenio.trim().toLowerCase();
    filters.push(
      sql`(
        lower(trim(coalesce(${records.payload}->>'convenio_o_cto',''))) = ${c}
        OR lower(trim(coalesce(${records.payload}->>'contrato_convenio',''))) = ${c}
        OR lower(trim(coalesce(${records.payload}->>'clave_proceso',''))) = ${c}
      )`,
    );
  }

  if (q) {
    // El operador puede escribir "EEUU 3", "DON-EEUU-03", "20" o un lugar.
    const terms = expandSearchAliases(q);
    const likes = [...new Set(terms.map((t) => `%${t.replace(/[%_]/g, "")}%`))];
    const alias = sql.join(
      likes.map(
        (like) => sql`(
          coalesce(${records.payload}->>'codigo_operativo','') ILIKE ${like}
          OR coalesce(${records.payload}->>'proceso_sigla','') ILIKE ${like}
        )`,
      ),
      sql` OR `,
    );
    const like = `%${q.replace(/[%_]/g, "")}%`;
    filters.push(sql`(
      ${alias}
      OR coalesce(${records.payload}->>'id_puente','') ILIKE ${like}
      OR coalesce(${records.payload}->>'id','') ILIKE ${like}
      OR coalesce(${records.payload}->>'clave_seguimiento','') ILIKE ${like}
      OR coalesce(${records.payload}->>'tipo','') ILIKE ${like}
      OR coalesce(${records.payload}->>'configuracion','') ILIKE ${like}
      OR coalesce(${records.payload}->>'ubicacion_actual','') ILIKE ${like}
      OR coalesce(${records.payload}->>'contrato_convenio','') ILIKE ${like}
      OR ${records.departamento} ILIKE ${like}
      OR ${records.municipio} ILIKE ${like}
    )`);
  }

  const rows = await db
    .select()
    .from(records)
    .where(and(...filters))
    .orderBy(desc(records.updatedAt))
    .limit(q || dept || muni ? 200 : limit * 3);

  const seen = new Set<string>();
  const collected: PuenteLookupHit[] = [];
  for (const row of rows) {
    const r = dbToRow(row);
    const idp = idPuenteOf(r);
    if (!idp) continue;
    const key = idp.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    collected.push(toPuenteHit(r));
    if (!q && collected.length >= limit) break;
  }

  // Con término libre, la coincidencia exacta de llave manda sobre el parcial.
  const hits = q
    ? collected
        .map((hit) => ({ hit, score: relevanceScore(hit, q) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.hit)
    : collected.slice(0, limit);

  if (hits.length > 0) {
    const [all, eventos] = await Promise.all([
      loadAllInventarioPuentes(capa),
      countBitacoraEventos(),
    ]);
    enrichContratoCounts(hits, all);
    for (const hit of hits) {
      hit.eventos_bitacora = eventos.get(hit.id_puente.toLowerCase()) || 0;
    }
  }
  return hits;
}

export async function searchThemePuentesWithFacets(params: {
  q?: string;
  capa?: string;
  limit?: number;
} & PuenteSearchFilters): Promise<{
  puentes: PuenteLookupHit[];
  facets: PuenteFilterFacets;
}> {
  const capa = params.capa || "Inventario puente";
  const [puentes, facets] = await Promise.all([
    searchThemePuentes(params),
    getPuenteFilterFacets({
      capa,
      origen: params.origen,
      proceso: params.proceso,
      convenio: params.convenio,
      departamento: params.departamento,
      municipio: params.municipio,
      tipo: params.tipo,
      configuracion: params.configuracion,
      ubicacion: params.ubicacion,
      contrato: params.contrato,
    }),
  ]);
  return { puentes, facets };
}

export async function findThemePuenteById(params: {
  idPuente: string;
  capa?: string;
}): Promise<PuenteLookupHit | null> {
  const idPuente = params.idPuente.trim();
  if (!idPuente) return null;
  const capa = params.capa || "Inventario puente";

  const idFilter = sql`(
    lower(trim(coalesce(${records.payload}->>'id_puente',''))) = ${idPuente.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'id',''))) = ${idPuente.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${idPuente.toLowerCase()}
  )`;

  const [row] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter(capa),
        idFilter,
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(1);

  if (!row) return null;
  return toPuenteHit(dbToRow(row));
}

export async function listThemeRecordsByPuenteAndCapa(params: {
  idPuente: string;
  capa: string;
  limit?: number;
}): Promise<PuenteLookupHit[]> {
  const idPuente = params.idPuente.trim();
  if (!idPuente) return [];
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  const idFilter = sql`(
    lower(trim(coalesce(${records.payload}->>'id_puente',''))) = ${idPuente.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'id',''))) = ${idPuente.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${idPuente.toLowerCase()}
  )`;

  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter(params.capa),
        idFilter,
      ),
    )
    .orderBy(asc(records.createdAt), asc(records.id))
    .limit(limit);

  return rows.map((row) => toPuenteHit(dbToRow(row)));
}

/**
 * Todos los puentes de inventario de un contrato/proceso (Base General completa).
 * Sin tope de búsqueda facetada: misma lógica que la hoja Excel.
 */
export async function listThemePuentesByProceso(params: {
  proceso?: string;
  contrato?: string;
  capa?: string;
  limit?: number;
}): Promise<PuenteLookupHit[]> {
  const capa = params.capa || "Inventario puente";
  const proceso = String(params.proceso || "").trim();
  const contrato = String(params.contrato || "").trim();
  if (!proceso && !contrato) return [];
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 1000);

  const match =
    proceso && contrato
      ? sql`(
          lower(trim(coalesce(${records.payload}->>'clave_proceso',''))) = ${proceso.toLowerCase()}
          OR lower(trim(coalesce(${records.payload}->>'contrato_convenio',''))) = ${contrato.toLowerCase()}
          OR lower(trim(coalesce(${records.payload}->>'convenio_o_cto',''))) = ${contrato.toLowerCase()}
        )`
      : proceso
        ? sql`(
          lower(trim(coalesce(${records.payload}->>'clave_proceso',''))) = ${proceso.toLowerCase()}
          OR lower(trim(coalesce(${records.payload}->>'convenio_o_cto',''))) = ${proceso.toLowerCase()}
        )`
        : sql`(
          lower(trim(coalesce(${records.payload}->>'contrato_convenio',''))) = ${contrato.toLowerCase()}
          OR lower(trim(coalesce(${records.payload}->>'convenio_o_cto',''))) = ${contrato.toLowerCase()}
        )`;

  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter(capa),
        match,
      ),
    )
    .orderBy(asc(records.id))
    .limit(limit);

  const seen = new Set<string>();
  const hits: PuenteLookupHit[] = [];
  for (const row of rows) {
    const r = dbToRow(row);
    const idp = idPuenteOf(r);
    if (!idp) continue;
    const key = idp.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(toPuenteHit(r));
  }

  hits.sort((a, b) => {
    const na = Number(a.id_puente);
    const nb = Number(b.id_puente);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return a.id_puente.localeCompare(b.id_puente, "es");
  });

  return hits;
}

/**
 * Procesos disponibles para vincular.
 *
 * - `from: "estructuracion"` (default): hoja Contratos Estructuración.
 * - `from: "inventario"`: contratos de Base General (Inventario puente), con
 *   todos los puentes vinculados — misma lógica que las hojas del Excel.
 */
export async function searchThemeProcesos(params: {
  q?: string;
  limit?: number;
  from?: "estructuracion" | "inventario";
}): Promise<ProcesoLookupHit[]> {
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 40);
  const q = String(params.q || "").trim().toLowerCase();
  const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;
  const from = params.from || "estructuracion";

  const contratoFilter = like
    ? sql`coalesce(${records.payload}->>'contrato_convenio','') ILIKE ${like}`
    : sql`coalesce(${records.payload}->>'contrato_convenio','') <> ''`;

  if (from === "inventario") {
    const inventarioRows = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.themeId, THEME_ID),
          isNull(records.deletedAt),
          capaFilter("Inventario puente"),
          contratoFilter,
        ),
      )
      .orderBy(desc(records.updatedAt))
      .limit(500);

    // Clave del Map siempre en minúsculas: evita duplicar el mismo contrato
    // cuando inventario trae "9677-CV…" y estructuración busca "9677-cv…".
    const byClave = new Map<string, ProcesoLookupHit>();
    for (const row of inventarioRows) {
      const r = dbToRow(row);
      const contrato = String(r.contrato_convenio || r.contrato || "").trim();
      if (!contrato) continue;
      const proc = applyProcesoKeys({
        contrato_convenio: contrato,
        tipo_vinculo: r.tipo_vinculo,
      });
      const clave = String(proc.clave_proceso || normalizeClaveProceso(contrato));
      if (!clave) continue;
      const key = clave.toLowerCase();
      const prev = byClave.get(key);
      if (!prev) {
        byClave.set(key, {
          id: String(r.id),
          contrato_convenio: contrato,
          clave_proceso: clave,
          tipo_vinculo: String(proc.tipo_vinculo || ""),
          valor: r.valor ?? "",
          vigencia: String(r.vigencia || r.ano_compra || ""),
          descripcion_proceso: String(
            r.descripcion_proceso || r.comentarios || "",
          ),
          payload: r,
          puentes_vinculados: 1,
          etapas_registradas: 0,
          estructurado: false,
        });
      } else {
        prev.puentes_vinculados = (prev.puentes_vinculados || 0) + 1;
      }
    }

    // Marcar cuáles también están en Estructuración (sin inventar filas).
    const estructurados = await db
      .select({
        contrato: sql<string>`coalesce(${records.payload}->>'contrato_convenio','')`,
      })
      .from(records)
      .where(
        and(
          eq(records.themeId, THEME_ID),
          isNull(records.deletedAt),
          capaFilter("Contrato estructuración"),
          sql`coalesce(${records.payload}->>'contrato_convenio','') <> ''`,
        ),
      )
      .limit(300);
    const estructuradoKeys = new Set(
      estructurados.map((r) =>
        normalizeClaveProceso(String(r.contrato || "")).toLowerCase(),
      ),
    );
    for (const hit of byClave.values()) {
      if (estructuradoKeys.has(hit.clave_proceso.toLowerCase())) {
        hit.estructurado = true;
      }
    }

    // Contratos ya estructurados sin puentes aún (para dar de alta el 1.º).
    for (const row of estructurados) {
      const contrato = String(row.contrato || "").trim();
      if (!contrato) continue;
      const clave = normalizeClaveProceso(contrato);
      const key = clave.toLowerCase();
      if (byClave.has(key)) continue;
      const proc = applyProcesoKeys({ contrato_convenio: contrato });
      byClave.set(key, {
        id: "",
        contrato_convenio: contrato,
        clave_proceso: clave,
        tipo_vinculo: String(proc.tipo_vinculo || ""),
        valor: "",
        vigencia: "",
        descripcion_proceso: "",
        payload: {} as ProcesoLookupHit["payload"],
        puentes_vinculados: 0,
        etapas_registradas: 0,
        estructurado: true,
      });
    }

    let hits = [...byClave.values()];
    if (q) {
      hits = hits.filter(
        (h) =>
          h.contrato_convenio.toLowerCase().includes(q) ||
          h.clave_proceso.toLowerCase().includes(q),
      );
    }

    hits.sort((a, b) => {
      const dn = (b.puentes_vinculados || 0) - (a.puentes_vinculados || 0);
      if (dn !== 0) return dn;
      return a.contrato_convenio.localeCompare(b.contrato_convenio, "es");
    });
    return hits.slice(0, limit);
  }

  // ── Estructuración (default) ──
  const estructuracionRows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter("Contrato estructuración"),
        contratoFilter,
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(300);

  const byClave = new Map<string, ProcesoLookupHit>();

  for (const row of estructuracionRows) {
    const r = dbToRow(row);
    const contrato = String(r.contrato_convenio || r.contrato || "").trim();
    if (!contrato) continue;
    const proc = applyProcesoKeys({
      contrato_convenio: contrato,
      tipo_vinculo: r.tipo_vinculo,
    });
    const clave = String(proc.clave_proceso || normalizeClaveProceso(contrato));
    if (!clave) continue;
    const key = clave.toLowerCase();
    const prev = byClave.get(key);
    if (!prev) {
      byClave.set(key, {
        id: String(r.id),
        contrato_convenio: contrato,
        clave_proceso: clave,
        tipo_vinculo: String(proc.tipo_vinculo || ""),
        valor: r.valor ?? "",
        vigencia: String(r.vigencia || ""),
        descripcion_proceso: String(r.descripcion_proceso || r.comentarios || ""),
        payload: r,
        etapas_registradas: 1,
        estructurado: true,
      });
    } else {
      prev.etapas_registradas = (prev.etapas_registradas || 0) + 1;
      prev.id = String(r.id);
      prev.payload = r;
      prev.valor = r.valor ?? prev.valor;
      prev.vigencia = String(r.vigencia || prev.vigencia || "");
      if (!prev.descripcion_proceso) {
        prev.descripcion_proceso = String(
          r.descripcion_proceso || r.comentarios || "",
        );
      }
    }
  }

  let hits = [...byClave.values()];
  if (q) {
    hits = hits.filter(
      (h) =>
        h.contrato_convenio.toLowerCase().includes(q) ||
        h.clave_proceso.toLowerCase().includes(q) ||
        h.descripcion_proceso?.toLowerCase().includes(q),
    );
  }

  // Cuántos puentes (ID único) ya están atados a cada contrato en inventario.
  const invCounts = await db
    .select({
      clave: sql<string>`lower(trim(coalesce(${records.payload}->>'clave_proceso','')))`,
      contrato: sql<string>`lower(trim(coalesce(${records.payload}->>'contrato_convenio','')))`,
      total: sql<number>`count(*)::int`,
    })
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter("Inventario puente"),
      ),
    )
    .groupBy(
      sql`lower(trim(coalesce(${records.payload}->>'clave_proceso','')))`,
      sql`lower(trim(coalesce(${records.payload}->>'contrato_convenio','')))`,
    );
  for (const hit of hits) {
    const clave = hit.clave_proceso.toLowerCase();
    const contrato = hit.contrato_convenio.toLowerCase();
    let n = 0;
    for (const row of invCounts) {
      if (
        (row.clave && row.clave === clave) ||
        (row.contrato && row.contrato === contrato)
      ) {
        n += Number(row.total) || 0;
      }
    }
    hit.puentes_vinculados = n;
  }

  hits.sort((a, b) => {
    const dn = (b.puentes_vinculados || 0) - (a.puentes_vinculados || 0);
    if (dn !== 0) return dn;
    return a.contrato_convenio.localeCompare(b.contrato_convenio, "es");
  });
  return hits.slice(0, limit);
}

export async function findThemeProcesoByClave(params: {
  clave: string;
}): Promise<ProcesoLookupHit | null> {
  const clave = params.clave.trim();
  if (!clave) return null;
  const hits = await searchThemeProcesos({ q: clave, limit: 5 });
  return (
    hits.find((h) => h.clave_proceso.toLowerCase() === clave.toLowerCase()) ||
    hits[0] ||
    null
  );
}

export async function listThemeRecordsByProcesoAndCapa(params: {
  claveProceso: string;
  contratoConvenio?: string;
  capa?: string;
  limit?: number;
}): Promise<RecordRow[]> {
  const capa = params.capa || "Contrato estructuración";
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);
  const clave = params.claveProceso.trim();
  const contrato = String(params.contratoConvenio || "").trim();

  const procFilter = clave
    ? sql`lower(trim(coalesce(${records.payload}->>'clave_proceso',''))) = ${clave.toLowerCase()}`
    : contrato
      ? sql`coalesce(${records.payload}->>'contrato_convenio','') ILIKE ${contrato}`
      : sql`false`;

  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaFilter(capa),
        procFilter,
      ),
    )
    .orderBy(asc(records.createdAt), asc(records.id))
    .limit(limit);

  return rows.map(dbToRow);
}

export { normalizePuenteCapa };
