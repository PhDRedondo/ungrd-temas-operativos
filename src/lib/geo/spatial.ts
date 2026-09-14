/**
 * Normalización y emparejamiento geo (DIVIPOLA) para mapas y filtros.
 */
import {
  findDepartment,
  type Department,
  type Municipality,
} from "@/lib/geo";

export function normalizeGeoKey(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/departamento( de| del)?/g, "")
    .replace(/dpto\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function resolveDepartment(raw: string): Department | undefined {
  const s = String(raw || "").trim();
  if (!s || /^sin departamento$/i.test(s) || /^#?n\/?a$/i.test(s)) {
    return undefined;
  }
  if (/nivel nacional/i.test(s)) return undefined;
  return findDepartment(s);
}

export function resolveMunicipality(
  departmentRaw: string,
  municipalityRaw: string,
): Municipality | undefined {
  const dept = resolveDepartment(departmentRaw);
  if (!dept) return undefined;
  const s = String(municipalityRaw || "").trim();
  if (!s || /^sin municipio$/i.test(s)) return undefined;
  const key = normalizeGeoKey(s);
  return dept.municipalities.find((m) => normalizeGeoKey(m.name) === key);
}

export type AreaStat = {
  /** Nombre canónico DIVIPOLA */
  name: string;
  code?: string;
  valor: number;
  count: number;
};

export type MapMetric = "valor" | "count";

/** Agrega filas por departamento o municipio con nombres canónicos. */
export function aggregateSpatial(
  rows: {
    departamento?: unknown;
    municipio?: unknown;
    valor?: unknown;
  }[],
  opts: { department?: string },
): { areas: AreaStat[]; metric: MapMetric; unmatched: number } {
  const map = new Map<string, AreaStat>();
  let unmatched = 0;
  let anyValor = false;

  for (const r of rows) {
    if (Number(r.valor || 0) > 0) {
      anyValor = true;
      break;
    }
  }

  if (opts.department) {
    const dept = resolveDepartment(opts.department);
    for (const r of rows) {
      const muni = resolveMunicipality(
        opts.department,
        String(r.municipio || ""),
      );
      if (!muni) {
        unmatched += 1;
        continue;
      }
      const cur = map.get(muni.name) || {
        name: muni.name,
        code: muni.code,
        valor: 0,
        count: 0,
      };
      cur.valor += Number(r.valor || 0);
      cur.count += 1;
      map.set(muni.name, cur);
    }
    return {
      areas: [...map.values()].sort((a, b) =>
        anyValor ? b.valor - a.valor : b.count - a.count,
      ),
      metric: anyValor ? "valor" : "count",
      unmatched,
    };
  }

  for (const r of rows) {
    const dept = resolveDepartment(String(r.departamento || ""));
    if (!dept) {
      unmatched += 1;
      continue;
    }
    const cur = map.get(dept.name) || {
      name: dept.name,
      code: dept.code,
      valor: 0,
      count: 0,
    };
    cur.valor += Number(r.valor || 0);
    cur.count += 1;
    map.set(dept.name, cur);
  }

  return {
    areas: [...map.values()].sort((a, b) =>
      anyValor ? b.valor - a.valor : b.count - a.count,
    ),
    metric: anyValor ? "valor" : "count",
    unmatched,
  };
}

/** Quiebres por cuantiles (comunicación clara de intensidad). */
export function quantileBreaks(values: number[], classes = 5): number[] {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!sorted.length) return [];
  if (sorted.length === 1) return [sorted[0]!];
  const breaks: number[] = [];
  for (let i = 1; i <= classes; i++) {
    const pos = (i / classes) * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const v =
      lo === hi
        ? sorted[lo]!
        : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
    breaks.push(v);
  }
  return [...new Set(breaks.map((b) => Number(b.toPrecision(6))))].sort(
    (a, b) => a - b,
  );
}

export function classForValue(value: number, breaks: number[]): number {
  if (value <= 0 || !breaks.length) return -1;
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]!) return i;
  }
  return breaks.length - 1;
}

/** Escala secuencial: bajo (frío) → alto (cálido/alerta). */
export const CHOROPLETH_COLORS = [
  "#d6e4f0",
  "#8fb4d4",
  "#3d7ea6",
  "#0a3d6b",
  "#f0a202",
  "#c62828",
] as const;

export function colorForClass(classIndex: number): string {
  if (classIndex < 0) return "#e8eef4";
  return CHOROPLETH_COLORS[
    Math.min(classIndex, CHOROPLETH_COLORS.length - 1)
  ]!;
}
