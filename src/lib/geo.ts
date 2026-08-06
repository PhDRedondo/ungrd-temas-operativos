import catalog from "../../data/divipola.json";

export type Municipality = {
  name: string;
  code: string;
  lat: number;
  lng: number;
  tipo?: string;
};

export type Department = {
  name: string;
  code: string;
  lat: number;
  lng: number;
  municipalities: Municipality[];
};

type DivipolaFile = {
  source: string;
  dataset: string;
  fetched: string;
  countDepartments: number;
  countMunicipalities: number;
  departments: Department[];
};

const data = catalog as DivipolaFile;

/** Catálogo geo: DIVIPOLA oficial (datos.gov.co) si está presente. */
export const GEO_SOURCE = {
  source: data.source,
  dataset: data.dataset,
  fetched: data.fetched,
  countDepartments: data.countDepartments,
  countMunicipalities: data.countMunicipalities,
};

export const DEPARTMENTS: Department[] = data.departments;

export function departmentNames(): string[] {
  return DEPARTMENTS.map((d) => d.name);
}

function foldGeo(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Alias frecuentes en Excel/maqueta → nombre DIVIPOLA canónico. */
const DEPARTMENT_ALIASES: Record<string, string> = {
  guajira: "La Guajira",
  "la guajira": "La Guajira",
  "nivel nacional": "Bogotá D.C.",
  "santa marta": "Magdalena",
  bogota: "Bogotá D.C.",
  "bogota d c": "Bogotá D.C.",
  "bogota dc": "Bogotá D.C.",
  "distrito capital": "Bogotá D.C.",
};

export function findDepartment(name: string): Department | undefined {
  const raw = String(name || "").trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const exact = DEPARTMENTS.find((d) => d.name.toLowerCase() === lower);
  if (exact) return exact;

  const folded = foldGeo(raw);
  const byFold = DEPARTMENTS.find((d) => foldGeo(d.name) === folded);
  if (byFold) return byFold;

  const stripped = folded.replace(/^(la|el|los|las)\s+/, "");
  const byStrip = DEPARTMENTS.find(
    (d) => foldGeo(d.name).replace(/^(la|el|los|las)\s+/, "") === stripped,
  );
  if (byStrip) return byStrip;

  const aliasName =
    DEPARTMENT_ALIASES[folded] || DEPARTMENT_ALIASES[stripped];
  if (aliasName) {
    return DEPARTMENTS.find((d) => d.name === aliasName);
  }
  return undefined;
}

export function findMunicipality(
  departmentName: string,
  municipalityName: string,
): Municipality | undefined {
  const dept = findDepartment(departmentName);
  if (!dept) return undefined;
  const raw = String(municipalityName || "").trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const exact = dept.municipalities.find((m) => m.name.toLowerCase() === lower);
  if (exact) return exact;
  const folded = foldGeo(raw);
  const byFold = dept.municipalities.find((m) => foldGeo(m.name) === folded);
  if (byFold) return byFold;
  // Primer municipio si el Excel puso el depto o un listado multilínea
  if (folded === foldGeo(dept.name) || raw.includes(",")) {
    return dept.municipalities[0];
  }
  return undefined;
}

/** Valida que el municipio pertenezca al departamento (DIVIPOLA). */
export function isValidMunicipio(
  departmentName: string,
  municipalityName: string,
): boolean {
  return Boolean(findMunicipality(departmentName, municipalityName));
}

export function municipalityNames(departmentName: string): string[] {
  return findDepartment(departmentName)?.municipalities.map((m) => m.name) ?? [];
}

/** Resuelve coordenadas aproximadas de un registro (municipio o departamento). */
export function resolveLocation(
  departamento: string,
  municipio: string,
): {
  lat: number;
  lng: number;
  label: string;
  level: "municipio" | "departamento";
} | null {
  const dept = findDepartment(departamento);
  if (!dept) return null;
  const muni = municipio.trim()
    ? findMunicipality(departamento, municipio)
    : undefined;
  if (muni) {
    return {
      lat: muni.lat,
      lng: muni.lng,
      label: `${muni.name}, ${dept.name}`,
      level: "municipio",
    };
  }
  return {
    lat: dept.lat,
    lng: dept.lng,
    label: dept.name,
    level: "departamento",
  };
}
