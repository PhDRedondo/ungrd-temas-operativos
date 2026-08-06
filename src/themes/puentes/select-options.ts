/**
 * Listas Puentes — extraídas de puentes 2.xlsx (Base General + bitácora).
 */
import type { FormField } from "../shared";
import { PUENTES_ORIGEN_ADQUISICION } from "./asset-keys";

export const PUENTES_ESTADO_PUENTE = [
  "Operativo",
  "En bodega",
  "Instalado",
  "Asignado",
  "Disponible",
] as const;

export const PUENTES_SITUACION_PRESTAMO = [
  "En prestamo",
  "En custodia",
  "No disponible",
  "Disponible",
  "Avalado para instalación",
] as const;

export const PUENTES_TIPO_VINCULO = [
  "contrato",
  "donacion",
  "otro",
] as const;

export const PUENTES_TIPO = ["3S-BRIDGE", "ACROW"] as const;

export const PUENTES_CLASE = ["Puente metálico modular"] as const;

export const PUENTES_CLASIFICACION_PROPIEDAD = [
  "Propio-UNGRD",
  "Ministerio de Defensa",
] as const;

export const PUENTES_REGION = ["Andina", "Caribe"] as const;

export const PUENTES_ESTRUCTURA_GRUPO = ["Puentes"] as const;

/**
 * Etapas del expediente (valores del Excel + ciclo operativo).
 * "Estructuración" es el valor oficial en Contratos Estructuración.
 */
export const PUENTES_ESTRUCTURA_ETAPA = [
  "Estructuración",
  "Precontractual",
  "Adjudicación",
  "Suscripción",
  "Ejecución",
  "Liquidación",
  "Registro inicial desde inventario",
] as const;

/**
 * Estado del proceso (campo Estado del Excel = «Estructuración»).
 * Se puede ir actualizando en el tiempo; queda versionado junto con la etapa.
 */
export const PUENTES_ESTRUCTURA_ESTADO = [
  "Estructuración",
  "En trámite",
  "Suspendido",
  "Terminado",
  "Liquidado",
  "Pendiente estructuración documental",
] as const;

export const PUENTES_ESTRUCTURA_AREA = [
  "Jurídica",
  "Técnica",
  "Contractual",
  "Financiera",
] as const;

export const PUENTES_ESTRUCTURA_TIPO = ["suministro"] as const;

export function applyPuentesSelectOptions<
  T extends { name: string; type: string; options?: string[] },
>(fields: T[]): T[] {
  const map: Record<string, readonly string[]> = {
    estado_puente: PUENTES_ESTADO_PUENTE,
    situacion_prestamo: PUENTES_SITUACION_PRESTAMO,
    tipo_vinculo: PUENTES_TIPO_VINCULO,
    origen_adquisicion: PUENTES_ORIGEN_ADQUISICION,
    tipo: PUENTES_TIPO,
    clase: PUENTES_CLASE,
    clasificacion_propiedad: PUENTES_CLASIFICACION_PROPIEDAD,
    region: PUENTES_REGION,
    grupo: PUENTES_ESTRUCTURA_GRUPO,
    etapa: PUENTES_ESTRUCTURA_ETAPA,
    // `estado` NO se mapea aquí: en inventario/Excel es texto libre legacy;
    // en Estructuración las opciones se aplican solo en el formulario (abajo).
    area: PUENTES_ESTRUCTURA_AREA,
    tipo_proceso: PUENTES_ESTRUCTURA_TIPO,
  };

  return fields.map((f) => {
    const opts = map[f.name];
    if (!opts?.length) return f;
    return {
      ...f,
      type: "select" as T["type"],
      options: [...opts],
    };
  });
}

/** Opciones de estado solo para el formulario de Estructuración. */
export function estadoOptionsForEstructuracion(): string[] {
  return [...PUENTES_ESTRUCTURA_ESTADO];
}
