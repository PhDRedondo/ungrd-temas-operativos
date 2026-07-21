/** Tipos y helpers seguros para cliente (sin imports de DB). */

export type RecordRow = Record<string, string | number> & {
  id: string;
  departamento: string;
  municipio: string;
  fecha: string;
  estado: string;
  valor: number;
};

export function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}
