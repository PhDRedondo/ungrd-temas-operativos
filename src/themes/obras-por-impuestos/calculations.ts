/**
 * Indicadores de plazo / IRP para obras por impuestos.
 * Reutiliza el motor SPI/CPI/IRP de emergencia mapeando fechas del convenio.
 */
import {
  calculateObrasIndicadores,
  isEnEjecucion,
  toNum,
  toPctValue,
  type ObrasIndicadores,
} from "@/themes/obras-de-emergencia/calculations";

export { isEnEjecucion, toNum, toPctValue };
export type { ObrasIndicadores };

/** Normaliza fila impuestos → campos que entiende calculateObrasIndicadores. */
export function mapImpuestosRowForIndicators(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...row,
    fecha:
      row.fecha_de_inicio_del_convenio ||
      row.fecha_de_activacion ||
      row.fecha ||
      row.fecha_inicio_acta,
    fecha_finalizacion_uno:
      row.fecha_de_terminacion_del_convenio ||
      row.fecha_finalizacion ||
      row.fecha_fin_contrato ||
      row.fecha_finalizacion_uno,
    // Avances: el Excel ArcGIS no siempre los trae; si aparecen, se usan.
    avance_fisico_ejecutado:
      row.avance_fisico_ejecutado ??
      row.porcentaje_avance_fisico_ejecutado ??
      row.pct_avance_fisico,
    avance_financiero_ejecutado:
      row.avance_financiero_ejecutado ??
      row.porcentaje_avance_financiero_ejecutado ??
      row.pct_avance_financiero,
    estado: row.estado,
  };
}

export function calculateImpuestosIndicadores(
  row: Record<string, unknown>,
  fechaReferencia: Date = new Date(),
): ObrasIndicadores {
  return calculateObrasIndicadores(
    mapImpuestosRowForIndicators(row),
    fechaReferencia,
  );
}
