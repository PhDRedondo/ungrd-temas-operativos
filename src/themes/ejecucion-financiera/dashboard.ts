/**
 * Agregados del tablero SMD (CDP Fidusap filtrado a Manejo de Desastres).
 */
import type { RecordRow } from "@/lib/records/types";
import { extractCorteCupos, isCorteCupoRecord, lookupCorteCupo } from "./corte-cupo";
import { isTableroEjecucionRow } from "./fidusap";

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

/** Billones (B) y miles de millones (mil M), como el tablero FNGRD. */
export function formatCompactCop(n: number): string {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e12) {
    const b = a / 1e12;
    return `${sign}${b.toLocaleString("es-CO", {
      maximumFractionDigits: b >= 10 ? 0 : 3,
    })} B`;
  }
  if (a >= 1e9) {
    const milM = a / 1e9;
    return `${sign}${milM.toLocaleString("es-CO", {
      maximumFractionDigits: milM >= 20 ? 0 : 1,
    })} mil M`;
  }
  if (a >= 1e6) {
    return `${sign}${(a / 1e6).toLocaleString("es-CO", {
      maximumFractionDigits: 0,
    })} M`;
  }
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function corteLabelFromFileName(fileName: string): string {
  const base = String(fileName || "")
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+\(\d+\)$/, "")
    .trim();
  const meses =
    "ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE";
  const m = base.match(new RegExp(`((?:${meses})\\s+\\d{1,2}\\s+DE\\s+\\d{4})`, "i"));
  if (m?.[1]) {
    const label = m[1].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return `Corte ${label}`;
  }
  const reporte = base.match(/reporte\s+(.+)/i);
  if (reporte?.[1]) return `Corte ${reporte[1].trim()}`;
  return base || "Corte vigente";
}

export function stampFidusapCorte(
  rows: Record<string, unknown>[],
  fileName: string,
): Record<string, unknown>[] {
  const corte = corteLabelFromFileName(fileName);
  return rows.map((r) => ({
    ...r,
    corte,
    _archivo_fuente: fileName,
  }));
}

export type SmdSubcuenta = {
  key: string;
  label: string;
  code: string;
  linea: string;
};

/** Línea Fidusap «6A-PRINCIPAL 9677001» → subcuenta del tablero FNGRD. */
export function parseSmdSubcuenta(linea: unknown): SmdSubcuenta {
  const raw = String(linea ?? "").trim();
  if (!raw) {
    return { key: "na", label: "N/A", code: "", linea: "" };
  }
  const code = raw.match(/9\d{6}/)?.[0] ?? "";
  let name = raw
    .replace(/^\d+[A-Z]-/i, "")
    .replace(/\s*9\d{6}\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) name = "N/A";
  const label = code ? `${name} (${code})` : name;
  return { key: code || name.toUpperCase(), label, code, linea: raw };
}

export type SmdControlFilters = {
  anio: string;
  resolucion: string;
  fuente: string;
  linea: string;
  subcuentas: string[];
  q: string;
  anioDesde: string;
  grupo: string;
  estado: string;
  areaEjecutora: string;
};

export const EMPTY_SMD_CONTROL_FILTERS: SmdControlFilters = {
  anio: "",
  resolucion: "",
  fuente: "",
  linea: "",
  subcuentas: [],
  q: "",
  anioDesde: "",
  grupo: "",
  estado: "",
  areaEjecutora: "",
};

export type SmdControlOptions = {
  anios: string[];
  resoluciones: { value: string; label: string; count: number }[];
  fuentes: { value: string; label: string; count: number }[];
  lineas: { value: string; label: string; count: number }[];
  grupos: { value: string; label: string; count: number }[];
  estados: { value: string; label: string; count: number }[];
  areas: { value: string; label: string; count: number }[];
  subcuentas: SmdSubcuenta[];
  cortes: string[];
};

export type SmdSubcuentaRow = {
  key: string;
  label: string;
  linea: string;
  cdpCount: number;
  apropiacion: number;
  cdp: number;
  apropiacionDisponible: number;
  compromiso: number;
  pagado: number;
  porPagar: number;
  saldoPorComprometer: number;
  cupoFormulario: boolean;
  pctCdp: number | null;
  pctCompromiso: number | null;
  pctPagado: number | null;
  pctPorPagar: number | null;
};

export type SmdControlBoard = {
  n: number;
  cdpUnicos: number;
  corte: string;
  archivo: string;
  apropiacion: number;
  cdp: number;
  apropiacionDisponible: number;
  compromiso: number;
  pagado: number;
  porPagar: number;
  saldoPorComprometer: number;
  pctCdp: number | null;
  pctCompromiso: number | null;
  pctPagado: number | null;
  pctPorPagar: number | null;
  hasApropiacion: boolean;
  bySubcuenta: SmdSubcuentaRow[];
  byLinea: SmdSubcuentaRow[];
  byGrupo: SmdSubcuentaRow[];
  options: SmdControlOptions;
};

type SmdCdpUnit = {
  noCdp: string;
  subcuenta: SmdSubcuenta;
  fuente: string;
  resolucion: string;
  alias: string;
  anio: string;
  grupo: string;
  estado: string;
  areaEjecutora: string;
  valorCdp: number;
  valorRc: number;
  valorPagado: number;
  valorPorPagar: number;
  corte: string;
  archivo: string;
};

function collapseSmdUnits(rows: RecordRow[]): SmdCdpUnit[] {
  const map = new Map<string, SmdCdpUnit>();
  for (const r of rows) {
    const noCdp = str(r, "no_cdp", "clave_seguimiento");
    if (!noCdp) continue;
    if (isCorteCupoRecord(r)) continue;
    if (!isTableroEjecucionRow(r)) continue;
    const subcuenta = parseSmdSubcuenta(str(r, "linea"));
    const next: SmdCdpUnit = {
      noCdp,
      subcuenta,
      fuente: str(r, "fuente") || "N/A",
      resolucion: str(r, "resolucion") || "N/A",
      alias: str(r, "alias"),
      anio: str(r, "fecha_cdp", "fecha").slice(0, 4),
      grupo: str(r, "grupo", "tipo_registro") || "OTROS",
      estado: str(r, "estado") || "—",
      areaEjecutora: str(r, "area_ejecutora") || "—",
      valorCdp: num(r, "valor_cdp", "valor"),
      valorRc: num(r, "valor_rc"),
      valorPagado: num(r, "valor_pagado"),
      valorPorPagar: num(r, "valor_por_pagar"),
      corte: str(r, "corte"),
      archivo: str(r, "_archivo_fuente"),
    };
    const prev = map.get(noCdp);
    if (!prev) {
      map.set(noCdp, next);
      continue;
    }
    prev.valorRc += next.valorRc;
    prev.valorPagado += next.valorPagado;
    prev.valorPorPagar += next.valorPorPagar;
    if (!prev.corte && next.corte) prev.corte = next.corte;
    if (!prev.archivo && next.archivo) prev.archivo = next.archivo;
  }
  return [...map.values()];
}

function countOptions(
  units: SmdCdpUnit[],
  pick: (u: SmdCdpUnit) => string,
): { value: string; label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const u of units) {
    const v = pick(u) || "N/A";
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function moneyRow(
  key: string,
  label: string,
  linea: string,
  acc: { n: number; cdp: number; rc: number; pag: number; por: number },
  cupos: Record<string, number>,
): SmdSubcuentaRow {
  const cupo = lookupCorteCupo(cupos, key, linea);
  const techo = cupo ?? 0;
  return {
    key,
    label,
    linea,
    cdpCount: acc.n,
    apropiacion: techo,
    cdp: acc.cdp,
    apropiacionDisponible: cupo == null ? 0 : cupo - acc.cdp,
    compromiso: acc.rc,
    pagado: acc.pag,
    porPagar: acc.por,
    saldoPorComprometer: acc.cdp - acc.rc,
    cupoFormulario: cupo != null,
    pctCdp: techo > 0 ? (acc.cdp / techo) * 100 : null,
    pctCompromiso: acc.cdp > 0 ? (acc.rc / acc.cdp) * 100 : null,
    pctPagado: acc.cdp > 0 ? (acc.pag / acc.cdp) * 100 : null,
    pctPorPagar: acc.cdp > 0 ? (acc.por / acc.cdp) * 100 : null,
  };
}

export function aggregateSmdControlBoard(
  rows: RecordRow[],
  filters: SmdControlFilters = EMPTY_SMD_CONTROL_FILTERS,
): SmdControlBoard {
  const units = collapseSmdUnits(rows);
  const subMap = new Map<string, SmdSubcuenta>();
  for (const u of units) subMap.set(u.subcuenta.key, u.subcuenta);
  const options: SmdControlOptions = {
    anios: [...new Set(units.map((u) => u.anio).filter(Boolean))].sort(),
    resoluciones: countOptions(units, (u) => u.resolucion),
    fuentes: countOptions(units, (u) => u.fuente),
    lineas: countOptions(units, (u) => u.subcuenta.linea || "N/A"),
    grupos: countOptions(units, (u) => u.grupo),
    estados: countOptions(units, (u) => u.estado),
    areas: countOptions(units, (u) => u.areaEjecutora),
    subcuentas: [...subMap.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "es"),
    ),
    cortes: [...new Set(units.map((u) => u.corte).filter(Boolean))],
  };

  const q = filters.q.trim().toLowerCase();
  const subSet = new Set(filters.subcuentas.filter(Boolean));
  const anioDesde = Number(filters.anioDesde) || 0;
  const visible = units.filter((u) => {
    if (filters.anio && u.anio !== filters.anio) return false;
    if (anioDesde && Number(u.anio) < anioDesde) return false;
    if (filters.resolucion && u.resolucion !== filters.resolucion) return false;
    if (filters.fuente && u.fuente !== filters.fuente) return false;
    if (filters.linea && (u.subcuenta.linea || "N/A") !== filters.linea) {
      return false;
    }
    if (filters.grupo && u.grupo !== filters.grupo) return false;
    if (filters.estado && u.estado !== filters.estado) return false;
    if (filters.areaEjecutora && u.areaEjecutora !== filters.areaEjecutora) {
      return false;
    }
    if (filters.subcuentas.includes("__none__")) return false;
    if (subSet.size && !subSet.has(u.subcuenta.key)) return false;
    if (q) {
      const blob = [
        u.noCdp,
        u.subcuenta.label,
        u.subcuenta.linea,
        u.fuente,
        u.resolucion,
        u.alias,
        u.grupo,
        u.estado,
        u.areaEjecutora,
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const emptyAcc = () => ({
    label: "",
    linea: "",
    n: 0,
    cdp: 0,
    rc: 0,
    pag: 0,
    por: 0,
  });
  const bySub = new Map<string, ReturnType<typeof emptyAcc>>();
  const byLin = new Map<string, ReturnType<typeof emptyAcc>>();
  const byGrp = new Map<string, ReturnType<typeof emptyAcc>>();
  let cdp = 0;
  let compromiso = 0;
  let pagado = 0;
  let porPagar = 0;
  const cortes = new Map<string, number>();
  const archivos = new Map<string, number>();

  for (const u of visible) {
    cdp += u.valorCdp;
    compromiso += u.valorRc;
    pagado += u.valorPagado;
    porPagar += u.valorPorPagar;
    if (u.corte) cortes.set(u.corte, (cortes.get(u.corte) || 0) + 1);
    if (u.archivo) archivos.set(u.archivo, (archivos.get(u.archivo) || 0) + 1);

    const s = bySub.get(u.subcuenta.key) || {
      ...emptyAcc(),
      label: u.subcuenta.label,
      linea: u.subcuenta.linea,
    };
    s.n += 1;
    s.cdp += u.valorCdp;
    s.rc += u.valorRc;
    s.pag += u.valorPagado;
    s.por += u.valorPorPagar;
    bySub.set(u.subcuenta.key, s);

    const linKey = u.subcuenta.linea || "N/A";
    const l = byLin.get(linKey) || {
      ...emptyAcc(),
      label: linKey,
      linea: linKey,
    };
    l.n += 1;
    l.cdp += u.valorCdp;
    l.rc += u.valorRc;
    l.pag += u.valorPagado;
    l.por += u.valorPorPagar;
    byLin.set(linKey, l);

    const gKey = u.grupo || "OTROS";
    const g = byGrp.get(gKey) || {
      ...emptyAcc(),
      label: gKey,
      linea: u.subcuenta.linea,
    };
    g.n += 1;
    g.cdp += u.valorCdp;
    g.rc += u.valorRc;
    g.pag += u.valorPagado;
    g.por += u.valorPorPagar;
    byGrp.set(gKey, g);
  }

  const corte =
    [...cortes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
    options.cortes[0] ||
    "";
  const archivo =
    [...archivos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const cupos = extractCorteCupos(rows, corte);
  const bySubcuenta = [...bySub.entries()]
    .map(([key, v]) => moneyRow(key, v.label, v.linea, v, cupos))
    .sort((a, b) => b.cdp - a.cdp);
  const byLinea = [...byLin.entries()]
    .map(([key, v]) => moneyRow(key, v.label, v.linea, v, cupos))
    .sort((a, b) => b.cdp - a.cdp);
  const byGrupo = [...byGrp.entries()]
    .map(([key, v]) => moneyRow(key, v.label, v.linea, v, {}))
    .sort((a, b) => b.cdp - a.cdp);

  const hasApropiacion = bySubcuenta.some((r) => r.cupoFormulario);
  const apropiacion = bySubcuenta.reduce(
    (s, r) => s + (r.cupoFormulario ? r.apropiacion : 0),
    0,
  );
  const cdpConCupo = bySubcuenta.reduce(
    (s, r) => s + (r.cupoFormulario ? r.cdp : 0),
    0,
  );
  const denom = apropiacion > 0 ? apropiacion : null;
  return {
    n: visible.length,
    cdpUnicos: visible.length,
    corte,
    archivo,
    apropiacion,
    hasApropiacion,
    cdp,
    apropiacionDisponible: hasApropiacion ? apropiacion - cdpConCupo : 0,
    compromiso,
    pagado,
    porPagar,
    saldoPorComprometer: cdp - compromiso,
    pctCdp: denom ? (cdpConCupo / denom) * 100 : null,
    pctCompromiso: cdp > 0 ? (compromiso / cdp) * 100 : null,
    pctPagado: cdp > 0 ? (pagado / cdp) * 100 : null,
    pctPorPagar: cdp > 0 ? (porPagar / cdp) * 100 : null,
    bySubcuenta,
    byLinea,
    byGrupo,
    options,
  };
}
