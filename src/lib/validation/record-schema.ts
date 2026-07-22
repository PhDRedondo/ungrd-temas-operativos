import { createHash } from "crypto";
import { z } from "zod";
import type { FormField, ThemeConfig } from "@/themes/shared/types";
import { findDepartment, isValidMunicipio } from "@/lib/geo";

const FIXED_KEYS = new Set([
  "departamento",
  "municipio",
  "fecha",
  "estado",
  "valor",
  "observaciones",
]);

/** Rellena columnas fijas y clave_seguimiento desde alias de maqueta/bitácora. */
export function fillFixedAliases(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...data };
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = out[k];
      if (v !== null && v !== undefined && String(v).trim() !== "") return v;
    }
    return undefined;
  };
  if (!out.estado || String(out.estado).trim() === "") {
    const v = pick(
      "estado_actual_detallado",
      "estado_actual",
      "estado_actual_de_la_obra",
      "estado_carrotanque",
      "estado_del_convenio_obra_por_impuesto",
      "estado_de_ejecucion",
      "estado_macro",
      "proceso_actual",
      "estado_en_terminos_de_legalizacion_ungrd",
    );
    if (v !== undefined) out.estado = v;
  }
  if (!out.fecha || String(out.fecha).trim() === "") {
    const v = pick(
      "fecha_de_instalacion",
      "fecha_inicio",
      "fecha_de_inicio",
      "fecha_inicio_orden",
      "fecha_sucripcion",
      "fecha_de_recibo",
      "fecha_inicio_del_convenio",
      "fecha_estado",
      "fecha_del_estado",
      "fecha_corte_del_reporte",
      "fecha_del_reporte",
      "fecha_de_estado",
      "fecha_de_pago",
      "fecha_de_desembolso",
    );
    if (v !== undefined) out.fecha = v;
  }
  if (out.valor === undefined || out.valor === "" || out.valor === null) {
    const v = pick(
      "valor_contrato",
      "valor_de_la_orden",
      "valor_convenio",
      "valorop",
      "valor_op",
      "valor_unitario",
      "valor_total",
      "valor_pagado",
      "valor_desemboloso",
      "valor_desembolso",
      "capacidad",
      "no_beneficiarios",
      "longitud_puente",
      "litros_suministrados",
      "lt_suministrados",
    );
    if (v !== undefined) out.valor = v;
  }
  if (!out.municipio || String(out.municipio).trim() === "") {
    out.municipio = "SIN MUNICIPIO";
  }
  if (!out.departamento || String(out.departamento).trim() === "") {
    out.departamento = "SIN DEPARTAMENTO";
  }

  // Clave de seguimiento para cruces maqueta ↔ bitácora ↔ pagos
  if (!out.clave_seguimiento || String(out.clave_seguimiento).trim() === "") {
    const v = pick(
      "orden_de_proveeduria",
      "placa",
      "placa_ungrd",
      "serial",
      "no_maquina",
      "no_convenio",
      "no_convenio_o_proceso",
      "contrato_de_obra",
      "contrato_de_adquisicion_o_convenio",
      "no_declaratoria",
      "no_cdp",
      "no_rc",
      "id",
    );
    if (v !== undefined) out.clave_seguimiento = String(v).trim();
  }

  // Normalizar OP / placa hacia campos canónicos
  if (!out.orden_de_proveeduria) {
    const v = pick("op", "op2", "consecutivo_orden_de_proveeduria");
    if (v !== undefined) out.orden_de_proveeduria = v;
  }
  if (!out.placa) {
    const v = pick("placas", "placa_ungrd");
    if (v !== undefined) out.placa = v;
  }

  return out;
}

/** Normaliza fechas Excel (serial o M/D/YYYY) → YYYY-MM-DD */
export function normalizeDateInput(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const mm = mdy[1]!.padStart(2, "0");
    const dd = mdy[2]!.padStart(2, "0");
    return `${mdy[3]}-${mm}-${dd}`;
  }
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmy) {
    const dd = dmy[1]!.padStart(2, "0");
    const mm = dmy[2]!.padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return s;
}

export type RowValidationError = {
  row: number;
  field: string;
  code: string;
  message: string;
};

export function schemaFingerprint(theme: ThemeConfig): string {
  const payload = JSON.stringify({
    id: theme.id,
    version: theme.schemaVersion ?? 1,
    fields: theme.fields.map((f) => ({
      name: f.name,
      type: f.type,
      required: !!f.required,
      options: f.options ?? null,
      min: f.min ?? null,
      max: f.max ?? null,
    })),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/** Huella de negocio para deduplicar filas en un tema. */
export function rowContentHash(
  themeId: string,
  data: Record<string, unknown>,
): string {
  const keys = Object.keys(data).sort();
  const normalized: Record<string, unknown> = {};
  for (const k of keys) {
    if (k === "id" || k === "observaciones") continue;
    const v = data[k];
    if (v === undefined || v === null || v === "") continue;
    normalized[k] = typeof v === "string" ? v.trim().toLowerCase() : v;
  }
  return createHash("sha256")
    .update(themeId + "|" + JSON.stringify(normalized))
    .digest("hex");
}

function parseLooseNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  let s = String(v).trim().replace(/\s/g, "").replace(/\$/g, "");
  if (!s || /^n\/?a$/i.test(s) || s === "-" || s === "—") return undefined;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function fieldZod(field: FormField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "number": {
      schema = z.preprocess((v) => {
        if (v === null || v === undefined || v === "") return undefined;
        const n = parseLooseNumber(v);
        // basura no numérica → undefined si opcional; NaN si obligatorio
        return n;
      }, z.number({ error: `${field.label} debe ser numérico` }));
      break;
    }
    case "date": {
      schema = z.preprocess((v) => {
        if (v === null || v === undefined || v === "") return undefined;
        const d = normalizeDateInput(v);
        if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
        // rechazar fechas calendario inválidas (ej. 2025-21-11)
        const [y, m, day] = d.split("-").map(Number);
        const dt = new Date(Date.UTC(y!, m! - 1, day!));
        if (
          dt.getUTCFullYear() !== y ||
          dt.getUTCMonth() !== m! - 1 ||
          dt.getUTCDate() !== day
        ) {
          return undefined;
        }
        return d;
      }, z.union([z.string(), z.undefined()]));
      break;
    }
    case "select": {
      if (field.options?.length) {
        schema = z.enum(field.options as [string, ...string[]], {
          error: `${field.label} no es un valor permitido`,
        });
      } else {
        schema = z.preprocess(
          (v) => (v == null ? "" : String(v).trim()),
          z.string().min(1, `${field.label} es obligatorio`),
        );
      }
      break;
    }
    case "textarea":
    case "text":
    default: {
      schema = z.preprocess(
        (v) => (v == null ? "" : String(v).trim()),
        field.required
          ? z.string().min(1, `${field.label} es obligatorio`)
          : z.string(),
      );
      if (field.pattern) {
        schema = z.preprocess(
          (v) => (v == null ? "" : String(v).trim()),
          z.string().regex(new RegExp(field.pattern)),
        );
      }
      break;
    }
  }

  if (!field.required) {
    return z.preprocess((v) => {
      if (v === null || v === undefined || v === "") return undefined;
      if (field.type === "number") {
        const n = parseLooseNumber(v);
        return n; // basura → undefined → optional OK
      }
      return v;
    }, schema.optional());
  }
  return schema;
}

export function buildRecordZod(theme: ThemeConfig) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of theme.fields) {
    shape[field.name] = fieldZod(field);
  }
  return z.object(shape).superRefine((data, ctx) => {
    const dept = String(data.departamento ?? "").trim();
    const muni = String(data.municipio ?? "").trim();
    if (!dept) return;

    // schemaVersion >= 2: fuentes ArcGIS — validación DIVIPOLA permisiva
    const strict = (theme.schemaVersion ?? 1) < 2;
    if (!findDepartment(dept)) {
      if (strict) {
        ctx.addIssue({
          code: "custom",
          path: ["departamento"],
          message: `Departamento no está en DIVIPOLA: ${dept}`,
        });
      }
      return;
    }
    if (strict && muni && !isValidMunicipio(dept, muni)) {
      ctx.addIssue({
        code: "custom",
        path: ["municipio"],
        message: `Municipio "${muni}" no pertenece a ${dept} (DIVIPOLA)`,
      });
    }
  });
}

export type ValidatedRecord = {
  departamento: string;
  municipio: string;
  fecha: string;
  estado: string;
  valor: number;
  payload: Record<string, string | number>;
  raw: Record<string, string | number>;
  contentHash: string;
};

export function normalizeValidated(
  theme: ThemeConfig,
  data: Record<string, unknown>,
): ValidatedRecord {
  const raw: Record<string, string | number> = {};
  for (const field of theme.fields) {
    const v = data[field.name];
    if (field.type === "number") {
      raw[field.name] = Number(v ?? 0);
    } else {
      raw[field.name] = String(v ?? "").trim();
    }
  }

  const valor = Number(raw.valor ?? raw.cantidad ?? raw.beneficiarios ?? 0);

  const payload: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!FIXED_KEYS.has(k)) payload[k] = v;
  }
  if (raw.observaciones !== undefined) {
    payload.observaciones = raw.observaciones;
  }

  // Garantizar clave de seguimiento para cruces maqueta ↔ bitácora
  if (!payload.clave_seguimiento || String(payload.clave_seguimiento).trim() === "") {
    const key = [
      raw.orden_de_proveeduria,
      raw.placa,
      raw.serial,
      raw.no_maquina,
      raw.no_convenio,
      raw.contrato_de_obra,
      raw.no_declaratoria,
      raw.no_cdp,
      raw.no_rc,
      raw.id,
    ].find((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (key !== undefined) payload.clave_seguimiento = String(key).trim();
  }

  const base = {
    departamento: String(raw.departamento || ""),
    municipio: String(raw.municipio || ""),
    fecha: String(raw.fecha || new Date().toISOString().slice(0, 10)),
    estado: String(raw.estado || "Programado"),
    valor: Number.isFinite(valor) ? valor : 0,
    payload,
    raw,
  };

  return {
    ...base,
    contentHash: rowContentHash(theme.id, {
      ...raw,
      departamento: base.departamento,
      municipio: base.municipio,
      fecha: base.fecha,
      estado: base.estado,
      valor: base.valor,
    }),
  };
}

export function validateRow(
  theme: ThemeConfig,
  raw: Record<string, unknown>,
  rowNumber: number,
):
  | { ok: true; data: ValidatedRecord }
  | { ok: false; errors: RowValidationError[] } {
  const cleaned: Record<string, unknown> = {};
  const filled = fillFixedAliases(raw);
  for (const field of theme.fields) {
    let v = filled[field.name];
    if (v === null || v === undefined) v = "";
    if (typeof v === "string") v = v.trim();
    if (!field.required && (v === "" || v === undefined)) {
      cleaned[field.name] = field.type === "number" ? undefined : "";
      continue;
    }
    if (field.type === "date" && typeof v === "number") {
      v = normalizeDateInput(v);
    }
    cleaned[field.name] = v;
  }

  const schema = buildRecordZod(theme);
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const errors: RowValidationError[] = parsed.error.issues.map((issue) => ({
      row: rowNumber,
      field: String(issue.path[0] ?? "_"),
      code: issue.code.toUpperCase(),
      message: issue.message,
    }));
    return { ok: false, errors };
  }
  return { ok: true, data: normalizeValidated(theme, parsed.data) };
}
