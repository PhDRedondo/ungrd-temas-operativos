/**
 * Filtros client-side compartidos entre Centro de mando y Análisis avanzado.
 * Solo lectura sobre records en memoria; no altera upsert ni BD.
 */
import { normalizeTrackingKey } from "@/lib/analytics/enrichRecords";
import { resolveEventDate } from "@/lib/analytics/timeSeries";
import type { RecordRow } from "@/lib/records/types";

export type RecordFilterState = {
  q: string;
  departamento: string;
  municipio: string;
  estado: string;
  /** Capa / tipo_registro */
  capa: string;
  /** Dimensión terciaria de charts (Sankey/pie) */
  tercero: string;
  periodo: string;
  from: string;
  to: string;
};

export const EMPTY_RECORD_FILTERS: RecordFilterState = {
  q: "",
  departamento: "",
  municipio: "",
  estado: "",
  capa: "",
  tercero: "",
  periodo: "",
  from: "",
  to: "",
};

/** Params compartibles en la URL del tema (sin tercero de charts). */
export const FILTER_URL_KEYS = [
  "q",
  "departamento",
  "municipio",
  "estado",
  "capa",
  "periodo",
  "from",
  "to",
] as const;

export type FilterUrlKey = (typeof FILTER_URL_KEYS)[number];

export function hasActiveFilters(f: RecordFilterState): boolean {
  return Boolean(
    f.q.trim() ||
      f.departamento ||
      f.municipio ||
      f.estado ||
      f.capa ||
      f.tercero ||
      f.periodo ||
      f.from ||
      f.to,
  );
}

function trackingCandidates(r: RecordRow): string[] {
  return [
    r.clave_seguimiento,
    r.orden_de_proveeduria,
    r.placa,
    r.serial,
    r.no_cdp,
    r.no_declaratoria,
    r.no_convenio,
    r.id,
  ]
    .map((v) => normalizeTrackingKey(v))
    .filter(Boolean);
}

/** Coincide clave de seguimiento o texto libre en campos operativos. */
export function matchRecordQuery(r: RecordRow, rawQ: string): boolean {
  const q = String(rawQ || "").trim();
  if (!q) return true;
  const nq = normalizeTrackingKey(q);
  if (nq.length >= 2) {
    for (const key of trackingCandidates(r)) {
      if (key.includes(nq) || nq.includes(key)) return true;
    }
  }
  const blob = [
    r.clave_seguimiento,
    r.orden_de_proveeduria,
    r.placa,
    r.serial,
    r.no_cdp,
    r.departamento,
    r.municipio,
    r.estado,
    r.tipo_registro,
    r.capa,
    r.id,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");
  return blob.includes(q.toLowerCase());
}

export function capaOf(r: RecordRow): string {
  return String(r.tipo_registro || r.capa || "").trim();
}

export function applyRecordFilters(
  rows: RecordRow[],
  f: RecordFilterState,
  opts: { themeId: string; thirdKey?: string },
): RecordRow[] {
  const thirdKey = opts.thirdKey || "municipio";
  return rows.filter((r) => {
    if (!matchRecordQuery(r, f.q)) return false;
    if (f.departamento && r.departamento !== f.departamento) return false;
    if (f.municipio && r.municipio !== f.municipio) return false;
    if (f.estado && r.estado !== f.estado) return false;
    if (f.capa && capaOf(r) !== f.capa) return false;
    if (f.tercero && String(r[thirdKey] || "") !== f.tercero) return false;
    const eventDate = resolveEventDate(r, opts.themeId);
    if (f.periodo && !eventDate.startsWith(f.periodo)) return false;
    if (!f.periodo && f.from && eventDate && eventDate < f.from) return false;
    if (!f.periodo && f.to && eventDate && eventDate > f.to) return false;
    return true;
  });
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((v) => v.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
}

function paramGet(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string {
  if (sp instanceof URLSearchParams) {
    return String(sp.get(key) || "").trim();
  }
  const raw = sp[key];
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

/** Lee filtros desde searchParams de Next o URLSearchParams. */
export function parseFiltersFromParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
): RecordFilterState {
  return {
    ...EMPTY_RECORD_FILTERS,
    q: paramGet(sp, "q"),
    departamento: paramGet(sp, "departamento"),
    municipio: paramGet(sp, "municipio"),
    estado: paramGet(sp, "estado"),
    capa: paramGet(sp, "capa"),
    periodo: paramGet(sp, "periodo"),
    from: paramGet(sp, "from"),
    to: paramGet(sp, "to"),
  };
}

/** Serializa filtros (+ tab) a query string compartible. */
export function writeFiltersToParams(
  filters: RecordFilterState,
  tab?: string,
): URLSearchParams {
  const p = new URLSearchParams();
  if (tab) p.set("tab", tab);
  for (const key of FILTER_URL_KEYS) {
    const v = String(filters[key] || "").trim();
    if (v) p.set(key, v);
  }
  return p;
}

/** Deep-link a un tema con filtros preaplicados. */
export function buildThemeHref(
  themeId: string,
  opts?: Partial<RecordFilterState> & { tab?: string },
): string {
  const filters: RecordFilterState = {
    ...EMPTY_RECORD_FILTERS,
    ...opts,
  };
  const p = writeFiltersToParams(filters, opts?.tab || "analitica");
  const qs = p.toString();
  return qs ? `/app/temas/${themeId}?${qs}` : `/app/temas/${themeId}`;
}
