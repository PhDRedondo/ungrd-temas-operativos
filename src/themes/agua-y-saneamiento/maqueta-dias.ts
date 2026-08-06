/**
 * Cálculo de campos de días de la Maqueta (AY–BH, BT) desde Bitácora estado.
 *
 * Fórmulas alineadas al Excel (hoja `datos ordenados` · `conteo`, Maqueta General):
 *
 * - Por evento (ordenados por fecha_estado ASC):
 *   NETWORKDAYS(fecha_i, fecha_{i+1})  — o NETWORKDAYS(fecha_i, HOY) en el último.
 * - Por dependencia: suma de esos días donde dependencia = X → columnas AY–BF.
 * - dias_totales_en_la_linea: NETWORKDAYS(fecha_de_asignacion, fecha_de_pago | HOY).
 * - dias_en_gestion_de_pagos: NETWORKDAYS(
 *     min(fecha_estado donde estado = "Tramite de Solicitud de Pago"),
 *     fecha_de_pago | HOY).
 * - dias_desde_ult_gestion: NETWORKDAYS(última fecha_estado, HOY).
 *
 * NETWORKDAYS = días hábiles lun–vie (sin festivos), inclusivo en ambos extremos.
 */

export type BitacoraDiaEvent = {
  id?: string;
  fecha_estado?: unknown;
  fecha?: unknown;
  dependencia?: unknown;
  estado?: unknown;
};

/** Dependencia (bitácora) → campo Maqueta AY–BF */
export const DEPENDENCIA_TO_DIAS_FIELD: Record<string, string> = {
  "área técnica": "dias_en_tecnico",
  "area tecnica": "dias_en_tecnico",
  proveedor: "dias_en_proveedor",
  "área contractual": "dias_contractual",
  "area contractual": "dias_contractual",
  "área financiera": "dias_financiera",
  "area financiera": "dias_financiera",
  "subdirector smd": "dias_subdirector",
  "subdirector general": "dias_subdireccion_general",
  gafc: "dias_gafc",
  fiduprevisora: "dias_fiduprevisora",
};

export const DIAS_DEPENDENCIA_FIELDS = [
  "dias_en_tecnico",
  "dias_en_proveedor",
  "dias_contractual",
  "dias_financiera",
  "dias_subdirector",
  "dias_subdireccion_general",
  "dias_gafc",
  "dias_fiduprevisora",
] as const;

const ESTADO_SOLICITUD_PAGO = "tramite de solicitud de pago";

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normKey(s: unknown): string {
  return stripAccents(String(s || "").trim().toLowerCase()).replace(/\s+/g, " ");
}

/** Parsea YYYY-MM-DD (u ISO); ignora textos tipo "Sin Asignacion". */
export function parseYmd(value: unknown): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

/** Hoy en zona America/Bogota como Date UTC midnight. */
export function todayBogota(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseYmd(parts)!;
}

/**
 * Equivalente a NETWORKDAYS(start, end) de Excel sin lista de festivos.
 * Inclusivo en ambos extremos; negativo si start > end.
 */
export function networkDays(start: Date, end: Date): number {
  const startMs = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const endMs = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  if (startMs === endMs) {
    const dow = new Date(startMs).getUTCDay();
    return dow === 0 || dow === 6 ? 0 : 1;
  }
  const sign = startMs <= endMs ? 1 : -1;
  let a = Math.min(startMs, endMs);
  const b = Math.max(startMs, endMs);
  let count = 0;
  const dayMs = 86_400_000;
  while (a <= b) {
    const dow = new Date(a).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
    a += dayMs;
  }
  return sign * count;
}

function eventFecha(ev: BitacoraDiaEvent): Date | null {
  return parseYmd(ev.fecha_estado) || parseYmd(ev.fecha);
}

function fieldForDependencia(dep: unknown): string | null {
  const key = normKey(dep);
  if (!key) return null;
  return DEPENDENCIA_TO_DIAS_FIELD[key] || null;
}

export type MaquetaDiasResult = {
  /** AY–BF: siempre presentes (0 si no hay días en esa dep). */
  porDependencia: Record<(typeof DIAS_DEPENDENCIA_FIELDS)[number], number>;
  /** BG — solo si hay fecha_de_asignacion válida. */
  dias_totales_en_la_linea?: number;
  /** BH — solo si hay al menos un evento "Tramite de Solicitud de Pago". */
  dias_en_gestion_de_pagos?: number;
  /** BT */
  dias_desde_ult_gestion?: number;
};

/**
 * Calcula los campos de días de Maqueta a partir de eventos de Bitácora estado.
 */
export function computeAguaMaquetaDias(params: {
  events: BitacoraDiaEvent[];
  fechaAsignacion?: unknown;
  fechaPago?: unknown;
  /** Override de “hoy” (tests). Default: America/Bogota. */
  today?: Date;
}): MaquetaDiasResult | null {
  const today = params.today || todayBogota();
  const porDependencia = Object.fromEntries(
    DIAS_DEPENDENCIA_FIELDS.map((f) => [f, 0]),
  ) as MaquetaDiasResult["porDependencia"];

  const dated = params.events
    .map((ev) => ({ ev, fecha: eventFecha(ev) }))
    .filter((x): x is { ev: BitacoraDiaEvent; fecha: Date } => !!x.fecha)
    .sort((a, b) => {
      const da = a.fecha.getTime();
      const db = b.fecha.getTime();
      if (da !== db) return da - db;
      return String(a.ev.id || "").localeCompare(String(b.ev.id || ""));
    });

  if (!dated.length) return null;

  for (let i = 0; i < dated.length; i++) {
    const start = dated[i]!.fecha;
    const end = i + 1 < dated.length ? dated[i + 1]!.fecha : today;
    const days = networkDays(start, end);
    const field = fieldForDependencia(dated[i]!.ev.dependencia);
    if (field && field in porDependencia) {
      porDependencia[field as keyof typeof porDependencia] += days;
    }
  }

  const lastFecha = dated[dated.length - 1]!.fecha;
  const result: MaquetaDiasResult = {
    porDependencia,
    dias_desde_ult_gestion: networkDays(lastFecha, today),
  };

  const asignacion = parseYmd(params.fechaAsignacion);
  if (asignacion) {
    const fin = parseYmd(params.fechaPago) || today;
    result.dias_totales_en_la_linea = networkDays(asignacion, fin);
  }

  const pagoStarts = dated
    .filter((x) => normKey(x.ev.estado) === ESTADO_SOLICITUD_PAGO)
    .map((x) => x.fecha.getTime());
  if (pagoStarts.length) {
    const minPago = new Date(Math.min(...pagoStarts));
    const fin = parseYmd(params.fechaPago) || today;
    result.dias_en_gestion_de_pagos = networkDays(minPago, fin);
  }

  return result;
}
