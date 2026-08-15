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
    label: "Capa",
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
    label: "Clave de seguimiento (Nº convenio / Serial)",
    type: "text",
    excelWidth: 28,
  },

  // —— Identidad activo (DETALLE)
  { name: "serial", label: "Serial", type: "text", excelWidth: 22 },
  { name: "no_maquina", label: "No. máquina", type: "text", excelWidth: 14 },
  { name: "referencia", label: "Referencia", type: "text", excelWidth: 20 },
  { name: "nit", label: "NIT", type: "text", excelWidth: 14 },
  { name: "clasificacion", label: "Clasificación", type: "text", excelWidth: 16 },
  { name: "empresa", label: "Empresa", type: "text", excelWidth: 22 },
  { name: "entidad_receptora", label: "Entidad receptora", type: "text", excelWidth: 22 },
  {
    name: "tipo_maquinaria",
    label: "Tipo maquinaria",
    type: "text",
    excelWidth: 24,
  },
  { name: "departamento", label: "Departamento", type: "text", excelWidth: 16 },
  { name: "municipio", label: "Municipio (DIVIPOLA)", type: "text", excelWidth: 16 },
  { name: "valor", label: "Valor unitario", type: "number", excelWidth: 16 },
  { name: "n_motor", label: "Nº motor", type: "text", excelWidth: 16 },
  { name: "fecha", label: "Fecha de recibo", type: "date", excelWidth: 14 },
  {
    name: "fecha_entrega_o_recibo",
    label: "Fecha entrega o recibo",
    type: "date",
    excelWidth: 18,
  },
  {
    name: "ano_modelo",
    label: "Año modelo",
    type: "select",
    options: [...BMAQ_ANO_MODELO],
    excelWidth: 12,
  },
  { name: "placa", label: "Placas", type: "text", excelWidth: 12 },
  { name: "chasis_camabaja", label: "Chasis camabaja", type: "text", excelWidth: 16 },
  { name: "placa_camabaja", label: "Placa camabaja", type: "text", excelWidth: 14 },
  { name: "linea", label: "Línea", type: "text", excelWidth: 14 },
  {
    name: "modelo_y_o_referencia",
    label: "Modelo y/o referencia",
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
    label: "Nº orden de compra",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "no_convenio",
    label: "Nº convenio o proceso",
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
  { name: "cargo_encargad", label: "Cargo encargado", type: "text", excelWidth: 16 },
  {
    name: "estado_maquina",
    label: "Estado máquina",
    type: "select",
    options: [...BMAQ_ESTADO_MAQUINA],
    excelWidth: 18,
  },
  {
    name: "estado_convenio",
    label: "Estado convenio",
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
  { name: "objeto", label: "Objeto", type: "textarea", excelWidth: 36 },
  {
    name: "cantidad_maquinaria_expectativa",
    label: "Cantidad maquinaria expectativa",
    type: "number",
    excelWidth: 22,
  },
  /** Alias legacy del typo en schema v3. */
  {
    name: "cantidad_maquinaria_espectativa",
    label: "CANTIDAD MAQUINARIA ESPECTATIVA",
    type: "number",
    excelWidth: 22,
  },
  {
    name: "cantidad_maquinaria_entregada",
    label: "Cantidad maquinaria entregada",
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
    label: "Fecha acta de inicio",
    type: "date",
    excelWidth: 16,
  },
  { name: "no_cdp", label: "CDP", type: "text", excelWidth: 14 },
  { name: "fecha_cdp", label: "Fecha CDP", type: "date", excelWidth: 14 },
  { name: "no_rc", label: "RC", type: "text", excelWidth: 14 },
  { name: "fecha_de_rc", label: "Fecha RC", type: "date", excelWidth: 14 },
  { name: "valor_total", label: "Valor total", type: "number", excelWidth: 16 },
  /** Alias legacy v3. */
  { name: "valor_sin_iva", label: "VALOR SIN IVA", type: "number", excelWidth: 16 },
  {
    name: "valor_aporte_municipio",
    label: "Valor aporte municipio",
    type: "number",
    excelWidth: 18,
  },
  {
    name: "valor_aporte_gobernacion",
    label: "Valor aporte gobernación",
    type: "number",
    excelWidth: 18,
  },
  {
    name: "valor_aporte_ungrd",
    label: "Valor aporte UNGRD",
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
    label: "FECHA DE ESTADO",
    type: "date",
    excelWidth: 14,
  },
  { name: "comentario", label: "COMENTARIO", type: "textarea", excelWidth: 28 },

  // —— Entrega a beneficiario
  {
    name: "tipo",
    label: "TIPO",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "comandante_o_rep_legal",
    label: "COMANDANTE O REP LEGAL",
    type: "text",
    excelWidth: 24,
  },
  { name: "cedula", label: "CEDULA", type: "text", excelWidth: 14 },
  { name: "celular", label: "CELULAR", type: "text", excelWidth: 14 },
  {
    name: "correo_electronico",
    label: "CORREO ELECTRONICO",
    type: "text",
    excelWidth: 22,
  },
  {
    name: "resolucion_de_nombramiento_comandante",
    label: "RESOLUCIÓN DE NOMBRAMIENTO COMANDANTE",
    type: "text",
    excelWidth: 28,
  },
  {
    name: "acta_perfeccionada",
    label: "ACTA PERFECCIONADA",
    type: "text",
    excelWidth: 18,
  },
  { name: "acta_en_fisico", label: "ACTA EN FISICO", type: "text", excelWidth: 14 },
  {
    name: "poliza_inicial_todo_riesgo",
    label: "POLIZA  INICIAL TODO RIESGO",
    type: "text",
    excelWidth: 24,
  },
  {
    name: "fecha_envio_acta_perfeccionada_cuerpo_de_bomberos",
    label: "FECHA ENVIO ACTA PERFECCIONADA CUERPO DE BOMBEROS",
    type: "date",
    excelWidth: 28,
  },
  {
    name: "inicio_vigencia_poliza_tr",
    label: "INICIO VIGENCIA POLIZA TR",
    type: "text",
    excelWidth: 18,
  },
  {
    name: "fin_vigencia_poliza_tr",
    label: "FIN VIGENCIA POLIZA TR",
    type: "text",
    excelWidth: 18,
  },
  { name: "dias", label: "DIAS", type: "number", excelWidth: 10 },
  {
    name: "alerta_poliza_tr",
    label: "ALERTA POLIZA TR",
    type: "text",
    excelWidth: 16,
  },
  {
    name: "fecha_inicio_soat",
    label: "FECHA INICIO SOAT",
    type: "date",
    excelWidth: 14,
  },
  {
    name: "fcha_terminacion_soat",
    label: "FCHA TERMINACION SOAT",
    type: "text",
    excelWidth: 16,
  },
  { name: "alerta_soat", label: "ALERTA SOAT", type: "text", excelWidth: 14 },
  {
    name: "fecha_de_envio_1_oficio_ungrd_al_cuerpo_de_bomberos",
    label: "Fecha de envio 1º oficio UNGRD  al cuerpo de bomberos",
    type: "date",
    excelWidth: 28,
  },
  { name: "1_informe_2024", label: "1º informe 2024", type: "text", excelWidth: 14 },
  { name: "2_informe_2024", label: "2º informe 2024", type: "text", excelWidth: 14 },
  { name: "soat_2025", label: "SOAT 2025", type: "text", excelWidth: 12 },
  {
    name: "poliza_todo_riesgo",
    label: "POLIZA TODO RIESGO",
    type: "text",
    excelWidth: 16,
  },
  {
    name: "bitacora_de_mantenimiento",
    label: "BITACORA DE MANTENIMIENTO",
    type: "text",
    excelWidth: 22,
  },
  {
    name: "plan_de_accion_2024",
    label: "PLAN DE ACCION 2024",
    type: "text",
    excelWidth: 16,
  },
  {
    name: "fotografias_equipo",
    label: "FOTOGRAFIAS EQUIPO",
    type: "text",
    excelWidth: 16,
  },
];

export const SCHEMA_VERSION = 6;
