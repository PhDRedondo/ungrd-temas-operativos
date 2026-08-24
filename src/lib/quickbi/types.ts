/**
 * Tipos QuickBI (patrón SNI): pageId + accessTicket fresco desde backend.
 */

export type QuickBiParamValue =
  | string
  | number
  | boolean
  | string[]
  | undefined
  | null;

export type QuickBiParams = Record<string, QuickBiParamValue>;

/** Metadatos de catálogo (sin ticket; el ticket lo emite la API). */
export type QuickBiDashboardMeta = {
  /** Clave lógica estable dentro del tema */
  id: string;
  title: string;
  description: string;
  pageId: string;
  /**
   * Ticket estático de fallback cuando no hay AccessKey CreateTicket.
   * Preferible regenerar vía API.
   */
  accessTicket?: string;
  host?: string;
  client?: "pc" | "mobile";
};

/** Descriptor listo para el iframe (ticket resuelto). */
export type QuickBiDashboard = QuickBiDashboardMeta & {
  accessTicket: string;
};

export type EmbedUrlResponse = {
  pageId: string;
  accessTicket: string;
  expiresAt: string;
  host: string;
  /** true si el ticket viene del catálogo estático (sin CreateTicket) */
  fallback?: boolean;
};
