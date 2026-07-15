import { DEPARTMENTS } from "./geo";
import { THEMES, type ThemeConfig } from "./themes";

export type RecordRow = Record<string, string | number> & {
  id: string;
  departamento: string;
  municipio: string;
  fecha: string;
  estado: string;
  valor: number;
};

const ESTADOS = ["Programado", "En ejecución", "Finalizado", "Suspendido"] as const;

function seed(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function rng(s: number) {
  let x = s || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function monthDates(rand: () => number, count: number) {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const month = String(Math.floor(rand() * 12) + 1).padStart(2, "0");
    const day = String(Math.floor(rand() * 28) + 1).padStart(2, "0");
    const year = rand() > 0.35 ? 2026 : 2025;
    out.push(`${year}-${month}-${day}`);
  }
  return out;
}

export function generateDemoRecords(theme: ThemeConfig, n = 48): RecordRow[] {
  const rand = rng(seed(theme.id));
  const dates = monthDates(rand, n);
  const rows: RecordRow[] = [];

  for (let i = 0; i < n; i++) {
    const dept = pick(rand, DEPARTMENTS);
    const muni = pick(rand, dept.municipalities);
    const estado = pick(rand, ESTADOS);
    const base: RecordRow = {
      id: `${theme.id}-${i + 1}`,
      departamento: dept.name,
      municipio: muni.name,
      fecha: dates[i]!,
      estado,
      valor: Math.round((rand() * 800 + 50) * 1_000_000),
      observaciones: "",
    };

    for (const field of theme.fields) {
      if (base[field.name] !== undefined) continue;
      if (field.type === "select" && field.options?.length) {
        base[field.name] = pick(rand, field.options);
      } else if (field.type === "number") {
        base[field.name] = Math.round(rand() * 500 + 10);
      } else if (field.type === "date") {
        base[field.name] = dates[i]!;
      } else if (field.name === "observaciones") {
        base[field.name] = "";
      } else {
        base[field.name] = `${field.label} ${i + 1}`;
      }
    }

    rows.push(base);
  }

  return rows;
}

const cache = new Map<string, RecordRow[]>();

export function getRecordsForTheme(themeId: string): RecordRow[] {
  if (!cache.has(themeId)) {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) return [];
    cache.set(themeId, generateDemoRecords(theme));
  }
  return cache.get(themeId)!;
}

export function addRecords(themeId: string, rows: RecordRow[]) {
  const current = getRecordsForTheme(themeId);
  cache.set(themeId, [...rows, ...current]);
}

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
