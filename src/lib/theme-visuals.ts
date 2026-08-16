/**
 * Identidad visual por tema (solo UI). No altera campos, capas ni persistencia.
 */

export type ThemeVisual = {
  id: string;
  kicker: string;
  accent: string;
  accentSoft: string;
  wash: string;
  /** Texto sobre fondos claros (wash / superficie). */
  ink: string;
  /** Texto sobre el acento (siempre contraste alto). */
  onAccent: string;
};

const DEFAULT: ThemeVisual = {
  id: "default",
  kicker: "Temas operativos",
  accent: "#ffd100",
  accentSoft: "#ffe566",
  wash: "#eef2f6",
  ink: "#001a36",
  /** Amarillo UNGRD → tinta navy (no blanco). */
  onAccent: "#001a36",
};

const BY_ID: Record<string, ThemeVisual> = {
  "agua-y-saneamiento": {
    id: "agua-y-saneamiento",
    kicker: "Abastecimiento hídrico",
    accent: "#0e7490",
    accentSoft: "#67e8f9",
    wash: "#e4f4f8",
    ink: "#083344",
    onAccent: "#ffffff",
  },
  puentes: {
    id: "puentes",
    kicker: "Infraestructura vial",
    accent: "#b45309",
    accentSoft: "#fbbf24",
    wash: "#f6efe6",
    ink: "#431407",
    onAccent: "#ffffff",
  },
  carrotanques: {
    id: "carrotanques",
    kicker: "Flota de suministro",
    accent: "#a16207",
    accentSoft: "#facc15",
    wash: "#f7f1dc",
    ink: "#422006",
    onAccent: "#ffffff",
  },
  "banco-de-maquinaria": {
    id: "banco-de-maquinaria",
    kicker: "Maquinaria y convenios",
    accent: "#c2410c",
    accentSoft: "#fdba74",
    wash: "#f8ece4",
    ink: "#431407",
    onAccent: "#ffffff",
  },
  "subsidios-de-arriendos": {
    id: "subsidios-de-arriendos",
    kicker: "Arrendamiento humanitario",
    accent: "#9a3412",
    accentSoft: "#fdba74",
    wash: "#f7ebe4",
    ink: "#431407",
    onAccent: "#ffffff",
  },
  "obras-de-emergencia": {
    id: "obras-de-emergencia",
    kicker: "Obras de emergencia",
    accent: "#1d4ed8",
    accentSoft: "#93c5fd",
    wash: "#e8eef8",
    ink: "#1e3a8a",
    onAccent: "#ffffff",
  },
  "obras-por-impuestos": {
    id: "obras-por-impuestos",
    kicker: "Obras por impuestos",
    accent: "#0f766e",
    accentSoft: "#5eead4",
    wash: "#e7f4f2",
    ink: "#134e4a",
    onAccent: "#ffffff",
  },
  "declaratoria-de-emergencia": {
    id: "declaratoria-de-emergencia",
    kicker: "Declaratoria",
    accent: "#b91c1c",
    accentSoft: "#fca5a5",
    wash: "#f8eaea",
    ink: "#7f1d1d",
    onAccent: "#ffffff",
  },
  "asistencia-humanitaria": {
    id: "asistencia-humanitaria",
    kicker: "Asistencia humanitaria",
    accent: "#be185d",
    accentSoft: "#f9a8d4",
    wash: "#f8eaf1",
    ink: "#831843",
    onAccent: "#ffffff",
  },
  "gestion-de-servicios": {
    id: "gestion-de-servicios",
    kicker: "Gestión de servicios",
    accent: "#4338ca",
    accentSoft: "#a5b4fc",
    wash: "#eceef8",
    ink: "#312e81",
    onAccent: "#ffffff",
  },
  "alertas-tempranas": {
    id: "alertas-tempranas",
    kicker: "Alertas tempranas",
    accent: "#ca8a04",
    accentSoft: "#fde047",
    wash: "#f7f3de",
    ink: "#713f12",
    onAccent: "#ffffff",
  },
  "asistencia-tecnica": {
    id: "asistencia-tecnica",
    kicker: "Asistencia técnica",
    accent: "#3f6212",
    accentSoft: "#bef264",
    wash: "#eef4e6",
    ink: "#365314",
    onAccent: "#ffffff",
  },
  "equipo-de-respuesta": {
    id: "equipo-de-respuesta",
    kicker: "Equipo de respuesta",
    accent: "#0369a1",
    accentSoft: "#7dd3fc",
    wash: "#e6f1f7",
    ink: "#0c4a6e",
    onAccent: "#ffffff",
  },
  "compra-de-materiales": {
    id: "compra-de-materiales",
    kicker: "Compra de materiales",
    accent: "#0f766e",
    accentSoft: "#5eead4",
    wash: "#e8f4f2",
    ink: "#134e4a",
    onAccent: "#ffffff",
  },
  fic: {
    id: "fic",
    kicker: "FIC",
    accent: "#1e40af",
    accentSoft: "#93c5fd",
    wash: "#e8eef8",
    ink: "#1e3a8a",
    onAccent: "#ffffff",
  },
  convenios: {
    id: "convenios",
    kicker: "Convenios",
    accent: "#6d28d9",
    accentSoft: "#c4b5fd",
    wash: "#f0eaf8",
    ink: "#4c1d95",
    onAccent: "#ffffff",
  },
  presupuesto: {
    id: "presupuesto",
    kicker: "Presupuesto",
    accent: "#047857",
    accentSoft: "#6ee7b7",
    wash: "#e7f4ee",
    ink: "#064e3b",
    onAccent: "#ffffff",
  },
  "ejecucion-financiera": {
    id: "ejecucion-financiera",
    kicker: "Ejecución financiera",
    accent: "#0f766e",
    accentSoft: "#5eead4",
    wash: "#e6f3f1",
    ink: "#134e4a",
    onAccent: "#ffffff",
  },
  materiales: {
    id: "materiales",
    kicker: "Materiales",
    accent: "#57534e",
    accentSoft: "#d6d3d1",
    wash: "#f0eeeb",
    ink: "#292524",
    onAccent: "#ffffff",
  },
  plantilla: {
    id: "plantilla",
    kicker: "Línea base",
    accent: "#64748b",
    accentSoft: "#cbd5e1",
    wash: "#eef1f4",
    ink: "#334155",
    onAccent: "#ffffff",
  },
};

export function getThemeVisual(themeId: string | null | undefined): ThemeVisual {
  if (!themeId) return DEFAULT;
  return BY_ID[themeId] || DEFAULT;
}

export function themeIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/app\/temas\/([^/?#]+)/);
  return m?.[1] || null;
}
