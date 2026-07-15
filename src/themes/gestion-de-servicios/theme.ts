import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Gestión de Servicios
 * Carpeta: src/themes/gestion-de-servicios/
 * Ruta app: /app/temas/gestion-de-servicios
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "gestion-de-servicios",
  name: "Gestión de Servicios",
  shortName: "Servicios",
  description: "Solicitudes y gestión de servicios institucionales.",
  icon: "briefcase",
  unit: "solicitudes",
  valueLabel: "Solicitudes",
  extraFields: [
      {
        name: "servicio",
        label: "Servicio",
        type: "select",
        required: true,
        options: ["Asesoría técnica", "Logística", "Transporte", "Almacenamiento", "Otro"],
      },
      { name: "solicitante", label: "Solicitante", type: "text", required: true },
      { name: "valor", label: "Costo estimado (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
