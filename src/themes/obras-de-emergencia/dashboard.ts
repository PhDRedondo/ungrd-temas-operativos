/**
 * Agregados del tablero ejecutivo (zip SMD App.jsx KPIs).
 * Solo lectura sobre filas; no persiste ni altera schema Excel.
 */
import type { RecordRow } from "@/lib/records/types";
import {
  calculateObrasIndicadores,
  isEnEjecucion,
  toNum,
  toPctValue,
  type ObrasIndicadores,
} from "./calculations";

export type ObrasRowIndicadores = ObrasIndicadores & {
  key: string;
  valor: number;
  estado: string;
  pago: string;
  departamento: string;
  avanceFisico: number | null;
};

export type ObrasDashboardAggregate = {
  n: number;
  valorTotal: number;
  anticipo: number;
  enEjecucion: number;
  urgentes: number;
  irpCriticos: number;
  irpElevado: number;
  pagoRiesgo: number;
  irpPromedio: number | null;
  spiMedio: number | null;
  /** Avance físico ponderado por valor contractual (0–100). */
  avancePonderado: number | null;
  porEstado: { name: string; count: number; valor: number }[];
  porDepartamento: { name: string; count: number; valor: number; ejecutado: number }[];
  rows: ObrasRowIndicadores[];
};

function rowValor(r: RecordRow): number {
  return (
    toNum(r.valor) ??
    toNum(r.valor_final_contrato) ??
    toNum(r.valor_contrato) ??
    0
  );
}

function rowKey(r: RecordRow): string {
  const k = String(
    r.clave_seguimiento ||
      r.contrato_de_obra ||
      r.orden_de_proveeduria ||
      r.numero_convenio ||
      "",
  ).trim();
  return k || "Sin contrato/OP";
}

function rowAvanceFisico(r: RecordRow): number | null {
  return (
    toPctValue(r.avance_fisico_ejecutado) ??
    toPctValue(r.porcentaje_avance_fisico_ejecutado) ??
    toPctValue(r.pct_avance_fisico)
  );
}

function isPagoRiesgo(pago: string): boolean {
  return /pend|mora|atras|sin pago|crit/i.test(pago);
}

/**
 * Calcula indicadores por fila + KPIs del resumen ejecutivo SMD.
 */
export function aggregateObrasDashboard(
  rows: RecordRow[],
  fechaReferencia: Date = new Date(),
): ObrasDashboardAggregate {
  const enriched: ObrasRowIndicadores[] = [];
  const estadoMap = new Map<string, { count: number; valor: number }>();
  const deptoMap = new Map<
    string,
    { count: number; valor: number; ejecutado: number }
  >();

  let valorTotal = 0;
  let anticipo = 0;
  let enEjecucion = 0;
  let urgentes = 0;
  let irpCriticos = 0;
  let irpElevado = 0;
  let pagoRiesgo = 0;
  let irpSum = 0;
  let irpN = 0;
  let spiSum = 0;
  let spiN = 0;
  let wAvNum = 0;
  let wAvDen = 0;

  for (const r of rows) {
    const valor = rowValor(r);
    const estado = String(r.estado ?? "").trim();
    const pago = String(r.estado_de_pago ?? "").trim();
    const departamento = String(r.departamento ?? "").trim() || "Sin departamento";
    const avanceFisico = rowAvanceFisico(r);
    const ind = calculateObrasIndicadores(
      r as Record<string, unknown>,
      fechaReferencia,
    );

    valorTotal += valor;
    anticipo += toNum(r.valor_anticipo) ?? 0;

    if (isEnEjecucion(estado) || /activo/i.test(estado)) enEjecucion += 1;
    if (ind.alerta === "URGENTE") urgentes += 1;
    if (ind.riesgo === "CRITICO") irpCriticos += 1;
    if (ind.riesgo === "ALTO" || ind.riesgo === "CRITICO") irpElevado += 1;
    if (isPagoRiesgo(pago)) pagoRiesgo += 1;

    if (ind.irp != null && Number.isFinite(ind.irp)) {
      irpSum += ind.irp;
      irpN += 1;
    }
    if (ind.spi != null && Number.isFinite(ind.spi)) {
      spiSum += ind.spi;
      spiN += 1;
    }
    if (valor > 0) {
      wAvDen += valor;
      wAvNum += (avanceFisico != null ? avanceFisico : 0) * valor;
    }

    const estKey = estado || "Sin estado";
    const est = estadoMap.get(estKey) || { count: 0, valor: 0 };
    est.count += 1;
    est.valor += valor;
    estadoMap.set(estKey, est);

    const ejecutadoFrac =
      avanceFisico != null && Number.isFinite(avanceFisico)
        ? (avanceFisico / 100) * valor
        : 0;
    const dep = deptoMap.get(departamento) || {
      count: 0,
      valor: 0,
      ejecutado: 0,
    };
    dep.count += 1;
    dep.valor += valor;
    dep.ejecutado += ejecutadoFrac;
    deptoMap.set(departamento, dep);

    enriched.push({
      ...ind,
      key: rowKey(r),
      valor,
      estado,
      pago,
      departamento,
      avanceFisico,
    });
  }

  const porEstado = [...estadoMap.entries()]
    .map(([name, v]) => ({ name, count: v.count, valor: v.valor }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  const porDepartamento = [...deptoMap.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      valor: v.valor,
      ejecutado: v.ejecutado,
    }))
    .sort((a, b) => b.valor - a.valor);

  return {
    n: rows.length,
    valorTotal,
    anticipo,
    enEjecucion,
    urgentes,
    irpCriticos,
    irpElevado,
    pagoRiesgo,
    irpPromedio: irpN > 0 ? Math.round(irpSum / irpN) : null,
    spiMedio: spiN > 0 ? spiSum / spiN : null,
    avancePonderado: wAvDen > 0 ? wAvNum / wAvDen : null,
    porEstado,
    porDepartamento,
    rows: enriched,
  };
}
