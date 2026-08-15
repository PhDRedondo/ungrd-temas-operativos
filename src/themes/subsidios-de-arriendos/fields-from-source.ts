/**
 * Campos del consolidado Bronze (Excel de envíos).
 * Columnas = las del archivo. `uuid` solo para import/cruce; no va al formulario.
 */
import type { FormField } from "../shared";
import {
  SUBSIDIOS_ESTADO,
  SUBSIDIOS_TENENCIA,
  SUBSIDIOS_TIPO_VIVIENDA,
} from "./select-options";

export const SCHEMA_VERSION = 3;

export const SOURCE_FIELDS: FormField[] = [
  {
    name: "tipo_registro",
    label: "Tipo de registro",
    type: "select",
    required: true,
    options: ["Consolidado / envío"],
    excelWidth: 22,
  },
  {
    name: "capa",
    label: "Capa",
    type: "select",
    required: true,
    options: ["Consolidado / envío"],
    excelWidth: 22,
  },
  {
    name: "uuid",
    label: "uuid",
    type: "text",
    excelWidth: 36,
  },
  {
    name: "numero_envio",
    label: "Número de envío",
    type: "number",
    required: true,
    min: 1,
    excelWidth: 14,
  },
  {
    name: "n_orden",
    label: "N. orden",
    type: "text",
    required: true,
    excelWidth: 14,
  },
  {
    name: "estado",
    label: "Estado",
    type: "select",
    required: true,
    options: [...SUBSIDIOS_ESTADO],
    excelWidth: 16,
  },
  {
    name: "doc_identidad_arrendador",
    label: "Doc. identidad arrendador",
    type: "text",
    required: true,
    excelWidth: 20,
  },
  {
    name: "apellidos_arrendador",
    label: "Apellidos arrendador",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "nombres_arrendador",
    label: "Nombres arrendador",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "rud_arrendador",
    label: "RUD arrendador",
    type: "text",
    excelWidth: 14,
  },
  {
    name: "doc_identidad_arrendatario",
    label: "Doc. identidad arrendatario",
    type: "text",
    required: true,
    excelWidth: 22,
  },
  {
    name: "apellidos_arrendatario",
    label: "Apellidos arrendatario",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "nombres_arrendatario",
    label: "Nombres arrendatario",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "rud_arrendatario",
    label: "RUD arrendatario",
    type: "text",
    excelWidth: 14,
  },
  {
    name: "id_vivienda",
    label: "id_vivienda",
    type: "select",
    options: [...SUBSIDIOS_TIPO_VIVIENDA],
    excelWidth: 18,
  },
  {
    name: "tenencia",
    label: "Tenencia",
    type: "select",
    options: [...SUBSIDIOS_TENENCIA],
    excelWidth: 16,
  },
  {
    name: "no_contrato",
    label: "No. contrato",
    type: "text",
    excelWidth: 18,
  },
  { name: "duracion", label: "Duración", type: "text", excelWidth: 14 },
  {
    name: "fecha_inicio",
    label: "Fecha inicio",
    type: "date",
    excelWidth: 14,
  },
  {
    name: "fecha_final",
    label: "Fecha final",
    type: "date",
    excelWidth: 14,
  },
  {
    name: "fecha_entrega_vivienda",
    label: "Fecha entrega vivienda",
    type: "date",
    excelWidth: 20,
  },
  {
    name: "valor_total_pagado",
    label: "Valor total pagado",
    type: "number",
    excelWidth: 20,
  },
  { name: "lugar_giro", label: "Lugar de giro", type: "text", excelWidth: 28 },
  { name: "cod_oficina", label: "Código oficina", type: "text", excelWidth: 12 },
  { name: "cod_dane", label: "Código DANE", type: "text", excelWidth: 12 },
  {
    name: "municipio",
    label: "Municipio",
    type: "text",
    required: true,
    excelWidth: 18,
  },
  {
    name: "departamento",
    label: "Departamento",
    type: "text",
    required: true,
    excelWidth: 18,
  },
  {
    name: "_archivo_fuente",
    label: "Archivo fuente",
    type: "text",
    excelWidth: 40,
  },
];
