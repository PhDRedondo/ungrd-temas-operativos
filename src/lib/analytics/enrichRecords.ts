/**
 * Enriquece registros de capas (bitácora/pagos) con geo y valor
 * tomados de la misma clave de seguimiento en maqueta/contrato.
 * No altera la BD: solo vista analítica para el tomador de decisión.
 */
import type { RecordRow } from "@/lib/records/types";

const EMPTY_DEPT = /^(sin departamento|n\/?a|no registra|s\/?d)?$/i;
const EMPTY_MUN = /^(sin municipio|n\/?a|no registra|s\/?d)?$/i;

function isEmptyDept(v: unknown) {
  const s = String(v ?? "").trim();
  return !s || EMPTY_DEPT.test(s);
}

function isEmptyMun(v: unknown) {
  const s = String(v ?? "").trim();
  return !s || EMPTY_MUN.test(s);
}

/** Normaliza clave OP/placa/CDP: "SMD-… / pago 1" → "smd-…" */
export function normalizeTrackingKey(raw: unknown): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s) return "";
  return s.split("/")[0]!.trim().replace(/\s+/g, " ");
}

function numVal(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null || v === "") return 0;
  let t = String(v).trim().replace(/[$\s]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d+$/.test(t)) {
    t = t.replace(",", ".");
  } else {
    t = t.replace(/,/g, "");
  }
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function bestValor(r: RecordRow): number {
  const candidates = [
    r.valor,
    r.valor_pagado,
    r.valor_pagado_total_con_impuestos,
    r.valor_pagado_total,
    r.valor_cdp,
    r.valor_rc,
    r.valor_contrato,
    r.valor_convenio,
    r.valor_por_legalizar,
    r.valor_legalizado,
    r.valor_desembolso,
  ];
  let max = 0;
  for (const c of candidates) {
    const n = numVal(c);
    if (n > max) max = n;
  }
  return max;
}

type Canon = {
  departamento: string;
  municipio: string;
  valor: number;
};

/**
 * Cruza filas por clave_seguimiento / OP / placa / CDP para completar
 * departamento, municipio y valor cuando la capa no los trae.
 */
export function enrichRecordsForDecision(rows: RecordRow[]): RecordRow[] {
  if (!rows.length) return rows;

  const canon = new Map<string, Canon>();

  const touch = (key: string, patch: Partial<Canon>) => {
    if (!key) return;
    const cur = canon.get(key) || {
      departamento: "",
      municipio: "",
      valor: 0,
    };
    if (patch.departamento && !cur.departamento) {
      cur.departamento = patch.departamento;
    }
    if (patch.municipio && !cur.municipio) {
      cur.municipio = patch.municipio;
    }
    if (patch.valor && patch.valor > cur.valor) cur.valor = patch.valor;
    canon.set(key, cur);
  };

  for (const r of rows) {
    const key = normalizeTrackingKey(
      r.clave_seguimiento ||
        r.orden_de_proveeduria ||
        r.placa ||
        r.serial ||
        r.no_cdp ||
        r.no_convenio ||
        r.contrato_de_obra,
    );
    if (!key) continue;
    touch(key, {
      departamento: isEmptyDept(r.departamento)
        ? ""
        : String(r.departamento).trim(),
      municipio: isEmptyMun(r.municipio) ? "" : String(r.municipio).trim(),
      valor: bestValor(r),
    });
  }

  return rows.map((r) => {
    const key = normalizeTrackingKey(
      r.clave_seguimiento ||
        r.orden_de_proveeduria ||
        r.placa ||
        r.serial ||
        r.no_cdp ||
        r.no_convenio ||
        r.contrato_de_obra,
    );
    const fill = key ? canon.get(key) : undefined;
    if (!fill) {
      const v = bestValor(r);
      if (v > 0 && Number(r.valor || 0) <= 0) return { ...r, valor: v };
      return r;
    }

    const next: RecordRow = { ...r };
    if (isEmptyDept(next.departamento) && fill.departamento) {
      next.departamento = fill.departamento;
    }
    if (isEmptyMun(next.municipio) && fill.municipio) {
      next.municipio = fill.municipio;
    }
    const own = bestValor(r);
    const valor = Math.max(own, fill.valor);
    if (valor > 0) next.valor = valor;
    return next;
  });
}

export type PreviewColumn = {
  key: string;
  label: string;
  kind?: "text" | "money" | "badge";
};

/** Columnas de tabla útiles por tema (campos reales, no plantilla). */
export function previewColumnsForTheme(themeId: string): PreviewColumn[] {
  switch (themeId) {
    case "fic":
      return [
        { key: "clave_seguimiento", label: "No. CDP" },
        { key: "tipo_registro", label: "Capa" },
        { key: "departamento", label: "Departamento" },
        { key: "estado", label: "Legalización", kind: "badge" },
        { key: "valor", label: "Desembolso", kind: "money" },
        { key: "valor_por_legalizar", label: "Por legalizar", kind: "money" },
      ];
    case "agua-y-saneamiento":
      return [
        { key: "clave_seguimiento", label: "Orden / clave" },
        { key: "tipo_registro", label: "Capa" },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor OP", kind: "money" },
      ];
    case "carrotanques":
      return [
        { key: "clave_seguimiento", label: "Placa" },
        { key: "tipo_registro", label: "Capa" },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor / litros", kind: "money" },
      ];
    case "banco-de-maquinaria":
      return [
        { key: "clave_seguimiento", label: "Serial / placa" },
        { key: "tipo_registro", label: "Capa" },
        { key: "departamento", label: "Departamento" },
        { key: "tipo_maquinaria", label: "Tipo" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor", kind: "money" },
      ];
    case "obras-de-emergencia":
      return [
        { key: "clave_seguimiento", label: "Contrato / OP" },
        { key: "tipo_registro", label: "Capa" },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor", kind: "money" },
      ];
    case "obras-por-impuestos":
      return [
        { key: "clave_seguimiento", label: "Convenio / BPIN" },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor convenio", kind: "money" },
        { key: "fecha", label: "Fecha" },
      ];
    case "puentes":
      return [
        { key: "clave_seguimiento", label: "ID / lugar" },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Longitud / valor", kind: "money" },
        { key: "fecha", label: "Fecha" },
      ];
    case "declaratoria-de-emergencia":
      return [
        { key: "clave_seguimiento", label: "Nº declaratoria" },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor", kind: "money" },
        { key: "fecha", label: "Fecha" },
      ];
    default:
      return [
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "fecha", label: "Fecha" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor", kind: "money" },
      ];
  }
}
