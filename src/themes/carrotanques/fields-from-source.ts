/**
 * Campos Carrotanques alineados a MAQUETA + Bitacora + SUMINISTRO DEF.
 * Departamento/municipio se refuerzan con DIVIPOLA en buildThemeFromSource.
 *
 * Columnas maqueta:
 *  B–J alta inmutable · K/L editables · M–P+T–Z ← bitácora · Q–R–S ← sum suministro
 *
 * Nota: estado / situación / geo van como `text` (o required:false) para aceptar
 * valores Excel “Sin registro”; la UI de captura usa listas en `select-options.ts`.
 */
import type { FormField } from "../shared";
import {
  CARRO_CLASIFICACION_PROPIEDAD,
  CARRO_ESTADO,
  CARRO_REGION,
  CARRO_SITUACION_PRESTAMO,
} from "./select-options";

export const SOURCE_FIELDS: FormField[] = [
  {
    name: "tipo_registro",
    label: "Tipo de registro",
    type: "select",
    required: true,
    options: [
      "Maqueta / inventario",
      "Bitácora estado",
      "Suministro / viajes",
    ],
    excelWidth: 24,
  },
  {
    name: "capa",
    label: "Formulario",
    type: "select",
    required: true,
    options: [
      "Maqueta / inventario",
      "Bitácora estado",
      "Suministro / viajes",
    ],
    excelWidth: 22,
  },
  {
    name: "clave_seguimiento",
    label: "Identificador (placa)",
    type: "text",
    excelWidth: 28,
  },
  { name: "placa", label: "Placa", type: "text", required: true, excelWidth: 14 },
  { name: "valor", label: "Valor", type: "number", excelWidth: 16 },
  { name: "fecha", label: "Fecha", type: "date", excelWidth: 14 },
  { name: "no", label: "Número", type: "text", excelWidth: 10 },

  // B–J · alta
  { name: "placa_ungrd", label: "Placa UNGRD", type: "text", excelWidth: 14 },
  { name: "clase", label: "Clase de vehículo", type: "text", excelWidth: 14 },
  { name: "marca", label: "Marca", type: "text", excelWidth: 14 },
  { name: "modelo_ref", label: "Modelo / referencia", type: "text", excelWidth: 16 },
  { name: "serial", label: "Serial", type: "text", excelWidth: 20 },
  { name: "modelo", label: "Año del modelo", type: "text", excelWidth: 12 },
  { name: "ano_compra", label: "Año de compra", type: "number", excelWidth: 12 },
  { name: "capacidad_lt", label: "Capacidad (litros)", type: "number", excelWidth: 14 },

  // K–L
  {
    name: "otras_categorizaciones",
    label: "Otras categorizaciones",
    type: "text",
    excelWidth: 22,
  },
  {
    name: "clasificacion_propiedad",
    label: "Clasificación de propiedad",
    type: "select",
    options: [...CARRO_CLASIFICACION_PROPIEDAD],
    excelWidth: 20,
  },

  // M–P (Bitácora → maqueta)
  {
    name: "ubicacion_actual",
    label: "Ubicación actual",
    type: "text",
    placeholder: "Ej. CNL, Bogotá, Melgar…",
    excelWidth: 18,
  },
  {
    name: "departamento",
    label: "Departamento",
    type: "text",
    required: false,
    excelWidth: 16,
  },
  {
    name: "municipio",
    label: "Municipio",
    type: "text",
    required: false,
    excelWidth: 16,
  },
  {
    name: "region",
    label: "Región",
    type: "select",
    options: [...CARRO_REGION],
    excelWidth: 14,
  },

  // Q–R–S (acumulado desde suministro)
  {
    name: "lt_suministrados",
    label: "Litros suministrados (acumulado)",
    type: "number",
    excelWidth: 14,
  },
  {
    name: "per_benef",
    label: "Personas beneficiadas (acumulado)",
    type: "number",
    excelWidth: 12,
  },
  {
    name: "com_benef",
    label: "Comunidades beneficiadas (acumulado)",
    type: "number",
    excelWidth: 12,
  },

  // T–Z (Bitácora → maqueta). fecha_desde_ultm_estado es reflejo en maqueta, no se captura en bitácora.
  {
    name: "fecha_inicio_estado_actual",
    label: "Fecha de inicio del estado",
    type: "date",
    excelWidth: 22,
  },
  {
    name: "fech_fin_estado_actual",
    label: "Fecha de fin del estado",
    type: "date",
    excelWidth: 20,
  },
  {
    name: "fecha_desde_ultm_estado",
    label: "Fecha desde el último estado",
    type: "date",
    excelWidth: 20,
  },
  {
    name: "entidad_receptora",
    label: "Entidad receptora",
    type: "text",
    excelWidth: 20,
  },
  {
    name: "estado",
    label: "Estado del vehículo",
    type: "select",
    options: [...CARRO_ESTADO],
    excelWidth: 18,
  },
  {
    name: "situacion_de_prestamo",
    label: "Situación de préstamo",
    type: "select",
    options: [...CARRO_SITUACION_PRESTAMO],
    excelWidth: 20,
  },
  {
    name: "observaciones",
    label: "Observaciones",
    type: "textarea",
    excelWidth: 28,
  },

  // Bitácora / suministro extras
  {
    name: "cantidad_de_viajes",
    label: "Cantidad de viajes",
    type: "number",
    excelWidth: 16,
  },
  { name: "ente_receptor", label: "Ente receptor", type: "text", excelWidth: 18 },
  { name: "fecha_fin", label: "Fecha de fin", type: "date", excelWidth: 14 },
  {
    name: "fecha_corte_del_reporte",
    label: "Fecha de corte del reporte",
    type: "date",
    excelWidth: 22,
  },
  { name: "fundamento", label: "Fundamento", type: "text", excelWidth: 20 },
  {
    name: "nombre_hoja_reporte",
    label: "Nombre de la hoja de reporte",
    type: "text",
    excelWidth: 20,
  },
  { name: "cap_gls", label: "Capacidad (galones)", type: "number", excelWidth: 12 },
  {
    name: "cap_lts",
    label: "Capacidad (litros)",
    type: "number",
    excelWidth: 14,
  },
  {
    name: "ente_receptor_sitio_de_suministro",
    label: "Ente receptor / sitio de suministro",
    type: "text",
    excelWidth: 28,
  },
  {
    name: "litros_suministrados",
    label: "Litros suministrados",
    type: "number",
    excelWidth: 18,
  },
  {
    name: "personas_beneficiadas",
    label: "Personas beneficiadas",
    type: "number",
    excelWidth: 18,
  },
  {
    name: "comunidades_beneficiadas",
    label: "Comunidades beneficiadas",
    type: "number",
    excelWidth: 20,
  },
];

export const SCHEMA_VERSION = 5;
