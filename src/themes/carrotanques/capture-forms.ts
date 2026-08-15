/**
 * Formularios operativos Carrotanques.
 *
 * Llave: `placa` → `clave_seguimiento`.
 *
 * Maqueta (inventario):
 *  - B–J: ingreso inicial (inmutable tras el alta)
 *  - K, L: categorías / propiedad (editables sobre la misma maqueta)
 *  - M–P y T–Z: reflejo del último evento de Bitácora
 *  - Q–R–S: sumatoria de Suministro DEF por placa
 */
import type { CaptureFormConfig } from "../shared";
import {
  CARRO_MAQUETA_IMMUTABLE_FIELDS,
  CARRO_MAQUETA_MUTABLE_FIELDS,
} from "./maqueta-mutable";

export const CARRO_CAPAS = [
  "Maqueta / inventario",
  "Bitácora estado",
  "Suministro / viajes",
] as const;

export type CarroCapa = (typeof CARRO_CAPAS)[number];

/** Capas append que alimentan la maqueta. */
export const CARRO_TABLAS_ACTUALIZABLES: CarroCapa[] = [
  "Bitácora estado",
  "Suministro / viajes",
];

export const CARRO_CAPA_ALIASES: Record<string, CarroCapa> = {
  MAQUETA: "Maqueta / inventario",
  Maqueta: "Maqueta / inventario",
  maqueta: "Maqueta / inventario",
  inventario: "Maqueta / inventario",
  Bitacora: "Bitácora estado",
  bitacora: "Bitácora estado",
  "SUMINISTRO DEF": "Suministro / viajes",
  "suministro def": "Suministro / viajes",
  suministro: "Suministro / viajes",
};

export function normalizeCarroCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const alias = CARRO_CAPA_ALIASES[s] || CARRO_CAPA_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if ((CARRO_CAPAS as readonly string[]).includes(s)) return s;
  return s;
}

export function carroCapaLookupVariants(capa: string): string[] {
  const raw = String(capa || "").trim();
  const canon = normalizeCarroCapa(raw) || raw;
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (canon) out.add(canon);
  for (const [alias, target] of Object.entries(CARRO_CAPA_ALIASES)) {
    if (target === canon) {
      out.add(alias);
      out.add(target);
    }
  }
  return [...out].filter(Boolean);
}

/** Identidad del activo: no se reescribe en bitácora / suministro. */
const PLACA = ["placa"] as const;

/** B–J · ingreso inicial (no cambia). */
const ALTA_ESTATICA = [...CARRO_MAQUETA_IMMUTABLE_FIELDS] as string[];

const LOOKUP_MAQUETA = {
  requiresOrdenLookup: true,
  lookupBy: "placa" as const,
  lookupCapa: "Maqueta / inventario",
};

export const CARRO_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "alta-maqueta",
    label: "1 · Alta maqueta (B–J)",
    description:
      "Registro inicial del carrotanque (placa, UNGRD, clase, marca, modelo, serial, año, capacidad). Estos datos no se modifican después. Departamento, municipio y región se capturan en Bitácora (M–P) y se reflejan en la maqueta con el último evento.",
    capa: "Maqueta / inventario",
    mode: "create-once",
    requiredNames: ["placa"],
    fieldNames: [...ALTA_ESTATICA],
  },
  {
    id: "actualizar-categorias",
    label: "2 · Categorías (K–L) · mismo registro",
    description:
      "Otras categorizaciones (K) y Clasificación propiedad (L) cambian sobre la misma fila de maqueta. Busque la placa, edite y guarde: no crea otro registro ni toca B–J.",
    capa: "Maqueta / inventario",
    mode: "upsert",
    ...LOOKUP_MAQUETA,
    fieldNames: [...PLACA, ...CARRO_MAQUETA_MUTABLE_FIELDS],
    patchFieldNames: [...CARRO_MAQUETA_MUTABLE_FIELDS],
    readonlyWhenEditing: [...PLACA],
  },
  {
    id: "bitacora",
    label: "3 · Bitácora de estado",
    description:
      "Nuevo evento de la placa: ubicación, región, departamento, municipio, estado carrotanque, situación, fechas inicio/fin, ente y observaciones. Marca y datos de alta (B–J) ya vienen de la maqueta; no se vuelven a pedir. Al guardar, la maqueta refleja el último evento.",
    capa: "Bitácora estado",
    mode: "append",
    ...LOOKUP_MAQUETA,
    requiredNames: [
      "placa",
      "ubicacion_actual",
      "region",
      "departamento",
      "municipio",
      "estado",
      "fecha_inicio_estado_actual",
    ],
    /** Columnas de la hoja Bitacora (placa/marca se heredan del lookup). */
    fieldNames: [
      ...PLACA,
      "marca",
      "ubicacion_actual",
      "region",
      "departamento",
      "municipio",
      "ente_receptor",
      "situacion_de_prestamo",
      "estado",
      "fecha_inicio_estado_actual",
      "fech_fin_estado_actual",
      "fecha_corte_del_reporte",
      "cantidad_de_viajes",
      "fundamento",
      "observaciones",
    ],
  },
  {
    id: "suministro",
    label: "4 · Suministro / viajes",
    description:
      "Cada suministro/viaje de la placa. No se pide marca (viene de la maqueta). Al guardar, la maqueta acumula Q–R–S (litros, personas, comunidades) sumando todos los registros de esa placa.",
    capa: "Suministro / viajes",
    mode: "append",
    ...LOOKUP_MAQUETA,
    requiredNames: [
      "placa",
      "litros_suministrados",
      "departamento",
      "municipio",
    ],
    fieldNames: [
      ...PLACA,
      "cap_gls",
      "cap_lts",
      "ente_receptor_sitio_de_suministro",
      "region",
      "departamento",
      "municipio",
      "litros_suministrados",
      "personas_beneficiadas",
      "comunidades_beneficiadas",
      "fecha_corte_del_reporte",
      "observaciones",
    ],
  },
];
