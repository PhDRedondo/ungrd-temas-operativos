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

export function findDepartment(name: string): Department | undefined {
  const n = name.trim().toLowerCase();
  return DEPARTMENTS.find((d) => d.name.toLowerCase() === n);
}

export function findMunicipality(
  departmentName: string,
  municipalityName: string,
): Municipality | undefined {
  const dept = findDepartment(departmentName);
  if (!dept) return undefined;
  const n = municipalityName.trim().toLowerCase();
  return dept.municipalities.find((m) => m.name.toLowerCase() === n);
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
