/**
 * Filas de la tabla operativa FIC (plantilla v3).
 * Solo lectura sobre registros; no persiste.
 */
import type { RecordRow } from "@/lib/records/types";

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
  lugar: string;
  vigencia: string;
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

function formatAvancePct(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null || String(raw).trim() === "") return "—";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return String(raw);
  return `${n % 1 === 0 ? String(n) : n.toFixed(1)}%`;
}

function isCritico(r: RecordRow): boolean {
  const estado = str(r, "estado");
  const pendiente = num(r, "valor_por_legalizar");
  return pendiente > 0 && /VENCID/i.test(estado);
}

/** Tabla operativa: toda la base filtrada, vencidos y saldo primero. */
export function buildFicOperativeRows(rows: RecordRow[]): FicOperativeRow[] {
  return rows
    .map((r) => {
      const muni = str(r, "municipio");
      const depto = str(r, "departamento");
      const lugar = [muni, depto]
        .filter((x) => x && !/^sin (departamento|municipio)$/i.test(x))
        .join(" · ");
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
        lugar,
        vigencia: str(r, "vigencia") || "—",
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
    row.lugar,
    row.vigencia,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
