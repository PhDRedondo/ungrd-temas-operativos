/**
 * Cruces por clave de negocio entre temas source (OP, placa, CDP, declaratoria).
 */
import { enrichRecordsForDecision } from "@/lib/analytics/enrichRecords";
import { resolveDepartment } from "@/lib/geo/spatial";
import type { RecordRow } from "@/lib/records/types";
import { SOURCE_THEME_IDS } from "@/lib/analytics/decision";

export type CrosswalkType = "op" | "placa" | "cdp" | "declaratoria";

export type TimelineEvent = {
  id: string;
  themeId: string;
  themeLabel: string;
  fecha: string;
  estado: string;
  capa: string;
  clave: string;
  departamento: string;
  municipio: string;
  valor: number;
  summary: string;
};

export type CrosswalkResult = {
  type: CrosswalkType;
  query: string;
  normalizedKey: string;
  events: TimelineEvent[];
  relatedThemes: string[];
  territorial: {
    departamento: string;
    municipio: string;
    themeCounts: Record<string, number>;
  }[];
};

const THEME_LABEL: Record<string, string> = {
  fic: "FIC",
  "agua-y-saneamiento": "Agua y saneamiento",
  carrotanques: "Carrotanques",
  "banco-de-maquinaria": "Banco de maquinaria",
  "obras-de-emergencia": "Obras de emergencia",
  "obras-por-impuestos": "Obras por impuestos",
  puentes: "Puentes",
  "declaratoria-de-emergencia": "Declaratorias",
};

function normKey(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Base de la clave: "SMD-1 / pago 1" → "smd-1" */
function baseKey(raw: string) {
  return normKey(raw).split("/")[0]!.trim();
}

function rowClave(r: RecordRow) {
  return String(
    r.clave_seguimiento ||
      r.orden_de_proveeduria ||
      r.placa ||
      r.placa_ungrd ||
      r.serial ||
      r.no_cdp ||
      r.no_declaratoria ||
      r.no_convenio ||
      r.contrato_de_obra ||
      "",
  );
}

function matchesType(type: CrosswalkType, themeId: string, r: RecordRow, q: string) {
  const clave = baseKey(rowClave(r));
  if (!clave || !q) return false;

  if (type === "op") {
    if (
      themeId !== "agua-y-saneamiento" &&
      themeId !== "obras-de-emergencia"
    ) {
      return false;
    }
    return clave.includes(q) || q.includes(clave);
  }
  if (type === "placa") {
    if (themeId !== "carrotanques" && themeId !== "banco-de-maquinaria") {
      // control agua puede mencionar placa en texto — permitir si coincide
      if (themeId === "agua-y-saneamiento") {
        const blob = normKey(
          `${r.placa || ""} ${r.clave_seguimiento || ""} ${r.objeto || ""}`,
        );
        return blob.includes(q);
      }
      return false;
    }
    return clave.includes(q) || q.includes(clave);
  }
  if (type === "cdp") {
    if (themeId !== "fic" && themeId !== "agua-y-saneamiento") return false;
    const cdp = baseKey(String(r.no_cdp || r.n_cdp || r.clave_seguimiento || ""));
    return cdp.includes(q) || q.includes(cdp);
  }
  if (type === "declaratoria") {
    if (themeId !== "declaratoria-de-emergencia") return false;
    const d = baseKey(String(r.no_declaratoria || r.clave_seguimiento || ""));
    return d.includes(q) || q.includes(d);
  }
  return false;
}

function eventFrom(themeId: string, r: RecordRow): TimelineEvent {
  const capa = String(r.tipo_registro || r.capa || "Registro");
  const clave = rowClave(r) || "(sin clave)";
  const dept =
    resolveDepartment(String(r.departamento || ""))?.name ||
    String(r.departamento || "");
  return {
    id: String(r.id),
    themeId,
    themeLabel: THEME_LABEL[themeId] || themeId,
    fecha: String(r.fecha || "").slice(0, 10),
    estado: String(r.estado || "—"),
    capa,
    clave,
    departamento: dept,
    municipio: String(r.municipio || ""),
    valor: Number(r.valor || 0),
    summary: [capa, r.estado, dept].filter(Boolean).join(" · "),
  };
}

export function buildCrosswalk(
  bundle: Record<string, RecordRow[]>,
  type: CrosswalkType,
  query: string,
): CrosswalkResult {
  const q = baseKey(query);
  const events: TimelineEvent[] = [];

  for (const themeId of SOURCE_THEME_IDS) {
    const rows = enrichRecordsForDecision(bundle[themeId] || []);
    for (const r of rows) {
      if (matchesType(type, themeId, r, q)) {
        events.push(eventFrom(themeId, r));
      }
    }
  }

  events.sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Territorial: si es declaratoria, ampliar a intervenciones en mismos deptos
  const territorialMap = new Map<
    string,
    { departamento: string; municipio: string; themeCounts: Record<string, number> }
  >();

  const seedDepts = new Set(
    events.map((e) => e.departamento).filter((d) => d && !/^sin /i.test(d)),
  );

  if (type === "declaratoria" && seedDepts.size) {
    for (const e of events) {
      const key = `${e.departamento}||${e.municipio || "—"}`;
      const cur = territorialMap.get(key) || {
        departamento: e.departamento,
        municipio: e.municipio || "—",
        themeCounts: {},
      };
      cur.themeCounts[e.themeId] = (cur.themeCounts[e.themeId] || 0) + 1;
      territorialMap.set(key, cur);
    }
    const interventionThemes = [
      "agua-y-saneamiento",
      "obras-de-emergencia",
      "carrotanques",
      "banco-de-maquinaria",
      "fic",
    ] as const;
    for (const themeId of interventionThemes) {
      for (const r of enrichRecordsForDecision(bundle[themeId] || [])) {
        const dept =
          resolveDepartment(String(r.departamento || ""))?.name || "";
        if (!dept || !seedDepts.has(dept)) continue;
        const muni = String(r.municipio || "").trim() || "—";
        const key = `${dept}||${muni}`;
        const cur = territorialMap.get(key) || {
          departamento: dept,
          municipio: muni,
          themeCounts: {},
        };
        cur.themeCounts[themeId] = (cur.themeCounts[themeId] || 0) + 1;
        territorialMap.set(key, cur);
        // Incluir intervenciones del mismo departamento en el expediente
        if (events.length < 200) {
          events.push(eventFrom(themeId, r));
        }
      }
    }
    events.sort((a, b) => b.fecha.localeCompare(a.fecha));
  } else {
    for (const e of events) {
      const key = `${e.departamento}||${e.municipio || "—"}`;
      const cur = territorialMap.get(key) || {
        departamento: e.departamento,
        municipio: e.municipio || "—",
        themeCounts: {},
      };
      cur.themeCounts[e.themeId] = (cur.themeCounts[e.themeId] || 0) + 1;
      territorialMap.set(key, cur);
    }
  }

  return {
    type,
    query,
    normalizedKey: q,
    events: events.slice(0, 200),
    relatedThemes: [...new Set(events.map((e) => e.themeId))],
    territorial: [...territorialMap.values()].slice(0, 40),
  };
}

export function isCrosswalkType(v: string): v is CrosswalkType {
  return v === "op" || v === "placa" || v === "cdp" || v === "declaratoria";
}
