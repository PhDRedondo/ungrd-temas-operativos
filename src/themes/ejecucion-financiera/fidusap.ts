/**
 * Limpieza del reporte Fidusap → recorte SMD.
 * Oro: pestaña SMD (~834 CDP, incluye SDG). Si no existe, CDP extendido
 * filtrado a Área ejecutora = SMD o W = Manejo.
 * No persiste; lo usa la carga Excel del tema.
 */
import ExcelJS from "exceljs";
import { findDepartment } from "@/lib/geo";

export const FIDUSAP_SHEET_ALIASES = [
  "cdextendido",
  "cdpextendido",
  "cdp extendido",
  "general cdp extendido",
];

function isSmdTabName(name: string): boolean {
  return fold(name) === "SMD";
}

/** Columnas de la pestaña SMD (GRUPO viene del Excel; si falta, se infiere). */
export const SMD_FIELD_ORDER = [
  "no_cdp",
  "valor_cdp",
  "radicado_cdp",
  "solicitante",
  "area_ejecutora",
  "grupo",
  "descripcion",
  "fecha_cdp",
  "resolucion",
  "alias",
  "fuente",
  "linea",
  "nota",
  "rubro",
  "nacional_regional",
  "identificacion",
  "nombre",
  "no_rc",
  "fecha_rc",
  "estado",
  "tipo",
  "valor_rc",
  "contrato",
  "area_solicitante",
  "radicado_rc",
  "fecha_inicial",
  "fecha_final",
  "valor_pagado",
  "valor_por_pagar",
  "nombre_firma",
  "cargo_firma",
  "usuario",
] as const;

export type SmdField = (typeof SMD_FIELD_ORDER)[number];

export type FidusapParseMeta = {
  sheetName: string;
  headerRow: number;
  rawRows: number;
  keptRows: number;
  droppedNotSmd: number;
  fromSmdTab: boolean;
  byEjecutora: Record<string, number>;
};

function fold(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snakeHeader(raw: unknown): string {
  return fold(raw).toLowerCase().replace(/\s+/g, "_");
}

/** Columna W · Área solicitante = Subdirección de Manejo de Desastres (variantes Fidusap). */
export function isSmdAreaSolicitante(raw: unknown): boolean {
  const t = fold(raw);
  if (!t) return false;
  if (t === "SMD") return true;
  if (/\b(REDUCCION|CONOCIMIENTO)\b/.test(t) && !/MANEJO DE DESAST/.test(t)) {
    return false;
  }
  if (/SUBDIRECC?I[O0]N.*MANEJO.*DESAST/.test(t)) return true;
  if (/SUBDIRECCION DE MANEJO$/.test(t)) return true;
  if (/SUBDIRECCION PARA EL MANEJO/.test(t)) return true;
  if (/MANEJO DEL RIESGO/.test(t)) return true;
  return false;
}

/** Área ejecutora SMD, o W de Manejo si el reporte no trae pestaña SMD. */
export function isSmdCdpRow(raw: {
  area_ejecutora?: unknown;
  area_solicitante?: unknown;
}): boolean {
  if (fold(raw.area_ejecutora) === "SMD") return true;
  return isSmdAreaSolicitante(raw.area_solicitante);
}

export function inferGrupo(params: {
  rubro?: unknown;
  tipo?: unknown;
  descripcion?: unknown;
}): string {
  const t = fold(
    `${params.rubro ?? ""} ${params.tipo ?? ""} ${params.descripcion ?? ""}`,
  );
  if (!t) return "OTROS";
  if (/SUBSIDIO.*ARRIENDO|GIROS SUBSIDIOS ARRIENDO/.test(t)) return "SUB. ARRIENDOS";
  if (/HORAS MAQUINARIA|MAQUINARIA AMARILLA/.test(t)) return "MAQUINARIA";
  if (/AYUDA HUMANITARIA|ALIMENTARIA Y NO ALIMENTARIA/.test(t)) return "AHE";
  if (/AGUA POTABLE|SANEAMIENTO BASICO/.test(t)) return "AGUA";
  if (/OPERADOR LOGISTICO/.test(t)) return "LOGÍSTICO";
  if (/\bSEGUROS?\b/.test(t)) return "SEGU VOLUN";
  if (/\bPUENTE/.test(t)) return "PUENTES";
  if (/OBRA CIVIL|OBRAS DE EMERGENCIA/.test(t)) return "OBRAS DE EMERGENCIA";
  if (/TRANSFERENCIA ECONOMICA DIRECTA/.test(t)) return "FIC";
  if (/CONVENIO/.test(t)) return "CONVENIO";
  if (/PRESTACION DE SERVICIOS/.test(t)) return "HONORARIOS";
  if (/INTERVENTORIA/.test(t)) return "MAQUINARIA";
  return "OTROS";
}

export function parseFidusapMoney(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  let t = String(raw).trim().replace(/[$\s]/g, "");
  if (!t) return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{1,2}$/.test(t)) {
    t = t.replace(",", ".");
  } else {
    t = t.replace(/,/g, "");
  }
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Fecha Fidusap DD-MM-YYYY o Date Excel → YYYY-MM-DD. */
export function parseFidusapDate(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const d = dmy[1]!.padStart(2, "0");
    const m = dmy[2]!.padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }
  return "";
}

const HEADER_TO_FIELD: Record<string, SmdField> = {
  no_cdp: "no_cdp",
  valor_cdp: "valor_cdp",
  radicado_cdp: "radicado_cdp",
  solicitante: "solicitante",
  area_ejecutora: "area_ejecutora",
  grupo: "grupo",
  descripcion: "descripcion",
  fecha_cdp: "fecha_cdp",
  resolucion: "resolucion",
  alias: "alias",
  fuente: "fuente",
  linea: "linea",
  nota: "nota",
  rubro: "rubro",
  nacional_regional: "nacional_regional",
  identificacion: "identificacion",
  nombre: "nombre",
  no_rc: "no_rc",
  fecha_rc: "fecha_rc",
  estado: "estado",
  tipo: "tipo",
  valor_rc: "valor_rc",
  contrato: "contrato",
  area_solicitante: "area_solicitante",
  radicado_rc: "radicado_rc",
  fecha_inicial: "fecha_inicial",
  fecha_final: "fecha_final",
  valor_pagado: "valor_pagado",
  valor_por_pagar: "valor_por_pagar",
  nombre_firma: "nombre_firma",
  cargo_firma: "cargo_firma",
  usuario: "usuario",
};

function cellText(cell: ExcelJS.Cell): unknown {
  let v: unknown = cell.value;
  if (v && typeof v === "object" && "result" in (v as object)) {
    v = (v as { result: unknown }).result;
  }
  if (v && typeof v === "object" && "text" in (v as object) && (v as { text?: string }).text) {
    v = (v as { text: string }).text;
  }
  if (typeof v === "string") return v.trim();
  return v ?? "";
}

function pickSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const smdTab = wb.worksheets.find((ws) => isSmdTabName(ws.name));
  if (smdTab) return smdTab;
  return wb.worksheets.find((ws) => {
    const n = fold(ws.name).toLowerCase().replace(/\s+/g, "");
    return FIDUSAP_SHEET_ALIASES.some((a) => n.includes(a.replace(/\s+/g, "")));
  });
}

function isHeaderRow(values: unknown[]): boolean {
  const first = fold(values[0]);
  return first === "NO CDP" || first.startsWith("NO CDP");
}

function resolveDepartamento(nacionalRegional: string): string {
  const raw = String(nacionalRegional || "").trim();
  if (!raw) return "SIN DEPARTAMENTO";
  const t = fold(raw);
  if (!t || t === "NACIONAL" || t === "VARIOS") return "SIN DEPARTAMENTO";
  const dept = findDepartment(raw);
  return dept?.name || raw;
}

export function toSmdRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const grupo =
    String(raw.grupo ?? "").trim() ||
    inferGrupo({
      rubro: raw.rubro,
      tipo: raw.tipo,
      descripcion: raw.descripcion,
    });
  const fechaCdp = parseFidusapDate(raw.fecha_cdp);
  const valorCdp = parseFidusapMoney(raw.valor_cdp);
  const valorRc = parseFidusapMoney(raw.valor_rc);
  const valorPagado = parseFidusapMoney(raw.valor_pagado);
  const valorPorPagar = parseFidusapMoney(raw.valor_por_pagar);
  const noCdp = String(raw.no_cdp ?? "").trim();
  const estado = String(raw.estado ?? "").trim() || (String(raw.no_rc ?? "").trim() ? "Asignado" : "Sin RC");
  const depto = resolveDepartamento(String(raw.nacional_regional ?? ""));

  return {
    ...Object.fromEntries(
      SMD_FIELD_ORDER.map((k) => {
        if (k === "grupo") return [k, grupo];
        if (k === "fecha_cdp") return [k, fechaCdp];
        if (k === "fecha_rc") return [k, parseFidusapDate(raw.fecha_rc)];
        if (k === "fecha_inicial") return [k, parseFidusapDate(raw.fecha_inicial)];
        if (k === "fecha_final") return [k, parseFidusapDate(raw.fecha_final)];
        if (k === "valor_cdp") return [k, valorCdp];
        if (k === "valor_rc") return [k, valorRc];
        if (k === "valor_pagado") return [k, valorPagado];
        if (k === "valor_por_pagar") return [k, valorPorPagar];
        const v = raw[k];
        return [k, v == null ? "" : typeof v === "string" ? v.trim() : v];
      }),
    ),
    no_cdp: noCdp,
    clave_seguimiento: noCdp,
    tipo_registro: grupo,
    capa: grupo,
    departamento: depto,
    municipio: "SIN MUNICIPIO",
    fecha: fechaCdp || parseFidusapDate(raw.fecha_rc) || parseFidusapDate(raw.fecha_inicial),
    estado,
    valor: valorCdp,
    observaciones: String(raw.nota ?? "").trim(),
  };
}

export async function parseFidusapCdpExtendido(
  buffer: ArrayBuffer | Buffer,
): Promise<{
  rows: Record<string, unknown>[];
  meta: FidusapParseMeta & { themeHint: string };
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  const sheet = pickSheet(wb);
  if (!sheet) {
    const names = wb.worksheets.map((w) => w.name).join(", ");
    throw new Error(
      `No se encontró la pestaña SMD ni la hoja CDP extendido de Fidusap (cdextendido / cdpextendido). Hojas: ${names || "ninguna"}.`,
    );
  }
  const fromSmdTab = isSmdTabName(sheet.name);

  const matrix: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const vals: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      vals[col - 1] = cellText(cell);
    });
    matrix.push(vals);
  });

  const headerIdx = matrix.findIndex(isHeaderRow);
  if (headerIdx < 0) {
    throw new Error(
      `La hoja "${sheet.name}" no tiene la fila de encabezados (No CDP). Suba el reporte tal como sale de Fidusap.`,
    );
  }
  const header = matrix[headerIdx] || [];
  const colMap: { col: number; field: SmdField }[] = [];
  header.forEach((h, col) => {
    const field = HEADER_TO_FIELD[snakeHeader(h)];
    if (field) colMap.push({ col, field });
  });
  const areaCol = colMap.find((c) => c.field === "area_solicitante")?.col;
  if (areaCol == null) {
    throw new Error(
      `La hoja "${sheet.name}" no trae Área solicitante (columna W).`,
    );
  }

  const rows: Record<string, unknown>[] = [];
  const byEjecutora: Record<string, number> = {};
  let droppedNotSmd = 0;
  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    const line = matrix[i] || [];
    const raw: Record<string, unknown> = {};
    for (const { col, field } of colMap) {
      raw[field] = line[col] ?? "";
    }
    if (!String(raw.no_cdp ?? "").trim()) continue;
    if (!fromSmdTab && !isSmdCdpRow(raw)) {
      droppedNotSmd += 1;
      continue;
    }
    const rec = toSmdRecord(raw);
    const eje = String(rec.area_ejecutora ?? "").trim() || "(vacío)";
    byEjecutora[eje] = (byEjecutora[eje] || 0) + 1;
    rows.push(rec);
  }

  return {
    rows,
    meta: {
      sheetName: sheet.name,
      headerRow: headerIdx + 1,
      rawRows: matrix.length - headerIdx - 1,
      keptRows: rows.length,
      droppedNotSmd,
      fromSmdTab,
      byEjecutora,
      themeHint: "fidusap-smd",
    },
  };
}

/** Texto del recorte para validación / carga (misma lógica que el parser). */
export function describeFidusapRecorte(
  meta: Pick<
    FidusapParseMeta,
    "sheetName" | "keptRows" | "droppedNotSmd" | "fromSmdTab" | "byEjecutora"
  >,
): string {
  const eje = Object.entries(meta.byEjecutora || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${k}`)
    .join(" + ");
  if (meta.fromSmdTab) {
    return `Se tomó la pestaña SMD tal cual: ${meta.keptRows} CDP${eje ? ` (${eje})` : ""}. Ese recorte ya viene filtrado en el Excel; no se vuelve a recortar por columna W. Cada carga reemplaza el corte anterior.`;
  }
  const extra = meta.droppedNotSmd
    ? ` Se descartaron ${meta.droppedNotSmd} filas de otras áreas.`
    : "";
  return `No había pestaña SMD; se filtró la hoja ${meta.sheetName}: ${meta.keptRows} CDP${eje ? ` (${eje})` : ""}.${extra} Cada carga reemplaza el corte anterior.`;
}
