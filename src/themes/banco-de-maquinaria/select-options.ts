/**
 * Listas de dominio Banco de Maquinaria (hoja `LISTAS` + variantes del Excel).
 * Incluye ortografías/valores observados para no rechazar cargas reales.
 */

/** Hoja LISTAS · CONVENIOS (+ variantes en bitácora / detalle). */
export const BMAQ_ESTADO_CONVENIO = [
  "EN ESTRUCTURACION",
  "ESTRUCTURACION",
  "EN EJECUCION",
  "en ejecucion",
  "EN LIQUIDACION",
  "ENTREGADO",
] as const;

/** Hoja LISTAS · ESTADO MAQUINARIA (+ variantes en detalle). */
export const BMAQ_ESTADO_MAQUINA = [
  "EN ORDEN DE COMPRA",
  "COMPRADA",
  "ENTREGADA",
  "EN COTIZACION",
] as const;

export const BMAQ_TIPO_MAQUINARIA = [
  "MAQUINARIA AMARILLA",
  "MAQUINAS DE BOMBEROS",
  "BOTES Y MOTORES PROVIDENCIA",
] as const;

export const BMAQ_MODALIDAD = [
  "CONVENIO",
  "CONTRARO TRANFERENCIA",
] as const;

/** Tipo de expediente en BASE ENTREGA BOMBEROS. */
export const BMAQ_TIPO_ENTREGA = [
  "BOMBEROS",
  "Botes y motores Providencia",
] as const;

/** Años de modelo (selector del alta). Rango estable para plantilla Excel. */
export const BMAQ_ANO_MODELO = Array.from({ length: 2031 - 1990 }, (_, i) =>
  String(1990 + i),
) as readonly string[];
