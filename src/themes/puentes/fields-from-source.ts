/**
 * Campos generados desde fuentes reales (maqueta / bitácora / ArcGIS).
 * NO editar a mano — regenerar: node scripts/generate-theme-fields.cjs
 * Fuente: 2025-08-19 CONSOLIDADO DE PUENTES SMD  ARCGIS DRIVE.xlsx · PUENTES (44 filas)
 * schemaVersion 3: capas + clave_seguimiento para cruces y seguimiento.
 */
import type { FormField } from "../shared";

export const SOURCE_FIELDS: FormField[] = [
  { name: "tipo_registro", label: "Tipo de registro", type: "select", required: true, options: ["Inventario puente"], excelWidth: 24 },
  { name: "capa", label: "Capa (Maqueta / Bitácora / …)", type: "select", required: true, options: ["Inventario puente"], excelWidth: 22 },
  { name: "clave_seguimiento", label: "Clave de seguimiento (ID puente / lugar)", type: "text", excelWidth: 28 },
  { name: "id", label: "ID puente / lugar", type: "text", excelWidth: 22 },
  { name: "valor", label: "Valor (COP)", type: "number", excelWidth: 16 },
  { name: "estado", label: "Estado", type: "text", excelWidth: 16 },
  { name: "departamento", label: "DEPARTAMENTO", type: "text", excelWidth: 18 },
  { name: "municipio", label: "MUNICIPIO", type: "text", excelWidth: 18 },
  { name: "lugar", label: "LUGAR", type: "text", excelWidth: 18 },
  { name: "divipola", label: "DIVIPOLA", type: "text", excelWidth: 18 },
  { name: "entidad", label: "ENTIDAD", type: "text", excelWidth: 18 },
  { name: "tipologia_segun_marca_y_estructura", label: "TIPOLOGIA SEGUN MARCA Y ESTRUCTURA", type: "text", excelWidth: 28 },
  { name: "segun_configuracion", label: "SEGUN CONFIGURACION", type: "text", excelWidth: 18 },
  { name: "latitud", label: "LATITUD", type: "number", excelWidth: 18 },
  { name: "longitud", label: "LONGITUD", type: "number", excelWidth: 18 },
  { name: "funcionalidad", label: "FUNCIONALIDAD", type: "text", excelWidth: 18 },
  { name: "longitud_puente", label: "LONGITUD PUENTE", type: "number", excelWidth: 18 },
  { name: "capacidad", label: "CAPACIDAD", type: "number", excelWidth: 18 },
  { name: "no_beneficiarios", label: "No BENEFICIARIOS", type: "text", excelWidth: 18 },
  { name: "estado_actual_detallado", label: "ESTADO ACTUAL DETALLADO", type: "text", excelWidth: 18 },
  { name: "inventario_general", label: "INVENTARIO GENERAL", type: "text", excelWidth: 18 },
  { name: "observaciones", label: "OBSERVACIONES", type: "textarea", excelWidth: 18 },
  { name: "fecha", label: "FECHA DE INSTALACION", type: "date", excelWidth: 18 },
  { name: "fecha_de_inicio_proceso", label: "FECHA DE INICIO PROCESO", type: "date", excelWidth: 18 },
  { name: "fecha_de_termino_de_proceso", label: "FECHA DE TERMINO DE PROCESO", type: "date", excelWidth: 28 },
  { name: "porcentaje_de_avance", label: "PORCENTAJE DE AVANCE", type: "number", excelWidth: 18 },
  { name: "acrow_tolemaida", label: "ACROW TOLEMAIDA", type: "text", excelWidth: 18 },
  { name: "bailey_tolemaida", label: "BAILEY TOLEMAIDA", type: "text", excelWidth: 18 },
  { name: "acrow_valledupar", label: "ACROW VALLEDUPAR", type: "text", excelWidth: 18 },
  { name: "bailey_valledupar", label: "BAILEY VALLEDUPAR", type: "text", excelWidth: 18 },
];

export const SCHEMA_VERSION = 3;
