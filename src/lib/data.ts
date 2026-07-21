/**
 * Compatibilidad: reexporta helpers de formato (cliente-safe).
 * Persistencia: `@/lib/records/repository` (solo servidor).
 */
export {
  formatCop,
  formatNumber,
  type RecordRow,
} from "@/lib/records/types";

/** @deprecated Usar API `/api/themes/[slug]/records` */
export function addRecords() {
  throw new Error(
    "addRecords en cliente ya no persiste. Use la API /api/themes/[slug]/records",
  );
}

/** @deprecated Usar API GET `/api/themes/[slug]/records` */
export function getRecordsForTheme(): never {
  throw new Error(
    "getRecordsForTheme sync eliminado. Use fetch('/api/themes/[slug]/records')",
  );
}
