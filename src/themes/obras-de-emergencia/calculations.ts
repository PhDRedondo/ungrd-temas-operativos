/**
 * Motor de indicadores (SPI / CPI / IRP) — port del tablero obras_emergencia.
 * Usa campos canónicos del tema Postgres (`fecha`, `avance_*`, `valor`).
 */

const MS_DAY = 86_400_000;

export const IRP_WEIGHT_SPI = 0.4;
export const IRP_WEIGHT_BRECHA = 0.35;
export const IRP_WEIGHT_CPI = 0.25;

export type ObrasIndicadores = {
  plazo_dias: number | null;
  pct_tiempo_transcurrido: number | null;
  brecha_fisica: number | null;
  spi: number | null;
  cpi: number | null;
  dias_restantes: number | null;
  alerta: "NORMAL" | "URGENTE";
  irp: number | null;
  riesgo: "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
};

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseDateInput(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return stripTime(v);
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return stripTime(new Date(t));
}

export function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = String(v).trim().replace(/\$/g, "").replace(/\s/g, "");
  if (/,\d{1,4}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Acepta 88, "88%", 0.88 → 88. */
export function toPctValue(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 0 && v <= 1) return v * 100;
    return v;
  }
  const cleaned = String(v)
    .trim()
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(cleaned.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function clamp01To100(x: number): number {
  return Math.min(100, Math.max(0, x));
}

export function scoreFromSpi(spi: number | null): number {
  if (spi == null || !Number.isFinite(spi) || spi <= 0) return 0;
  if (spi >= 1) return 0;
  return clamp01To100((1 / spi - 1) * 150);
}

export function scoreFromBrecha(brechaPct: number | null): number {
  if (brechaPct == null || !Number.isFinite(brechaPct)) return 0;
  if (brechaPct >= 0) return 0;
  return clamp01To100(-brechaPct * 1.5);
}

export function scoreFromCpi(cpi: number | null): number {
  if (cpi == null || !Number.isFinite(cpi) || cpi <= 0) return 0;
  if (cpi >= 1) return 0;
  return clamp01To100((1 / cpi - 1) * 80);
}

export function mapIrpToRiesgo(
  irp: number | null,
): ObrasIndicadores["riesgo"] {
  if (irp == null || !Number.isFinite(irp)) return "BAJO";
  if (irp <= 25) return "BAJO";
  if (irp <= 50) return "MEDIO";
  if (irp <= 75) return "ALTO";
  return "CRITICO";
}

export function computeIrp(
  spi: number | null,
  brechaFisica: number | null,
  cpi: number | null,
): number {
  const raw =
    IRP_WEIGHT_SPI * scoreFromSpi(spi) +
    IRP_WEIGHT_BRECHA * scoreFromBrecha(brechaFisica) +
    IRP_WEIGHT_CPI * scoreFromCpi(cpi);
  return clamp01To100(Math.round(raw));
}

export function isEnEjecucion(estado: unknown): boolean {
  const e = String(estado || "").trim().toLowerCase();
  return (
    e === "ejecución" ||
    e === "ejecucion" ||
    e === "en ejecución" ||
    e === "en ejecucion" ||
    /^en\s*ejecuci/i.test(String(estado || "").trim())
  );
}

type RowLike = Record<string, unknown>;

function pctFromRow(row: RowLike): {
  fisico: number | null;
  financiero: number | null;
} {
  const fisico =
    toPctValue(row.avance_fisico_ejecutado) ??
    toPctValue(row.porcentaje_avance_fisico_ejecutado) ??
    toPctValue(row.pct_avance_fisico);
  const financiero =
    toPctValue(row.avance_financiero_ejecutado) ??
    toPctValue(row.porcentaje_avance_financiero_ejecutado) ??
    toPctValue(row.pct_avance_financiero);
  return { fisico, financiero };
}

function fechasFromRow(row: RowLike): { ini: Date | null; fin: Date | null } {
  const ini =
    parseDateInput(row.fecha) ||
    parseDateInput(row.fecha_inicio_acta) ||
    parseDateInput(row.acta_de_inicio_fecha_inicial);
  const fin =
    parseDateInput(row.fecha_finalizacion_uno) ||
    parseDateInput(row.fecha_fin_contrato) ||
    parseDateInput(row.fecha_finalizacion) ||
    parseDateInput(row.acta_de_inicio_fecha_final);
  return { ini, fin };
}

/**
 * Calcula indicadores a partir de un registro (payload o RecordRow aplanado).
 */
export function calculateObrasIndicadores(
  row: RowLike,
  fechaReferencia: Date = new Date(),
): ObrasIndicadores {
  const ref = stripTime(fechaReferencia);
  const { ini, fin } = fechasFromRow(row);
  const { fisico: pctF, financiero: pctFn } = pctFromRow(row);

  let plazo_dias: number | null = null;
  if (ini && fin) {
    plazo_dias = Math.round((fin.getTime() - ini.getTime()) / MS_DAY);
    if (plazo_dias < 0) plazo_dias = null;
  }

  let pct_tiempo_transcurrido: number | null = null;
  if (ini && plazo_dias != null && plazo_dias > 0) {
    const elapsed = Math.round((ref.getTime() - ini.getTime()) / MS_DAY);
    pct_tiempo_transcurrido = (elapsed / plazo_dias) * 100;
  }

  let brecha_fisica: number | null = null;
  if (pctF != null && pct_tiempo_transcurrido != null) {
    brecha_fisica = pctF - pct_tiempo_transcurrido;
  }

  let spi: number | null = null;
  if (
    pctF != null &&
    pct_tiempo_transcurrido != null &&
    pct_tiempo_transcurrido !== 0
  ) {
    spi = pctF / pct_tiempo_transcurrido;
  }

  let cpi: number | null = null;
  if (pctF != null && pctFn != null && pctFn !== 0) {
    cpi = pctF / pctFn;
  }

  let dias_restantes: number | null = null;
  if (fin) {
    dias_restantes = Math.round((fin.getTime() - ref.getTime()) / MS_DAY);
  }

  let alerta: ObrasIndicadores["alerta"] = "NORMAL";
  if (
    dias_restantes != null &&
    dias_restantes <= 40 &&
    isEnEjecucion(row.estado)
  ) {
    alerta = "URGENTE";
  }

  const irp = computeIrp(spi, brecha_fisica, cpi);
  const riesgo = mapIrpToRiesgo(irp);

  return {
    plazo_dias,
    pct_tiempo_transcurrido,
    brecha_fisica,
    spi,
    cpi,
    dias_restantes,
    alerta,
    irp,
    riesgo,
  };
}
