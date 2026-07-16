import { buildTheme, type ThemeModule } from "../shared";

/**
 * ═══════════════════════════════════════════════════════════════════
 * PLANTILLA DE REFERENCIA — NO MODIFICAR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Este módulo es la línea base canónica de un tema operativo UNGRD.
 * El equipo debe:
 *   • Copiar esta carpeta al crear temas nuevos, O
 *   • Diff contra este módulo si un tema operativo se “pierde” o diverge.
 *
 * No edite campos, textos ni estructura salvo acuerdo explícito de
 * arquitectura para actualizar la línea base de toda la plataforma.
 *
 * Carpeta: src/themes/plantilla/
 * Ruta app: /app/temas/plantilla
 */
export const config = buildTheme({
  id: "plantilla",
  name: "Plantilla",
  shortName: "Plantilla",
  description:
    "Línea base de referencia para temas operativos. Conservar sin cambios para comparar y restaurar módulos.",
  icon: "layout-template",
  unit: "registros",
  valueLabel: "Cantidad",
  extraFields: [
    {
      name: "tipo_registro",
      label: "Tipo de registro",
      type: "select",
      required: true,
      options: [
        "Operación",
        "Seguimiento",
        "Apoyo territorial",
        "Otro",
      ],
    },
    {
      name: "valor",
      label: "Valor (COP)",
      type: "number",
      required: true,
    },
    {
      name: "cantidad",
      label: "Cantidad",
      type: "number",
      required: true,
    },
    {
      name: "responsable",
      label: "Responsable",
      type: "text",
      required: true,
      placeholder: "Nombre o dependencia",
    },
  ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
