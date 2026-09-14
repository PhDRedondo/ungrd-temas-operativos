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
  "san andres": "San Andrés y Providencia",
  "san andres y providencia": "San Andrés y Providencia",
  "san andres y providencia islas": "San Andrés y Providencia",
  "san andres providencia y santa catalina": "San Andrés y Providencia",
  "archipielago de san andres": "San Andrés y Providencia",
  "archipielago de san andres providencia y santa catalina":
    "San Andrés y Providencia",
  guiainia: "Guainía",
  valle: "Valle del Cauca",
  providencia: "San Andrés y Providencia",
};

export function findDepartment(name: string): Department | undefined {
  const raw = String(name || "").replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  if (/^\d{1,2}$/.test(raw)) {
    const code = raw.padStart(2, "0");
    const byCode = DEPARTMENTS.find((d) => d.code === code);
    if (byCode) return byCode;
  }
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

  const munHits: Department[] = [];
  for (const d of DEPARTMENTS) {
    if (matchMunicipalityInDept(d, raw)) munHits.push(d);
  }
  if (munHits.length === 1) return munHits[0];
  return undefined;
}

function matchMunicipalityInDept(
  dept: Department,
  municipalityName: string,
): Municipality | undefined {
  const raw = String(municipalityName || "").trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const exact = dept.municipalities.find((m) => m.name.toLowerCase() === lower);
  if (exact) return exact;
  const folded = foldGeo(raw);
  return dept.municipalities.find((m) => foldGeo(m.name) === folded);
}

export function findMunicipality(
  departmentName: string,
  municipalityName: string,
): Municipality | undefined {
  const dept = findDepartment(departmentName);
  if (!dept) return undefined;
  const raw = String(municipalityName || "").trim();
  if (!raw) return undefined;
  const hit = matchMunicipalityInDept(dept, raw);
  if (hit) return hit;
  const folded = foldGeo(raw);
  // Primer municipio si el Excel puso el depto o un listado multilínea
  if (folded === foldGeo(dept.name) || raw.includes(",")) {
    return dept.municipalities[0];
  }
  return undefined;
}

/** Nombre DIVIPOLA del departamento; si no hay match, se deja el texto original. */
export function canonicalizeDepartment(name: string): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  return findDepartment(raw)?.name || raw;
}

/** Nombre DIVIPOLA del municipio en ese depto; no inventa si no hay match. */
export function canonicalizeMunicipality(
  departmentName: string,
  municipalityName: string,
): string {
  const raw = String(municipalityName || "").trim();
  if (!raw) return "";
  const dept = findDepartment(departmentName);
  if (!dept) return raw;
  return matchMunicipalityInDept(dept, raw)?.name || raw;
}

export function sameDepartment(recordDept: string, filterDept: string): boolean {
  const filter = String(filterDept || "").trim();
  if (!filter) return true;
  const rec = String(recordDept || "").trim();
  if (!rec) return false;
  if (rec === filter) return true;
  const a = findDepartment(rec);
  const b = findDepartment(filter);
  return Boolean(a && b && a.code === b.code);
}

export function sameMunicipality(
  recordDept: string,
  recordMuni: string,
  filterDept: string,
  filterMuni: string,
): boolean {
  const filter = String(filterMuni || "").trim();
  if (!filter) return true;
  const rec = String(recordMuni || "").trim();
  if (!rec) return false;
  if (rec === filter) return true;
  const dept = findDepartment(recordDept) || findDepartment(filterDept);
  if (!dept) return false;
  const a = matchMunicipalityInDept(dept, rec);
  const b = matchMunicipalityInDept(dept, filter);
  return Boolean(a && b && a.code === b.code);
}

const EMPTY_DEPT = /^(sin departamento|n\/?a|#n\/?a|no registra|s\/?d)?$/i;
const EMPTY_MUN = /^(sin municipio|n\/?a|#n\/?a|no registra|s\/?d)?$/i;

export function isBlankDepartment(raw: string): boolean {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  return !s || EMPTY_DEPT.test(s);
}

export function isBlankMunicipality(raw: string): boolean {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  return !s || EMPTY_MUN.test(s);
}

function looksLikeDepartmentName(raw: string, dept: Department): boolean {
  const folded = foldGeo(raw);
  if (/^\d{1,2}$/.test(String(raw).trim())) return true;
  if (foldGeo(dept.name) === folded) return true;
  const stripped = folded.replace(/^(la|el|los|las)\s+/, "");
  if (foldGeo(dept.name).replace(/^(la|el|los|las)\s+/, "") === stripped) {
    return true;
  }
  return Boolean(DEPARTMENT_ALIASES[folded] || DEPARTMENT_ALIASES[stripped]);
}

/**
 * Persistible: nombres DIVIPOLA canónicos.
 * Si el Excel puso un municipio en departamento y el mpio viene vacío, se parte.
 * No inventa territorio para entidades (Cruz Roja, SENA, etc.).
 */
export function normalizeRecordGeo(
  departamento: string,
  municipio: string,
): { departamento: string; municipio: string } {
  const deptRaw = String(departamento || "").replace(/\s+/g, " ").trim();
  const muniRaw = String(municipio || "").replace(/\s+/g, " ").trim();
  const deptBlank = isBlankDepartment(deptRaw);
  const muniBlank = isBlankMunicipality(muniRaw);

  if (deptBlank) {
    return { departamento: deptRaw, municipio: muniRaw };
  }

  const dept = findDepartment(deptRaw);
  if (!dept) {
    const dashed = deptRaw.split(/\s+[-–]\s+/);
    if (dashed.length === 2) {
      const dashDept = findDepartment(dashed[0]!);
      if (dashDept) {
        const fromDash = canonicalizeMunicipality(dashDept.name, dashed[1]!);
        return {
          departamento: dashDept.name,
          municipio: muniBlank ? fromDash : canonicalizeMunicipality(dashDept.name, muniRaw),
        };
      }
    }
    return { departamento: deptRaw, municipio: muniRaw };
  }

  if (!looksLikeDepartmentName(deptRaw, dept) && muniBlank) {
    const muniHit = matchMunicipalityInDept(dept, deptRaw);
    return {
      departamento: dept.name,
      municipio: muniHit?.name || muniRaw,
    };
  }

  return {
    departamento: dept.name,
    municipio: muniBlank
      ? muniRaw
      : canonicalizeMunicipality(dept.name, muniRaw),
  };
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
