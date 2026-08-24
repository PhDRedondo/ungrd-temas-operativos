/**
 * Catálogo QuickBI por tema — fuente: Relacion Datos SMD.
 * Solo `pageId` (+ ticket estático opcional de fallback). El ticket vivo
 * lo emite `POST /api/quickbi/embed-url` (patrón SNI).
 */

import { parseQuickBiUrl } from "./build-embed-url";
import type { QuickBiDashboardMeta } from "./types";

export type { QuickBiDashboardMeta as QuickBiDashboard };

const DEFAULT_HOST = "bi-us-east-1.alibabacloud.com";

const DESCRIPTIONS: Record<string, string> = {
  "Estado General":
    "Visión panorámica del estado operativo de la línea: cobertura, avance y situación consolidada.",
  "Gestion tecnica y de pago":
    "Seguimiento de la gestión técnica y del ciclo de pagos asociados a la operación.",
  "Gestión técnica y de pago":
    "Seguimiento de la gestión técnica y del ciclo de pagos asociados a la operación.",
  "Gestion Tecnica":
    "Seguimiento técnico de la ejecución: avances, cuellos de botella y estado de obras o servicios.",
  "Gestión Técnica":
    "Seguimiento técnico de la ejecución: avances, cuellos de botella y estado de obras o servicios.",
  Resumen:
    "Síntesis ejecutiva para mando: cifras clave y lectura rápida del frente.",
  "KPI Responsable":
    "Indicadores de desempeño por responsable / equipo, para seguimiento y rendición de cuentas.",
  "Tablero Unico":
    "Tablero consolidado del tema: una sola vista ejecutiva con lo esencial de la línea.",
  "Tablero Único":
    "Tablero consolidado del tema: una sola vista ejecutiva con lo esencial de la línea.",
  "Tablero principal":
    "Tablero principal de asistencias técnicas: volumen, cobertura territorial y tipología.",
  KPIs:
    "KPIs de asistencias técnicas: metas, tiempos y resultados agregados.",
  "Tablero 1":
    "Tablero principal de asistencias técnicas: volumen, cobertura territorial y tipología.",
  "Tablero 2 (KPIS)":
    "KPIs de asistencias técnicas: metas, tiempos y resultados agregados.",
};

function descFor(title: string): string {
  if (DESCRIPTIONS[title]) return DESCRIPTIONS[title];
  const key = Object.keys(DESCRIPTIONS).find(
    (k) => k.toLowerCase() === title.toLowerCase(),
  );
  if (key) return DESCRIPTIONS[key]!;
  return "Tablero ejecutivo QuickBI de la Subdirección de Manejo para este tema.";
}

function slugId(title: string, pageId: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "tablero"}-${pageId.slice(0, 8)}`;
}

function board(
  title: string,
  pageId: string,
  opts?: { accessTicket?: string; host?: string },
): QuickBiDashboardMeta {
  return {
    id: slugId(title, pageId),
    title,
    description: descFor(title),
    pageId,
    accessTicket: opts?.accessTicket,
    host: opts?.host || DEFAULT_HOST,
  };
}

/** Desde URL legacy (tema.quickBiUrl / quickBiDashboards[].url). */
export function metaFromEmbedUrl(
  title: string,
  url: string,
  description?: string,
): QuickBiDashboardMeta | null {
  const parsed = parseQuickBiUrl(url);
  if (!parsed) return null;
  return {
    id: slugId(title, parsed.pageId),
    title,
    description: description || descFor(title),
    pageId: parsed.pageId,
    accessTicket: parsed.accessTicket,
    host: parsed.host,
  };
}

/**
 * Tableros por `theme.id`. Temas sin entrada muestran el vacío en QuickBIPanel.
 */
export const QUICKBI_BY_THEME: Record<string, QuickBiDashboardMeta[]> = {
  "agua-y-saneamiento": [
    board("Estado General", "791b52bf-c7da-4033-a31a-d625b3756fa9"),
    board("Gestión Técnica", "7c3416fc-d83e-4d40-99d0-03283baf280d"),
    board("Resumen", "d43c412e-a5ea-4c7a-84a3-51b0bddd1fb9"),
    board("KPI Responsable", "07748495-3a20-4460-a0c8-3792adcbb28e"),
  ],
  carrotanques: [
    board("Tablero Único", "51e53071-8f89-479f-9298-dc06ddd2f12f", {
      accessTicket: "dfa8ac78-7595-4b73-8f92-c4cc5679e10b",
    }),
  ],
  puentes: [
    board("Tablero Único", "273bfe73-74ce-4177-b33c-ff39177c8de4", {
      accessTicket: "8c47def9-676b-41fb-8b77-08466ba15d61",
    }),
  ],
  "subsidios-de-arriendos": [
    board("Tablero Único", "e4247567-d882-4b99-ac49-f03ff545ddf8", {
      accessTicket: "5ba13903-b64e-4261-a6ef-cfa635768e02",
    }),
  ],
  "alertas-tempranas": [
    board("Tablero Único", "214655ce-d680-47ec-bda0-ffaeb308076c"),
  ],
  "asistencia-tecnica": [
    board("Tablero principal", "de029acd-7200-4ba5-8334-55230ef98753"),
    board("KPIs", "7d03b538-dc1c-40be-b725-c2e5ea29ea1d"),
  ],
  fic: [board("Tablero Único", "7f0750a2-603a-4e82-922a-0b84fac8b071")],
  "gestion-de-servicios": [
    board("Tablero Único", "7f0750a2-603a-4e82-922a-0b84fac8b071"),
  ],
  /**
   * Maquinaria Amarilla (Excel SMD) → Banco de Maquinaria en la app.
   */
  "banco-de-maquinaria": [
    board("Estado General", "d266b1ba-04d5-4b0c-843a-cc4e5509daa4"),
    board("Gestión técnica y de pago", "5c0a7dce-52c8-41a9-8144-d122b58688e0"),
    board("Resumen", "facb059f-23c0-4516-98e1-38f46a476407"),
    board("KPI Responsable", "991cd475-d16c-4873-841b-e7f3c46d7ffb"),
  ],
};

export function getQuickBiDashboards(themeId: string): QuickBiDashboardMeta[] {
  return QUICKBI_BY_THEME[themeId] || [];
}

/** pageIds conocidos del catálogo (autorización del endpoint embed-url). */
export function getKnownQuickBiPageIds(): Set<string> {
  const ids = new Set<string>();
  for (const boards of Object.values(QUICKBI_BY_THEME)) {
    for (const b of boards) ids.add(b.pageId);
  }
  return ids;
}

export function findCatalogBoardByPageId(
  pageId: string,
): QuickBiDashboardMeta | undefined {
  for (const boards of Object.values(QUICKBI_BY_THEME)) {
    const hit = boards.find((b) => b.pageId === pageId);
    if (hit) return hit;
  }
  return undefined;
}
