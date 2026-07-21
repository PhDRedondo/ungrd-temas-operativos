/**
 * Campos generados desde fuentes reales (maqueta / bitácora / ArcGIS).
 * NO editar a mano — regenerar: node scripts/generate-theme-fields.cjs
 * Fuente: 2025-09-15 OBRAS POR IMPUESTO ARCGIS DRIVE.xlsx · OBRAS POR IMPUESTO
 * schemaVersion 3: capas + clave_seguimiento para cruces y seguimiento.
 */
import type { FormField } from "../shared";

export const SOURCE_FIELDS: FormField[] = [
  { name: "tipo_registro", label: "Tipo de registro", type: "select", required: true, options: ["Convenio obra por impuesto"], excelWidth: 24 },
  { name: "capa", label: "Capa (Maqueta / Bitácora / …)", type: "select", required: true, options: ["Convenio obra por impuesto"], excelWidth: 22 },
  { name: "clave_seguimiento", label: "Clave de seguimiento (Nº convenio / BPIN)", type: "text", excelWidth: 28 },
  { name: "no_convenio", label: "Nº convenio / BPIN", type: "text", excelWidth: 22 },
  { name: "fecha", label: "Fecha", type: "date", excelWidth: 16 },
  { name: "id", label: "ID", type: "text", excelWidth: 18 },
  { name: "departamento", label: "DEPARTAMENTO", type: "text", excelWidth: 18 },
  { name: "municipio", label: "MUNICIPIO", type: "text", excelWidth: 18 },
  { name: "divipola", label: "DIVIPOLA", type: "text", excelWidth: 18 },
  { name: "lugar", label: "LUGAR", type: "text", excelWidth: 18 },
  { name: "valor", label: "VALOR CONVENIO", type: "number", excelWidth: 18 },
  { name: "objeto_del_convenio", label: "OBJETO DEL CONVENIO", type: "textarea", excelWidth: 18 },
  { name: "latitud", label: "LATITUD", type: "number", excelWidth: 18 },
  { name: "longitud", label: "LONGITUD", type: "number", excelWidth: 18 },
  { name: "contribuyente", label: "CONTRIBUYENTE", type: "text", excelWidth: 18 },
  { name: "estado", label: "ESTADO DEL CONVENIO OBRA POR IMPUESTO", type: "text", excelWidth: 28 },
  { name: "fecha_de_inicio_del_convenio", label: "FECHA DE INICIO DEL CONVENIO", type: "date", excelWidth: 28 },
  { name: "fecha_de_terminacion_del_convenio", label: "FECHA DE TERMINACION DEL CONVENIO", type: "date", excelWidth: 28 },
  { name: "fecha_de_activacion", label: "FECHA DE ACTIVACION", type: "date", excelWidth: 18 },
  { name: "fecha_finalizacion", label: "FECHA FINALIZACION", type: "date", excelWidth: 18 },
  { name: "convenio_de_interventoria_no", label: "CONVENIO DE INTERVENTORÍA No.", type: "text", excelWidth: 28 },
  { name: "objeto_del_convenio_de_interventoria", label: "OBJETO DEL CONVENIO DE INTERVENTORIA", type: "textarea", excelWidth: 28 },
  { name: "contratista", label: "CONTRATISTA", type: "text", excelWidth: 18 },
  { name: "estado_del_convenio_de_interventoria", label: "ESTADO DEL CONVENIO DE INTERVENTORÍA", type: "text", excelWidth: 28 },
  { name: "valor_convenio_de_interventoria", label: "VALOR CONVENIO DE INTERVENTORIA", type: "number", excelWidth: 28 },
  { name: "plazo_convenio_de_interventoria", label: "PLAZO CONVENIO DE INTERVENTORIA", type: "text", excelWidth: 28 },
  { name: "fecha_inicio_de_convenio_interventoria", label: "FECHA INICIO DE CONVENIO INTERVENTORIA", type: "date", excelWidth: 28 },
  { name: "fecha_terminacion_de_convenio_de_interventoria", label: "FECHA TERMINACIÓN DE CONVENIO DE INTERVENTORIA", type: "date", excelWidth: 28 },
  { name: "entidad_de_iconos", label: "ENTIDAD DE ICONOS", type: "text", excelWidth: 18 },
  { name: "municipios_apoyados_por_convenio", label: "MUNICIPIOS APOYADOS POR CONVENIO", type: "text", excelWidth: 28 },
  { name: "observaciones", label: "MINUTA Y OBSERVACIONES", type: "textarea", excelWidth: 18 },
];

export const SCHEMA_VERSION = 3;
