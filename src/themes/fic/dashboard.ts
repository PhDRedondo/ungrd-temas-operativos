/**
 * Filas de la tabla operativa FIC (plantilla v3).
 * Solo lectura sobre registros; no persiste.
 */
import type { RecordRow } from "@/lib/records/types";
import { canonicalEstadoLegalizacion } from "./select-options";

export type FicOperativeRow = {
  key: string;
  noCdp: string;
  noRc: string;
  formatoAprobacion: string;
  acto: string;
  acto2: string;
  fechaActo: string;
  fechaActo2: string;
  fechaDesembolso: string;
  fechaModificacion: string;
  avancePct: string;
  estado: string;
  departamento: string;
  municipio: string;
  vigencia: string;
  plazoEjecucion: string;
  plazoAdicion: string;
  plazoFinal: string;
  fechaVencimiento: string;
  valor: number;
  porLegalizar: number;
  critico: boolean;
};

function str(r: RecordRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function num(r: RecordRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    let t = String(v).trim().replace(/[$\s]/g, "");
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else if (/^\d+,\d+$/.test(t)) {
      t = t.replace(",", ".");
    } else {
      t = t.replace(/,/g, "");
    }
    const n = Number(t.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function dash(v: string): string {
  return v.trim() ? v.trim() : "—";
}

function formatDays(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n % 1 === 0 ? String(n) : n.toFixed(1)} días`;
}

function formatAvancePct(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null || String(raw).trim() === "") return "—";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return String(raw);
  return `${n % 1 === 0 ? String(n) : n.toFixed(1)}%`;
}

/** Igual que filtrar la base por estado de legalización = VENCIDO. */
export function isFicEstadoVencido(estado: unknown): boolean {
  return canonicalEstadoLegalizacion(estado) === "VENCIDO";
}

function parseIsoDate(raw: string): Date | null {
  const m = String(raw || "")
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  if (!d || !Number.isFinite(days)) return "";
  d.setDate(d.getDate() + Math.round(days));
  return toIsoDate(d);
}

function firstIsoDate(r: RecordRow, ...keys: string[]): string {
  for (const k of keys) {
    const d = parseIsoDate(str(r, k));
    if (d) return toIsoDate(d);
  }
  return "";
}

function laterIso(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Cerrado: ya no hay plazo de legalización que vencer. */
export function isFicCerradoLegalizacion(estado: unknown): boolean {
  const c = canonicalEstadoLegalizacion(estado);
  if (c === "LEGALIZADO PARCIALMENTE") return false;
  if (c === "LEGALIZADO" || c === "LEGALIZADO 100%") return true;
  if (c === "ANULADO" || c === "CIERRE" || c === "REINTEGRO") return true;
  const raw = String(estado ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return raw === "NO TRAMITADO";
}

/**
 * Plazo en días: ejecución + adición (prórroga). Si falta el inicial, usa
 * `plazo_final_dias` ya grabado.
 */
export function resolveFicPlazoDias(r: RecordRow): number | null {
  const ejecucion = num(r, "plazo_ejecucion_dias");
  const adicion = Math.max(0, num(r, "plazo_adicion_dias"));
  if (ejecucion > 0) return ejecucion + adicion;
  const final = num(r, "plazo_final_dias");
  return final > 0 ? final : null;
}

/** Alcance: fecha inicial de legalización; si no hay, desembolso o acto. */
export function resolveFicFechaInicio(r: RecordRow): string {
  return firstIsoDate(
    r,
    "fecha_inicial_para_legalizacion",
    "fecha",
    "fecha_acto_administrativo_resolucion",
  );
}

/**
 * Fecha de vencimiento = fecha inicial + (plazo ejecución + plazo adicional).
 * Si hay fecha final / legalización por prórroga posterior, se toma la más tarde.
 */
export function resolveFicFechaVencimiento(r: RecordRow): string {
  const inicio = resolveFicFechaInicio(r);
  const plazo = resolveFicPlazoDias(r);
  const computed = inicio && plazo != null ? addDaysIso(inicio, plazo) : "";
  const storedFinal = firstIsoDate(r, "fecha_final_para_legalizacion");
  const storedProrroga = firstIsoDate(r, "fecha_de_legalizacion_por_prorroga");
  const prorroga =
    storedProrroga && storedProrroga !== inicio ? storedProrroga : "";
  return laterIso(laterIso(computed, storedFinal), prorroga);
}

function isDateBeforeToday(iso: string, today: Date): boolean {
  const due = parseIsoDate(iso);
  if (!due) return false;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return d.getTime() < t.getTime();
}

/**
 * Vencido si el estado es VENCIDO, o si la fecha calculada ya pasó y el FIC
 * sigue abierto (no legalizado / anulado / reintegro).
 */
export function isFicVencido(r: RecordRow, today: Date = new Date()): boolean {
  const estado = str(r, "estado");
  if (isFicEstadoVencido(estado)) return true;
  if (isFicCerradoLegalizacion(estado)) return false;
  const vencimiento = resolveFicFechaVencimiento(r);
  if (!vencimiento) return false;
  return isDateBeforeToday(vencimiento, today);
}

function isCritico(r: RecordRow): boolean {
  return isFicVencido(r);
}

/** Tabla operativa: toda la base filtrada, vencidos y saldo primero. */
export function buildFicOperativeRows(rows: RecordRow[]): FicOperativeRow[] {
  return rows
    .map((r) => {
      const muni = str(r, "municipio");
      const depto = str(r, "departamento");
      const noCdp = str(r, "no_cdp", "clave_seguimiento") || "Sin FIC";
      return {
        key: String(r.id || noCdp),
        noCdp,
        noRc: dash(str(r, "no_rc")),
        formatoAprobacion: dash(
          str(r, "formato_de_aprobacion_de_la_atencion"),
        ),
        acto: dash(str(r, "acto_administrativo_otorgamiento_del_recurso")),
        acto2: dash(str(r, "acto_administrativo_otorgamiento_del_recurso_2")),
        fechaActo: dash(str(r, "fecha_acto_administrativo_resolucion")),
        fechaActo2: dash(str(r, "fecha_acto_administrativo_resolucion_2")),
        fechaDesembolso: dash(str(r, "fecha")),
        fechaModificacion: dash(
          str(r, "fecha_acto_administrativo_modificacion"),
        ),
        avancePct: formatAvancePct(
          r.porcentaje_de_avance_en_el_ejericicio_de_legalizacion,
        ),
        estado: str(r, "estado") || "—",
        departamento: dash(
          depto && !/^sin departamento$/i.test(depto) ? depto : "",
        ),
        municipio: dash(
          muni && !/^sin municipio$/i.test(muni) ? muni : "",
        ),
        vigencia: str(r, "vigencia") || "—",
        plazoEjecucion: formatDays(num(r, "plazo_ejecucion_dias")),
        plazoAdicion: formatDays(num(r, "plazo_adicion_dias")),
        plazoFinal: formatDays(resolveFicPlazoDias(r) ?? 0),
        fechaVencimiento: dash(resolveFicFechaVencimiento(r)),
        valor: num(r, "valor"),
        porLegalizar: num(r, "valor_por_legalizar"),
        critico: isCritico(r),
      } satisfies FicOperativeRow;
    })
    .sort(
      (a, b) =>
        Number(b.critico) - Number(a.critico) ||
        b.porLegalizar - a.porLegalizar ||
        b.valor - a.valor ||
        a.noCdp.localeCompare(b.noCdp, "es"),
    );
}

export function matchFicOperativeRow(
  row: FicOperativeRow,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.noCdp,
    row.noRc,
    row.formatoAprobacion,
    row.acto,
    row.acto2,
    row.estado,
    row.departamento,
    row.municipio,
    row.vigencia,
    row.plazoEjecucion,
    row.plazoAdicion,
    row.plazoFinal,
    row.fechaVencimiento,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
