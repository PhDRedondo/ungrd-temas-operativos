/**
 * Campos generados desde fuentes reales (maqueta / bitácora / ArcGIS).
 * NO editar a mano — regenerar: node scripts/generate-theme-fields.cjs
 * Fuente: Seguimiento_FIC_2026.xlsx · vigencias 2014+2015+2016+2017+2018+2019+2020+2021+2022+2023+2023+2024+2025+2026
 * schemaVersion 3: capas + clave_seguimiento para cruces y seguimiento.
 */
import type { FormField } from "../shared";

export const SOURCE_FIELDS: FormField[] = [
  { name: "tipo_registro", label: "Tipo de registro", type: "select", required: true, options: ["Transferencia FIC 2014","Transferencia FIC 2015","Transferencia FIC 2016","Transferencia FIC 2017","Transferencia FIC 2018","Transferencia FIC 2019","Transferencia FIC 2020","Transferencia FIC 2021","Transferencia FIC 2022","Transferencia FIC 2023","Transferencia FIC 2024","Transferencia FIC 2025","Transferencia FIC 2026"], excelWidth: 24 },
  { name: "capa", label: "Capa (Maqueta / Bitácora / …)", type: "select", required: true, options: ["Transferencia FIC 2014","Transferencia FIC 2015","Transferencia FIC 2016","Transferencia FIC 2017","Transferencia FIC 2018","Transferencia FIC 2019","Transferencia FIC 2020","Transferencia FIC 2021","Transferencia FIC 2022","Transferencia FIC 2023","Transferencia FIC 2024","Transferencia FIC 2025","Transferencia FIC 2026"], excelWidth: 22 },
  { name: "clave_seguimiento", label: "Clave de seguimiento (No. CDP)", type: "text", excelWidth: 28 },
  { name: "no_cdp", label: "No. CDP", type: "text", excelWidth: 22 },
  { name: "vigencia", label: "Vigencia", type: "text", excelWidth: 18 },
  { name: "departamento", label: "Departamento", type: "text", excelWidth: 18 },
  { name: "municipio", label: "Municipio", type: "text", excelWidth: 18 },
  { name: "tipo_de_evento", label: "Tipo de Evento", type: "text", excelWidth: 18 },
  { name: "fecha_formato_de_aprobacion_de_la_atencion", label: "Fecha Formato de \r\nAPROBACIÓN DE LA ATENCIÓN", type: "date", excelWidth: 28 },
  { name: "acto_administrativo_otorgamiento_del_recurso", label: "Acto Administrativo \r\n(Otorgamiento del recurso)", type: "text", excelWidth: 28 },
  { name: "fecha_acto_administrativo_resolucion", label: "Fecha Acto Administrativo\r\n(Resolución)", type: "date", excelWidth: 28 },
  { name: "clasificacion", label: "Clasificación", type: "text", excelWidth: 18 },
  { name: "no_rc", label: "No. RC", type: "text", excelWidth: 18 },
  { name: "valor", label: "Valor Desemboloso", type: "number", excelWidth: 18 },
  { name: "fecha", label: "Fecha de Desembolso", type: "date", excelWidth: 18 },
  { name: "comunicacion_de_notificacion_ente_territorial", label: "Comunicación de Notificación Ente Territorial", type: "text", excelWidth: 28 },
  { name: "fecha_de_radicacion_comunicacion_ente_territorial", label: "Fecha de Radicación Comunicación Ente Territorial", type: "date", excelWidth: 28 },
  { name: "nombre_del_supervisor_administrativo", label: "Nombre del Supervisor Administrativo", type: "text", excelWidth: 28 },
  { name: "fecha_inicial_para_legalizacion", label: "Fecha Inicial para legalización", type: "date", excelWidth: 28 },
  { name: "responsabilidades_de_la_supervision_descripcion_de_las_acciones_", label: "Responsabilidades de la Supervisión\r\n(Descripción de las acciones adelantadas a partir de la recepción de los Informes enviados por Fiduprevisora)", type: "text", excelWidth: 28 },
  { name: "fecha_de_legalizacion_por_prorroga", label: "Fecha de Legalización por Prorroga", type: "date", excelWidth: 28 },
  { name: "estado", label: "Estado en términos de Legalización\r\nUNGRD", type: "text", excelWidth: 28 },
  { name: "valor_por_legalizar", label: "Valor Por Legalizar", type: "number", excelWidth: 18 },
  { name: "porcentaje_de_avance_en_el_ejericicio_de_legalizacion", label: "Porcentaje de avance en el ejericicio de legalización", type: "number", excelWidth: 28 },
  { name: "se_realizaron_visitas_de_seguimiento", label: "Se realizaron visitas de seguimiento", type: "text", excelWidth: 28 },
  { name: "describa_el_resultado_de_las_visitas_realizadas", label: "Describa el resultado de las visitas realizadas", type: "text", excelWidth: 28 },
  { name: "observaciones", label: "Observaciones", type: "textarea", excelWidth: 18 },
  { name: "fecha_de_radicacion_en_gafc", label: "Fecha de Radicación en GAFC", type: "date", excelWidth: 28 },
  { name: "objeto_transferencia", label: "Objeto transferencia", type: "textarea", excelWidth: 18 },
  { name: "plazo_ejecucion_dias", label: "PLAZO EJECUCIÓN (días)", type: "number", excelWidth: 18 },
  { name: "acto_administrativo_prorroga", label: "Acto Administrativo \r\n(Prórroga)", type: "text", excelWidth: 28 },
  { name: "plazo_adicion_dias", label: "PLAZO ADICIÓN\r\n(dïas)", type: "text", excelWidth: 18 },
  { name: "valor_legalizado", label: "Valor Legalizado", type: "number", excelWidth: 18 },
];

export const SCHEMA_VERSION = 3;
