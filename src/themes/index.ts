/**
 * Registro de temas UNGRD.
 *
 * Para agregar un tema nuevo:
 * 1. Cree src/themes/<slug>/ con theme.ts + index.ts
 * 2. Impórtelo abajo y añádalo a THEME_MODULES
 * 3. No copie lógica de otros temas: trabaje en su carpeta
 */
import aguaYSaneamientoTheme from "./agua-y-saneamiento";
import carrotanquesTheme from "./carrotanques";
import obrasDeEmergenciaTheme from "./obras-de-emergencia";
import puentesTheme from "./puentes";
import bancoDeMaquinariaTheme from "./banco-de-maquinaria";
import obrasPorImpuestosTheme from "./obras-por-impuestos";
import asistenciaHumanitariaTheme from "./asistencia-humanitaria";
import gestionDeServiciosTheme from "./gestion-de-servicios";
import subsidiosDeArriendosTheme from "./subsidios-de-arriendos";
import alertasTempranasTheme from "./alertas-tempranas";
import asistenciaTecnicaTheme from "./asistencia-tecnica";
import equipoDeRespuestaTheme from "./equipo-de-respuesta";
import compraDeMaterialesTheme from "./compra-de-materiales";
import ficTheme from "./fic";
import conveniosTheme from "./convenios";
import presupuestoTheme from "./presupuesto";
import ejecucionFinancieraTheme from "./ejecucion-financiera";
import materialesTheme from "./materiales";
import declaratoriaDeEmergenciaTheme from "./declaratoria-de-emergencia";
import type { ThemeConfig, ThemeModule } from "./shared";

export type { FieldType, FormField, ThemeConfig, ThemeModule } from "./shared";
export { buildTheme, GEO_FIELDS, BASE_DATE_FIELDS } from "./shared";

export const THEME_MODULES: ThemeModule[] = [
  aguaYSaneamientoTheme,
  carrotanquesTheme,
  obrasDeEmergenciaTheme,
  puentesTheme,
  bancoDeMaquinariaTheme,
  obrasPorImpuestosTheme,
  asistenciaHumanitariaTheme,
  gestionDeServiciosTheme,
  subsidiosDeArriendosTheme,
  alertasTempranasTheme,
  asistenciaTecnicaTheme,
  equipoDeRespuestaTheme,
  compraDeMaterialesTheme,
  ficTheme,
  conveniosTheme,
  presupuestoTheme,
  ejecucionFinancieraTheme,
  materialesTheme,
  declaratoriaDeEmergenciaTheme,
];

export const THEMES: ThemeConfig[] = THEME_MODULES.map((m) => m.config);

export function getTheme(id: string): ThemeConfig | undefined {
  return THEMES.find((t) => t.id === id);
}

export function getThemeModule(id: string): ThemeModule | undefined {
  return THEME_MODULES.find((m) => m.config.id === id);
}
