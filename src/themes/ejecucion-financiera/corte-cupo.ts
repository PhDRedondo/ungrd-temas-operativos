/**
 * Cupo de apropiación del corte SMD.
 * No sale del Excel Fidusap: se captura en formulario cada vez que
 * se carga un reporte, porque el valor es de esa fecha de corte.
 */
import type { RecordRow } from "@/lib/records/types";

export const CORTE_CUPO_KIND = "corte-cupo";
export const CORTE_CUPO_PREFIX = "CORTE-CUPO";

export type CorteCupoMap = Record<string, number>;

export function isCorteCupoRecord(row: Record<string, unknown> | RecordRow): boolean {
  const kind = String(row._kind ?? "").trim();
  if (kind === CORTE_CUPO_KIND) return true;
  const capa = String(row.tipo_registro ?? row.capa ?? "").trim();
  if (capa === CORTE_CUPO_KIND) return true;
  const clave = String(row.clave_seguimiento ?? row.no_cdp ?? "").trim();
  return clave.toUpperCase().startsWith(CORTE_CUPO_PREFIX);
}

export function corteCupoClave(corte: string): string {
  const slug = String(corte || "vigente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${CORTE_CUPO_PREFIX}:${slug || "VIGENTE"}`;
}

export function parseCupoMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  let t = String(raw ?? "").trim().replace(/[$\s]/g, "");
  if (!t) return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d+$/.test(t)) {
    t = t.replace(",", ".");
  } else {
    t = t.replace(/,/g, "");
  }
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function lookupCorteCupo(
  cupos: CorteCupoMap,
  key: string,
  linea: string,
): number | null {
  const code = /^\d{7}$/.test(key) ? key : linea.match(/9\d{6}/)?.[0] || "";
  for (const candidate of [linea, key, code]) {
    if (!candidate) continue;
    const n = cupos[candidate];
    if (typeof n === "number" && n > 0) return n;
  }
  return null;
}

export function extractCorteCupos(
  rows: RecordRow[],
  corte: string,
): CorteCupoMap {
  const cupoRows = rows.filter(isCorteCupoRecord);
  if (!cupoRows.length) return {};
  const wanted = String(corte || "").trim().toLowerCase();
  const match =
    cupoRows.find(
      (r) => String(r.corte ?? "").trim().toLowerCase() === wanted,
    ) || cupoRows[cupoRows.length - 1];
  const raw = match?.cupos;
  const out: CorteCupoMap = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = parseCupoMoney(v);
      if (n > 0) out[k] = n;
    }
  }
  return out;
}

export function expandCuposForLinea(
  linea: string,
  valor: number,
): CorteCupoMap {
  const out: CorteCupoMap = {};
  if (valor <= 0) return out;
  const code = String(linea).match(/9\d{6}/)?.[0] || "";
  if (linea) out[linea] = valor;
  if (code) out[code] = valor;
  return out;
}
