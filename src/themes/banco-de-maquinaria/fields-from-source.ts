/**
 * Campos Banco de Maquinaria — CONVENIOS (raíz) + DETALLE + BITÁCORA + ENTREGA.
 *
 * Capas (orden de alimentación):
 *  - Convenio o proceso ← CONVENIOS O PROCESOS (llave: no_convenio) — nace aquí
 *  - Maqueta / inventario ← DETALLE MAQUINARIA (llave: serial; cuelga del convenio)
 *  - Bitácora convenio ← BITACORA CONVENIOS (append por no_convenio)
 *  - Entrega a beneficiario ← BASE ENTREGA BOMBEROS (por serial)
 *
 * Sync:
 *  - Bitácora → convenio.estado (+ geo) y detalle.estado_convenio
 *  - Entrega → detalle.estado_maquina = ENTREGADA
 *
 * schemaVersion 6: convenio raíz; F–I editables; detalle del convenio.
 */
import type { FormField } from "../shared";
import { BMAQ_ANO_MODELO, BMAQ_ESTADO_MAQUINA } from "./select-options";

export const SOURCE_FIELDS: FormField[] = [
  {
    name: "tipo_registro",
    label: "Tipo de registro",
    type: "select",
    required: true,
    options: [
      "Convenio o proceso",
      "Maqueta / inventario",
      "Bitácora convenio",
      "Entrega a beneficiario",
    ],
    excelWidth: 24,
  },
  {
    name: "capa",
    label: "Formulario",
    type: "select",
    required: true,
    options: [
      "Convenio o proceso",
      "Maqueta / inventario",
      "Bitácora convenio",
      "Entrega a beneficiario",
    ],
    excelWidth: 22,
  },
  {
    name: "clave_seguimiento",
    label: "Identificador (convenio / serial)",
    type: "text",
    excelWidth: 28,
  },

  // —— Identidad activo (DETALLE)
  { name: "serial", label: "Serial del equipo", type: "text", excelWidth: 22 },
  { name: "no_maquina", label: "Número de máquina", type: "text", excelWidth: 14 },
  { name: "referencia", label: "Referencia", type: "text", excelWidth: 20 },
  { name: "nit", label: "NIT", type: "text", excelWidth: 14 },
  { name: "clasificacion", label: "Clasificación", type: "text", excelWidth: 16 },
  { name: "empresa", label: "Empresa", type: "text", excelWidth: 22 },
  { name: "entidad_receptora", label: "Entidad receptora", type: "text", excelWidth: 22 },
  {
    name: "tipo_maquinaria",
    label: "Tipo de maquinaria",
    type: "text",
    excelWidth: 24,
  },
  { name: "departamento", label: "Departamento", type: "text", excelWidth: 16 },
  { name: "municipio", label: "Municipio", type: "text", excelWidth: 16 },
  { name: "valor", label: "Valor unitario", type: "number", excelWidth: 16 },
  { name: "n_motor", label: "Número de motor", type: "text", excelWidth: 16 },
  { name: "fecha", label: "Fecha de recibo", type: "date", excelWidth: 14 },
  {
    name: "fecha_entrega_o_recibo",
    label: "Fecha de entrega o recibo",
    type: "date",
    excelWidth: 18,
  },
  {
    name: "ano_modelo",
    label: "Año del modelo",
    type: "select",
    options: [...BMAQ_ANO_MODELO],
    excelWidth: 12,
  },
  { name: "placa", label: "Placa", type: "text", excelWidth: 12 },
  { name: "chasis_camabaja", label: "Chasis camabaja", type: "text", excelWidth: 16 },
  { name: "placa_camabaja", label: "Placa camabaja", type: "text", excelWidth: 14 },
  { name: "linea", label: "Línea", type: "text", excelWidth: 14 },
  {
    name: "modelo_y_o_referencia",
    label: "Modelo o referencia",
    type: "text",
    excelWidth: 28,
  },
  {
    name: "modalidad",
    label: "Modalidad",
    type: "text",
    excelWidth: 22,
  },
  {
    name: "no_orden_de_compra",
    label: "Número de orden de compra",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "no_convenio",
    label: "Número de convenio o proceso",
    type: "text",
    excelWidth: 28,
  },
  {
    name: "registrada_ante_el_runt",
    label: "Registrada ante el RUNT",
    type: "text",
    excelWidth: 18,
  },
  { name: "observaciones", label: "Observaciones", type: "textarea", excelWidth: 24 },
  { name: "encargado", label: "Encargado", type: "text", excelWidth: 18 },
  { name: "cargo_encargad", label: "Cargo del encargado", type: "text", excelWidth: 16 },
  {
    name: "estado_maquina",
    label: "Estado de la máquina",
    type: "select",
    options: [...BMAQ_ESTADO_MAQUINA],
    excelWidth: 18,
  },
  {
    name: "estado_convenio",
    label: "Estado del convenio",
    type: "text",
    excelWidth: 18,
  },

  // —— Convenio / bitácora
  {
    name: "estado",
    label: "Estado",
    type: "text",
    excelWidth: 16,
  },
  { name: "objeto", label: "Objeto del convenio", type: "textarea", excelWidth: 36 },
  {
    name: "cantidad_maquinaria_expectativa",
    label: "Cantidad de maquinaria esperada",
    type: "number",
    excelWidth: 22,
  },
  /** Alias legacy del typo en schema v3. */
  {
    name: "cantidad_maquinaria_espectativa",
    label: "Cantidad de maquinaria esperada (Excel)",
    type: "number",
    excelWidth: 22,
  },
  {
    name: "cantidad_maquinaria_entregada",
    label: "Cantidad de maquinaria entregada",
    type: "number",
    excelWidth: 22,
  },
  {
    name: "tiempo_de_ejecucion",
    label: "Tiempo de ejecución (meses)",
    type: "number",
    excelWidth: 16,
  },
  {
    name: "fecha_acta_de_inicio",
    label: "Fecha del acta de inicio",
    type: "date",
    excelWidth: 16,
  },
  { name: "no_cdp", label: "Número de CDP", type: "text", excelWidth: 14 },
  { name: "fecha_cdp", label: "Fecha del CDP", type: "date", excelWidth: 14 },
  { name: "no_rc", label: "Número de RC", type: "text", excelWidth: 14 },
  { name: "fecha_de_rc", label: "Fecha del RC", type: "date", excelWidth: 14 },
  { name: "valor_total", label: "Valor total", type: "number", excelWidth: 16 },
  /** Alias legacy v3. */
  { name: "valor_sin_iva", label: "Valor sin IVA", type: "number", excelWidth: 16 },
  {
    name: "valor_aporte_municipio",
    label: "Aporte del municipio",
    type: "number",
    excelWidth: 18,
  },
  {
    name: "valor_aporte_gobernacion",
    label: "Aporte de la gobernación",
    type: "number",
    excelWidth: 18,
  },
  {
    name: "valor_aporte_ungrd",
    label: "Aporte UNGRD",
    type: "number",
    excelWidth: 18,
  },
  {
    name: "responsable_juridico",
    label: "Responsable jurídico",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "responsable_financiero",
    label: "Responsable financiero",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "responsable_tecnico",
    label: "Responsable técnico",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "fecha_de_estado",
    label: "Fecha del estado",
    type: "date",
    excelWidth: 14,
  },
  { name: "comentario", label: "Comentario", type: "textarea", excelWidth: 28 },

  // —— Entrega a beneficiario
  {
    name: "tipo",
    label: "Tipo",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "comandante_o_rep_legal",
    label: "Comandante o representante legal",
    type: "text",
    excelWidth: 24,
  },
  { name: "cedula", label: "Cédula", type: "text", excelWidth: 14 },
  { name: "celular", label: "Celular", type: "text", excelWidth: 14 },
  {
    name: "correo_electronico",
    label: "Correo electrónico",
    type: "text",
    excelWidth: 22,
  },
  {
    name: "resolucion_de_nombramiento_comandante",
    label: "Resolución de nombramiento del comandante",
    type: "text",
    excelWidth: 28,
  },
  {
    name: "acta_perfeccionada",
    label: "Acta perfeccionada",
    type: "text",
    excelWidth: 18,
  },
  { name: "acta_en_fisico", label: "Acta en físico", type: "text", excelWidth: 14 },
  {
    name: "poliza_inicial_todo_riesgo",
    label: "Póliza inicial todo riesgo",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "fecha_envio_acta_perfeccionada_cuerpo_de_bomberos",
    label: "Fecha de envío del acta al cuerpo de bomberos",
    type: "date",
    excelWidth: 28,
  },
  {
    name: "inicio_vigencia_poliza_tr",
    label: "Inicio vigencia póliza todo riesgo",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "fin_vigencia_poliza_tr",
    label: "Fin vigencia póliza todo riesgo",
    type: "text",
    excelWidth: 18,
  },
  { name: "dias", label: "Días", type: "number", excelWidth: 10 },
  {
    name: "alerta_poliza_tr",
    label: "Alerta póliza todo riesgo",
    type: "text",
    excelWidth: 16,
  },
  {
    name: "fecha_inicio_soat",
    label: "Fecha inicio SOAT",
    type: "date",
    excelWidth: 14,
  },
  {
    name: "fcha_terminacion_soat",
    label: "Fecha terminación SOAT",
    type: "text",
    excelWidth: 16,
  },
  { name: "alerta_soat", label: "Alerta SOAT", type: "text", excelWidth: 14 },
  {
    name: "fecha_de_envio_1_oficio_ungrd_al_cuerpo_de_bomberos",
    label: "Fecha del primer oficio UNGRD a bomberos",
    type: "date",
    excelWidth: 28,
  },
  { name: "1_informe_2024", label: "Primer informe 2024", type: "text", excelWidth: 14 },
  { name: "2_informe_2024", label: "Segundo informe 2024", type: "text", excelWidth: 14 },
  { name: "soat_2025", label: "SOAT 2025", type: "text", excelWidth: 12 },
  {
    name: "poliza_todo_riesgo",
    label: "Póliza todo riesgo",
    type: "text",
    excelWidth: 16,
  },
  {
    name: "bitacora_de_mantenimiento",
    label: "Bitácora de mantenimiento",
    type: "text",
    excelWidth: 22,
  },
  {
    name: "plan_de_accion_2024",
    label: "Plan de acción 2024",
    type: "text",
    excelWidth: 16,
  },
  {
    name: "fotografias_equipo",
    label: "Fotografías del equipo",
    type: "text",
    excelWidth: 16,
  },
];

export const SCHEMA_VERSION = 6;
