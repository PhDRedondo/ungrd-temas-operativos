/**
 * Agregados del tablero SMD (CDP Fidusap filtrado a Manejo de Desastres).
 */
import type { RecordRow } from "@/lib/records/types";

export type SmdOperativeRow = {
  key: string;
  noCdp: string;
  grupo: string;
  rubro: string;
  tipo: string;
  estado: string;
  departamento: string;
  fechaCdp: string;
  fechaFinal: string;
  noRc: string;
  valorCdp: number;
  valorRc: number;
  valorPagado: number;
  valorPorPagar: number;
  critico: boolean;
};

export type SmdDashboardAggregate = {
  n: number;
  cdpUnicos: number;
  valorCdp: number;
  valorRc: number;
  valorPagado: number;
  valorPorPagar: number;
  sinRc: number;
  vencidos: number;
  pctEjecucion: number | null;
  porGrupo: { name: string; count: number; valorCdp: number; pagado: number }[];
  porDepartamento: { name: string; count: number; valorCdp: number; pagado: number }[];
  rows: SmdOperativeRow[];
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

function isPast(iso: string, today: Date): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due.getTime() < t.getTime();
}

export function aggregateSmdDashboard(
  rows: RecordRow[],
  today: Date = new Date(),
): SmdDashboardAggregate {
  const porGrupo = new Map<string, { count: number; valorCdp: number; pagado: number }>();
  const porDepto = new Map<string, { count: number; valorCdp: number; pagado: number }>();
  const cdp = new Set<string>();
  const operative: SmdOperativeRow[] = [];
  let valorCdp = 0;
  let valorRc = 0;
  let valorPagado = 0;
  let valorPorPagar = 0;
  let sinRc = 0;
  let vencidos = 0;

  for (const r of rows) {
    const noCdp = str(r, "no_cdp", "clave_seguimiento") || "Sin CDP";
    cdp.add(noCdp);
    const grupo = str(r, "grupo", "tipo_registro", "capa") || "OTROS";
    const depto = str(r, "departamento");
    const deptoLabel =
      depto && !/^sin departamento$/i.test(depto) ? depto : "Nacional / sin depto";
    const vCdp = num(r, "valor_cdp", "valor");
    const vRc = num(r, "valor_rc");
    const pagado = num(r, "valor_pagado");
    const porPagar = num(r, "valor_por_pagar");
    const fechaFinal = str(r, "fecha_final");
    const hasRc = Boolean(str(r, "no_rc"));
    const vencido = Boolean(fechaFinal && isPast(fechaFinal, today) && porPagar > 0);
    if (!hasRc) sinRc += 1;
    if (vencido) vencidos += 1;
    valorCdp += vCdp;
    valorRc += vRc;
    valorPagado += pagado;
    valorPorPagar += porPagar;

    const g = porGrupo.get(grupo) || { count: 0, valorCdp: 0, pagado: 0 };
    g.count += 1;
    g.valorCdp += vCdp;
    g.pagado += pagado;
    porGrupo.set(grupo, g);

    const d = porDepto.get(deptoLabel) || { count: 0, valorCdp: 0, pagado: 0 };
    d.count += 1;
    d.valorCdp += vCdp;
    d.pagado += pagado;
    porDepto.set(deptoLabel, d);

    operative.push({
      key: String(r.id || noCdp),
      noCdp,
      grupo,
      rubro: str(r, "rubro") || "—",
      tipo: str(r, "tipo") || "—",
      estado: str(r, "estado") || "—",
      departamento: deptoLabel,
      fechaCdp: str(r, "fecha_cdp", "fecha") || "—",
      fechaFinal: fechaFinal || "—",
      noRc: str(r, "no_rc") || "—",
      valorCdp: vCdp,
      valorRc: vRc,
      valorPagado: pagado,
      valorPorPagar: porPagar,
      critico: vencido || (!hasRc && vCdp > 0),
    });
  }

  operative.sort(
    (a, b) =>
      Number(b.critico) - Number(a.critico) ||
      b.valorPorPagar - a.valorPorPagar ||
      b.valorCdp - a.valorCdp,
  );

  const denom = valorRc > 0 ? valorRc : valorCdp;
  return {
    n: rows.length,
    cdpUnicos: cdp.size,
    valorCdp,
    valorRc,
    valorPagado,
    valorPorPagar,
    sinRc,
    vencidos,
    pctEjecucion: denom > 0 ? (valorPagado / denom) * 100 : null,
    porGrupo: [...porGrupo.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.valorCdp - a.valorCdp),
    porDepartamento: [...porDepto.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.valorCdp - a.valorCdp)
      .slice(0, 20),
    rows: operative,
  };
}

export function matchSmdOperativeRow(row: SmdOperativeRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.noCdp,
    row.grupo,
    row.rubro,
    row.tipo,
    row.estado,
    row.departamento,
    row.noRc,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
