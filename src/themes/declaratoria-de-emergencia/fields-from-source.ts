/**
 * Campos generados desde fuentes reales (maqueta / bitácora / ArcGIS).
 * NO editar a mano — regenerar: node scripts/generate-theme-fields.cjs
 * Fuente: 2025-08-14 DECLATARORIAS DE CALAMIDAD ARCGIS.xlsx · DECRETOS DE CALAMIDAD
 * schemaVersion 3: capas + clave_seguimiento para cruces y seguimiento.
 */
import type { FormField } from "../shared";

export const SOURCE_FIELDS: FormField[] = [
  { name: "tipo_registro", label: "Tipo de registro", type: "select", required: true, options: ["Decreto / declaratoria"], excelWidth: 24 },
  { name: "capa", label: "Capa (Maqueta / Bitácora / …)", type: "select", required: true, options: ["Decreto / declaratoria"], excelWidth: 22 },
  { name: "clave_seguimiento", label: "Clave de seguimiento (Nº declaratoria)", type: "text", excelWidth: 28 },
  { name: "no_declaratoria", label: "Nº declaratoria", type: "text", excelWidth: 22 },
  { name: "valor", label: "Valor (COP)", type: "number", excelWidth: 16 },
  { name: "estado", label: "Estado", type: "text", excelWidth: 16 },
  { name: "id", label: "ID", type: "text", excelWidth: 18 },
  { name: "departamento", label: "DEPARTAMENTO", type: "text", excelWidth: 18 },
  { name: "municipio", label: "MUNICIPIO", type: "text", excelWidth: 18 },
  { name: "evento", label: "EVENTO", type: "text", excelWidth: 18 },
  { name: "divipola", label: "DIVIPOLA", type: "text", excelWidth: 18 },
  { name: "fecha", label: "FECHA INICIO", type: "date", excelWidth: 18 },
  { name: "fecha_de_terminacion", label: "FECHA DE TERMINACION", type: "date", excelWidth: 18 },
  { name: "vigencia", label: "VIGENCIA", type: "text", excelWidth: 18 },
  { name: "latitud", label: "LATITUD", type: "number", excelWidth: 18 },
  { name: "longitud", label: "LONGITUD", type: "number", excelWidth: 18 },
  { name: "acta", label: "ACTA", type: "text", excelWidth: 18 },
  { name: "pae", label: "PAE", type: "text", excelWidth: 18 },
  { name: "edan", label: "EDAN", type: "text", excelWidth: 18 },
  { name: "solicitud", label: "SOLICITUD", type: "text", excelWidth: 18 },
  { name: "otros", label: "OTROS", type: "text", excelWidth: 18 },
  { name: "prorroga", label: "PRORROGA", type: "text", excelWidth: 18 },
  { name: "fecha_inicio_prorroga", label: "FECHA INICIO PRORROGA", type: "date", excelWidth: 18 },
  { name: "fecha_de_terminacion_prorroga", label: "FECHA DE TERMINACION PRORROGA", type: "date", excelWidth: 28 },
  { name: "vigencia_prorroga", label: "VIGENCIA PRORROGA", type: "text", excelWidth: 18 },
  { name: "evento_prorroga", label: "EVENTO PRORROGA", type: "text", excelWidth: 18 },
  { name: "no_declaratoria_prorroga", label: "No DECLARATORIA PRORROGA", type: "text", excelWidth: 18 },
  { name: "retorno_normalidad", label: "RETORNO NORMALIDAD", type: "text", excelWidth: 18 },
  { name: "fecha_inicio_retorno", label: "FECHA INICIO RETORNO", type: "date", excelWidth: 18 },
  { name: "evento_retorno", label: "EVENTO RETORNO", type: "text", excelWidth: 18 },
  { name: "no_declaratoria_retorno", label: "No DECLARATORIA RETORNO", type: "text", excelWidth: 18 },
  { name: "modificacion_terminacion_otros", label: "MODIFICACION TERMINACION OTROS", type: "text", excelWidth: 28 },
  { name: "fecha_de_inicio_modificacion", label: "FECHA DE INICIO MODIFICACION", type: "date", excelWidth: 28 },
  { name: "fecha_de_terminacion_modificacion", label: "FECHA DE TERMINACION MODIFICACION", type: "date", excelWidth: 28 },
  { name: "vigencia_modificacion", label: "VIGENCIA MODIFICACION", type: "text", excelWidth: 18 },
  { name: "evento_modificacion", label: "EVENTO MODIFICACION", type: "text", excelWidth: 18 },
  { name: "no_declaratoria_modificacion", label: "No DECLARATORIA MODIFICACION", type: "text", excelWidth: 28 },
  { name: "observaciones", label: "OBSERVACIONES", type: "textarea", excelWidth: 18 },
];

export const SCHEMA_VERSION = 3;
