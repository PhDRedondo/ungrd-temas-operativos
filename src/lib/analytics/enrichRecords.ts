/**
 * Enriquece registros de capas (bitácora/pagos) con geo y valor
 * tomados de la misma clave de seguimiento en maqueta/contrato.
 * No altera la BD: solo vista analítica para el tomador de decisión.
 */
import type { RecordRow } from "@/lib/records/types";
import { normalizeRecordGeo } from "@/lib/geo";

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

function canonicalizeRecordGeo(r: RecordRow): RecordRow {
  const geo = normalizeRecordGeo(
    String(r.departamento || ""),
    String(r.municipio || ""),
  );
  if (
    geo.departamento === String(r.departamento || "") &&
    geo.municipio === String(r.municipio || "")
  ) {
    return r;
  }
  return { ...r, departamento: geo.departamento, municipio: geo.municipio };
}

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
      const next =
        v > 0 && Number(r.valor || 0) <= 0 ? { ...r, valor: v } : r;
      return canonicalizeRecordGeo(next);
    }

    const next: RecordRow = { ...r };
    if (isEmptyDept(next.departamento) && fill.departamento) {
      next.departamento = fill.departamento;
    }
    if (isEmptyMun(next.municipio) && fill.municipio) {
      next.municipio = fill.municipio;
    }
    // No pisar un valor ya cargado (FIC: desembolso ≠ max de CDP/legalizado).
    const ownCol = numVal(r.valor);
    if (ownCol <= 0) {
      const valor = Math.max(bestValor(r), fill.valor);
      if (valor > 0) next.valor = valor;
    }
    return canonicalizeRecordGeo(next);
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
        { key: "no_cdp", label: "Nº CDP" },
        { key: "no_rc", label: "Nº RC" },
        { key: "formato_de_aprobacion_de_la_atencion", label: "Formato de aprobación" },
        { key: "acto_administrativo_otorgamiento_del_recurso", label: "Acto admin." },
        { key: "acto_administrativo_otorgamiento_del_recurso_2", label: "Acto admin. 2" },
        { key: "fecha_acto_administrativo_resolucion", label: "Fecha acto administrativo" },
        { key: "fecha_acto_administrativo_resolucion_2", label: "Fecha acto admin. 2" },
        { key: "fecha", label: "Fecha desembolso" },
        { key: "fecha_acto_administrativo_modificacion", label: "Fecha acto modificación" },
        {
          key: "porcentaje_de_avance_en_el_ejericicio_de_legalizacion",
          label: "% avance legalización",
        },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "estado", label: "Legalización", kind: "badge" },
        { key: "valor", label: "Valor desembolso", kind: "money" },
        { key: "valor_por_legalizar", label: "Por legalizar", kind: "money" },
        { key: "vigencia", label: "Vigencia" },
        { key: "plazo_ejecucion_dias", label: "Plazo inicial (días)" },
        { key: "plazo_adicion_dias", label: "Plazo prórroga (días)" },
        { key: "plazo_final_dias", label: "Plazo final (días)" },
        { key: "fecha_inicial_para_legalizacion", label: "Fecha inicial legalización" },
        { key: "fecha_final_para_legalizacion", label: "Fecha final legalización" },
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
        { key: "estado_de_pago", label: "Estado de pago", kind: "badge" },
        { key: "avance_fisico_ejecutado", label: "Avance físico %" },
        { key: "valor", label: "Valor", kind: "money" },
      ];
    case "obras-por-impuestos":
      return [
        { key: "clave_seguimiento", label: "Convenio / BPIN" },
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" },
        { key: "contribuyente", label: "Contribuyente" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "valor", label: "Valor convenio", kind: "money" },
        {
          key: "valor_convenio_de_interventoria",
          label: "Interventoría",
          kind: "money",
        },
        { key: "fecha_de_terminacion_del_convenio", label: "Fin convenio" },
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
    case "ejecucion-financiera":
      return [
        { key: "no_cdp", label: "No. CDP" },
        { key: "grupo", label: "Grupo" },
        { key: "departamento", label: "Departamento" },
        { key: "estado", label: "Estado", kind: "badge" },
        { key: "tipo", label: "Tipo" },
        { key: "no_rc", label: "No. RC" },
        { key: "fecha_cdp", label: "Fecha CDP" },
        { key: "fecha_final", label: "Fecha final" },
        { key: "valor_cdp", label: "Valor CDP", kind: "money" },
        { key: "valor_rc", label: "Valor RC", kind: "money" },
        { key: "valor_pagado", label: "Pagado", kind: "money" },
        { key: "valor_por_pagar", label: "Por pagar", kind: "money" },
        { key: "rubro", label: "Rubro" },
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
