/**
 * Siembra de la etapa raíz en la capa Estructuración.
 *
 * El orden de alimentación es proceso → puente → evento, pero las cargas
 * históricas trajeron puentes cuyo contrato/donación nunca se estructuró.
 * Aquí se formaliza ese nivel usando el contrato que ya viene en el inventario:
 * no se inventan procesos, se registra la raíz del que ya está referenciado.
 */
import { normalizeClaveProceso, inferTipoVinculo } from "./process-keys";

export const CAPA_ESTRUCTURACION = "Contrato estructuración";

/** Marca de la etapa creada por siembra (permite auditar y filtrar). */
export const ETAPA_SEED = "Registro inicial desde inventario";

export type ProcesoPendiente = {
  contrato: string;
  clave: string;
  tipoVinculo: string;
  puentes: string[];
  descripcion: string;
};

export type InventarioRef = {
  idPuente: string;
  contrato: string;
  descripcion?: string;
};

/**
 * Agrupa referencias de inventario por proceso, excluyendo los que ya
 * tienen etapa en Estructuración y los que no traen contrato.
 */
export function groupProcesosPendientes(
  refs: InventarioRef[],
  clavesYaEstructuradas: Set<string>,
): ProcesoPendiente[] {
  const byClave = new Map<string, ProcesoPendiente>();
  for (const ref of refs) {
    const contrato = ref.contrato.trim();
    if (!contrato) continue;
    const clave = normalizeClaveProceso(contrato);
    if (!clave || clavesYaEstructuradas.has(clave.toLowerCase())) continue;
    const prev = byClave.get(clave.toLowerCase());
    if (prev) {
      if (ref.idPuente) prev.puentes.push(ref.idPuente);
      if (!prev.descripcion && ref.descripcion) prev.descripcion = ref.descripcion;
      continue;
    }
    byClave.set(clave.toLowerCase(), {
      contrato,
      clave,
      tipoVinculo: inferTipoVinculo(contrato),
      puentes: ref.idPuente ? [ref.idPuente] : [],
      descripcion: ref.descripcion?.trim() || "",
    });
  }
  return [...byClave.values()].sort(
    (a, b) => b.puentes.length - a.puentes.length,
  );
}

/** Fila de Estructuración que representa la raíz del proceso. */
export function buildProcesoSeedRow(
  p: ProcesoPendiente,
): Record<string, unknown> {
  const muestra = p.puentes.slice(0, 10).join(", ");
  return {
    contrato_convenio: p.contrato,
    clave_proceso: p.clave,
    tipo_vinculo: p.tipoVinculo,
    descripcion_proceso: p.descripcion,
    etapa: ETAPA_SEED,
    estado: "Pendiente estructuración documental",
    departamento: "Bogotá D.C.",
    municipio: "Bogotá D.C.",
    observaciones:
      `Raíz del proceso creada a partir del inventario: ${p.puentes.length} puente(s)` +
      (muestra ? ` (${muestra}${p.puentes.length > 10 ? ", …" : ""})` : "") +
      ". Completar etapas reales del expediente.",
  };
}
