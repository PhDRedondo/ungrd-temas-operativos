/**
 * Campos Puentes — puentes 2.xlsx (Base General, bitácora, Contratos Estructuracion).
 * schemaVersion 4: multi-capa + id_puente + clave_proceso.
 */
import type { FormField } from "../shared";
import { applyPuentesSelectOptions } from "./select-options";

const CAPA_OPTIONS = [
  "Inventario puente",
  "Bitácora estado",
  "Contrato estructuración",
] as const;

const RAW_FIELDS: FormField[] = [
  {
    name: "tipo_registro",
    label: "Tipo de registro",
    type: "select",
    required: true,
    options: [...CAPA_OPTIONS],
    excelWidth: 24,
  },
  {
    name: "capa",
    label: "Capa",
    type: "select",
    required: true,
    options: [...CAPA_OPTIONS],
    excelWidth: 22,
  },
  {
    name: "clave_seguimiento",
    label: "Clave de seguimiento (ID)",
    type: "text",
    excelWidth: 28,
  },
  {
    name: "id_puente",
    label: "ID",
    type: "text",
    excelWidth: 12,
  },
  /**
   * Alias del ID corto (Excel columna «ID» / primera columna ID).
   * No es la última columna «ID UNICO» — esa va en `codigo_operativo`.
   */
  { name: "id_unico", label: "ID", type: "text", excelWidth: 12 },
  /** Alias legacy ArcGIS / Excel columna ID (mismo valor corto que `id_puente`). */
  { name: "id", label: "ID", type: "text", excelWidth: 12 },

  // ── Llaves derivadas (calculadas, no se capturan a mano) ──
  {
    name: "codigo_operativo",
    label: "ID UNICO",
    type: "text",
    excelWidth: 36,
  },
  {
    name: "numero_unidad",
    label: "N° unidad en el proceso",
    type: "number",
    excelWidth: 16,
  },
  {
    name: "proceso_sigla",
    label: "Sigla del proceso",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "origen_adquisicion",
    label: "Origen de adquisición",
    type: "text",
    excelWidth: 20,
  },

  // ── Inventario (Base General) ──
  { name: "clase", label: "Clase", type: "text", excelWidth: 22 },
  { name: "tipo", label: "Tipo", type: "text", excelWidth: 18 },
  { name: "configuracion", label: "Configuración", type: "text", excelWidth: 18 },
  { name: "ano_compra", label: "Año compra", type: "number", excelWidth: 12 },
  { name: "longitud_m", label: "Longitud (m)", type: "number", excelWidth: 14 },
  { name: "capacidad_ton", label: "Capacidad (ton)", type: "number", excelWidth: 14 },
  {
    name: "clasificacion_propiedad",
    label: "Clasificación propiedad",
    type: "text",
    excelWidth: 22,
  },
  { name: "valor", label: "Valor", type: "number", excelWidth: 16 },
  { name: "contrato_convenio", label: "Contrato / Convenio", type: "text", excelWidth: 28 },
  /**
   * Columna bitácora «convenio o cto» (puentes (1) 2.xlsx).
   * Filtro raíz del seguimiento: convenio → puente → evento.
   * Label = encabezado Excel exacto.
   */
  {
    name: "convenio_o_cto",
    label: "convenio o cto",
    type: "text",
    excelWidth: 28,
  },
  /** Texto legal largo del proceso (hoja Base General: columna "comentarios"). */
  {
    name: "descripcion_proceso",
    label: "Descripción del proceso",
    type: "textarea",
    excelWidth: 34,
  },
  { name: "tipo_vinculo", label: "Tipo de vínculo", type: "text", excelWidth: 16 },
  { name: "clave_proceso", label: "Clave proceso", type: "text", excelWidth: 28 },
  { name: "ubicacion_actual", label: "Ubicación actual", type: "text", excelWidth: 22 },
  { name: "region", label: "Región", type: "text", excelWidth: 14 },
  { name: "departamento", label: "Departamento", type: "text", excelWidth: 18 },
  { name: "municipio", label: "Municipio", type: "text", excelWidth: 18 },
  { name: "personas_beneficiadas", label: "Personas beneficiadas", type: "number", excelWidth: 18 },
  { name: "latitud", label: "Latitud", type: "number", excelWidth: 14 },
  { name: "longitud", label: "Longitud", type: "number", excelWidth: 14 },
  { name: "entidad_receptora", label: "Entidad receptora", type: "text", excelWidth: 22 },
  { name: "estado_puente", label: "Estado puente", type: "text", excelWidth: 18 },
  { name: "situacion_prestamo", label: "Situación de préstamo", type: "text", excelWidth: 22 },
  {
    name: "fecha_inicio_estado_actual",
    label: "Fecha inicio estado actual",
    type: "date",
    excelWidth: 18,
  },
  {
    name: "fecha_fin_estado_actual",
    label: "Fecha fin estado actual",
    type: "date",
    excelWidth: 18,
  },
  {
    name: "fecha_desde_ultimo_estado",
    label: "Fecha desde último estado",
    type: "date",
    excelWidth: 18,
  },

  // ── Bitácora ──
  { name: "cantidad_viajes", label: "Cantidad de viajes", type: "number", excelWidth: 14 },
  { name: "vereda", label: "Vereda", type: "text", excelWidth: 18 },
  { name: "ente_receptor", label: "Ente receptor", type: "text", excelWidth: 22 },
  { name: "fecha_inicio", label: "Fecha inicio", type: "date", excelWidth: 16 },
  { name: "fecha_fin", label: "Fecha fin", type: "date", excelWidth: 16 },
  {
    name: "fecha_corte_reporte",
    label: "Fecha corte del reporte",
    type: "date",
    excelWidth: 18,
  },
  { name: "fundamento", label: "Fundamento", type: "textarea", excelWidth: 22 },
  { name: "nombre_hoja_reporte", label: "Nombre hoja reporte", type: "text", excelWidth: 22 },

  // ── Contrato estructuración ──
  { name: "vigencia", label: "Vigencia", type: "number", excelWidth: 12 },
  { name: "tipo_proceso", label: "Tipo proceso", type: "text", excelWidth: 16 },
  { name: "grupo", label: "Grupo", type: "text", excelWidth: 14 },
  { name: "etapa", label: "Etapa", type: "text", excelWidth: 18 },
  { name: "area", label: "Área", type: "text", excelWidth: 16 },
  { name: "responsable", label: "Responsable", type: "text", excelWidth: 22 },
  /** Labels distintos de bitácora: si ambos dicen «Fecha inicio», el Excel pisa fecha_inicio. */
  { name: "fecha_inicio_proceso", label: "Fecha inicio proceso", type: "date", excelWidth: 16 },
  { name: "fecha_fin_proceso", label: "Fecha fin proceso", type: "date", excelWidth: 16 },
  { name: "plazo_ejecucion", label: "Plazo de ejecución", type: "date", excelWidth: 18 },
  { name: "tiempo_etapa_dias", label: "Tiempo en etapa (días)", type: "number", excelWidth: 18 },
  {
    name: "tiempo_acumulado_dias",
    label: "Tiempo acumulado (días)",
    type: "number",
    excelWidth: 18,
  },
  { name: "alerta", label: "Alerta", type: "text", excelWidth: 14 },
  { name: "comentarios", label: "Comentarios", type: "textarea", excelWidth: 22 },
  { name: "reporte", label: "Reporte", type: "text", excelWidth: 18 },

  // ── Legacy ArcGIS (compat import) ──
  /** Hoja Base General trae la columna "Contrato"; se copia a contrato_convenio. */
  { name: "contrato", label: "Contrato", type: "text", excelWidth: 28 },
  { name: "lugar", label: "LUGAR (legacy)", type: "text", excelWidth: 18 },
  { name: "longitud_puente", label: "LONGITUD PUENTE (legacy)", type: "number", excelWidth: 18 },
  { name: "capacidad", label: "CAPACIDAD (legacy)", type: "number", excelWidth: 18 },
  { name: "observaciones", label: "Observaciones", type: "textarea", excelWidth: 22 },
  { name: "fecha", label: "Fecha", type: "date", excelWidth: 16 },
  /** Excel Base General: columna «estado» (distinta de «estado_puente»). */
  { name: "estado", label: "Estado", type: "text", excelWidth: 18 },
];

export const SOURCE_FIELDS = applyPuentesSelectOptions(RAW_FIELDS) as FormField[];

export const SCHEMA_VERSION = 5;
