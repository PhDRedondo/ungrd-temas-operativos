/**
 * Agregados del tablero — Obras por impuestos.
 */
import type { RecordRow } from "@/lib/records/types";
import {
  calculateImpuestosIndicadores,
  isEnEjecucion,
  toNum,
  type ObrasIndicadores,
} from "./calculations";

export type ImpuestosRowIndicadores = ObrasIndicadores & {
  key: string;
  valor: number;
  valorInterventoria: number;
  estado: string;
  departamento: string;
};

export type ImpuestosDashboardAggregate = {
  n: number;
  valorTotal: number;
  valorInterventoria: number;
  enEjecucion: number;
  urgentes: number;
  vencidos: number;
  irpElevado: number;
  irpCriticos: number;
  irpPromedio: number | null;
  spiMedio: number | null;
  porEstado: { name: string; count: number; valor: number }[];
  porDepartamento: { name: string; count: number; valor: number }[];
  rows: ImpuestosRowIndicadores[];
};

function rowValor(r: RecordRow): number {
  return toNum(r.valor) ?? toNum(r.valor_convenio) ?? 0;
}

function rowKey(r: RecordRow): string {
  const k = String(
    r.clave_seguimiento || r.no_convenio || r.bpin || "",
  ).trim();
  return k || "Sin convenio";
}

function isAbierto(estado: string): boolean {
  return !/finaliz|cerrad|terminad|liquidad/i.test(estado);
}

export function aggregateImpuestosDashboard(
  rows: RecordRow[],
  fechaReferencia: Date = new Date(),
): ImpuestosDashboardAggregate {
  const enriched: ImpuestosRowIndicadores[] = [];
  const estadoMap = new Map<string, { count: number; valor: number }>();
  const deptoMap = new Map<string, { count: number; valor: number }>();

  let valorTotal = 0;
  let valorInterventoria = 0;
  let enEjecucion = 0;
  let urgentes = 0;
  let vencidos = 0;
  let irpElevado = 0;
  let irpCriticos = 0;
  let irpSum = 0;
  let irpN = 0;
  let spiSum = 0;
  let spiN = 0;

  for (const r of rows) {
    const valor = rowValor(r);
    const valorInt = toNum(r.valor_convenio_de_interventoria) ?? 0;
    const estado = String(r.estado ?? "").trim();
    const departamento =
      String(r.departamento ?? "").trim() || "Sin departamento";
    const ind = calculateImpuestosIndicadores(
      r as Record<string, unknown>,
      fechaReferencia,
    );

    valorTotal += valor;
    valorInterventoria += valorInt;

    if (isEnEjecucion(estado) || /activo/i.test(estado)) enEjecucion += 1;
    if (ind.alerta === "URGENTE") urgentes += 1;
    if (
      ind.dias_restantes != null &&
      ind.dias_restantes < 0 &&
      isAbierto(estado)
    ) {
      vencidos += 1;
    }
    if (ind.riesgo === "CRITICO") irpCriticos += 1;
    if (ind.riesgo === "ALTO" || ind.riesgo === "CRITICO") irpElevado += 1;
    if (ind.irp != null && Number.isFinite(ind.irp)) {
      irpSum += ind.irp;
      irpN += 1;
    }
    if (ind.spi != null && Number.isFinite(ind.spi)) {
      spiSum += ind.spi;
      spiN += 1;
    }

    const estKey = estado || "Sin estado";
    const est = estadoMap.get(estKey) || { count: 0, valor: 0 };
    est.count += 1;
    est.valor += valor;
    estadoMap.set(estKey, est);

    const dep = deptoMap.get(departamento) || { count: 0, valor: 0 };
    dep.count += 1;
    dep.valor += valor;
    deptoMap.set(departamento, dep);

    enriched.push({
      ...ind,
      key: rowKey(r),
      valor,
      valorInterventoria: valorInt,
      estado,
      departamento,
    });
  }

  return {
    n: rows.length,
    valorTotal,
    valorInterventoria,
    enEjecucion,
    urgentes,
    vencidos,
    irpElevado,
    irpCriticos,
    irpPromedio: irpN > 0 ? Math.round(irpSum / irpN) : null,
    spiMedio: spiN > 0 ? spiSum / spiN : null,
    porEstado: [...estadoMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, valor: v.valor }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")),
    porDepartamento: [...deptoMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, valor: v.valor }))
      .sort((a, b) => b.valor - a.valor),
    rows: enriched,
  };
}
