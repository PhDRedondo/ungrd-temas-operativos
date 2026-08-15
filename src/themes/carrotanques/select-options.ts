/**
 * Listas de dominio Carrotanques (hojas `lista` / `listas` de las bases oficiales).
 */

export const CARRO_CLASIFICACION_PROPIEDAD = [
  "Propio-UNGRD",
  "Comodato",
  "Transferencia",
  "Donación",
] as const;

/** Hoja `listas` · Situación de Prestamo */
export const CARRO_SITUACION_PRESTAMO = [
  "En Prestamo",
  "Disponible",
  "CNL",
  "Comodato",
  "Transferencia",
  "No disponible",
] as const;

/** Hoja `listas` · Estado Carrotanque */
export const CARRO_ESTADO = [
  "Operativo",
  "Fuera de Servicio",
  "Por reportar",
  "No Operativo",
  "En retorno",
  "Pendiente mtto",
  "En mantenimieto",
] as const;

/** Hoja `listas` · Region */
export const CARRO_REGION = [
  "No Registra",
  "Amazonía",
  "Andina",
  "Caribe",
  "Insular",
  "Orinoquía",
  "Pacífica",
] as const;
