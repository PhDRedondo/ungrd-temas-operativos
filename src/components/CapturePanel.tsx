"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { CaptureFormConfig, ThemeConfig } from "@/lib/themes";
import type { RecordRow } from "@/lib/records/types";
import {
  departmentNames,
  findDepartment,
  findMunicipality,
  municipalityNames,
} from "@/lib/geo";
import { useAuth } from "@/lib/auth";
import { canWrite } from "@/lib/auth/roles";
import { groupCaptureFields, isSourceTheme } from "@/lib/analytics/decision";
import {
  feedingGuideForTheme,
  prepareTrackingRow,
} from "@/lib/uploads/capa-inference";
import {
  ALTA_CONTEXT_KEYS,
  inheritFromAlta,
  OrdenLookup,
  type OrdenLookupHit,
} from "@/components/OrdenLookup";
import { normalizeAguaCapa } from "@/themes/agua-y-saneamiento/capture-forms";
import { normalizeBmaqCapa } from "@/themes/banco-de-maquinaria/capture-forms";
import { normalizePuenteCapa } from "@/themes/puentes/capture-forms";
import {
  inheritFromInventario,
  PuenteLookup,
  PUENTE_CONTEXT_KEYS,
  type PuenteLookupHit,
} from "@/components/PuenteLookup";

type OrdenLookupByMode = "orden" | "placa" | "serial" | "convenio" | "contrato";

function resolveOrdenLookupBy(
  form: CaptureFormConfig | undefined,
  themeId: string,
): OrdenLookupByMode {
  if (form?.lookupBy) return form.lookupBy;
  if (themeId === "carrotanques") return "placa";
  return "orden";
}

function isAssetOrdenLookup(by: OrdenLookupByMode): boolean {
  return (
    by === "placa" ||
    by === "serial" ||
    by === "convenio" ||
    by === "contrato"
  );
}
import {
  ProcesoLookup,
  type ProcesoLookupHit,
} from "@/components/ProcesoLookup";
import { applyProcesoKeys } from "@/themes/puentes/process-keys";
import { PUENTES_ESTRUCTURA_ESTADO } from "@/themes/puentes/select-options";
import {
  CaptureFormStepper,
  CaptureIdentityFicha,
} from "@/components/capture-chrome";

/** Campos de identidad del alta: no se muestran de nuevo tras el lookup. */
const HIDDEN_AFTER_LOOKUP = new Set<string>([
  "orden_de_proveeduria",
  "clave_seguimiento",
  "placa",
  "nit",
  "departamento",
  "municipio",
  "objeto",
  "region",
  "provincia",
  "vigencia",
]);

/**
 * En Carrotanques el lookup oculta identidad y datos de alta (B–J) ya cargados.
 * En Banco de Maquinaria:
 *  - lookup por serial → oculta identidad del equipo
 *  - lookup por convenio → oculta el nº convenio (heredado); el serial se captura
 */
function hiddenAfterOrdenLookup(
  themeId: string,
  lookupBy?: OrdenLookupByMode,
): Set<string> {
  if (themeId === "carrotanques") {
    return new Set([
      "orden_de_proveeduria",
      "clave_seguimiento",
      "placa",
      "marca",
      "placa_ungrd",
      "clase",
      "modelo",
      "modelo_ref",
      "serial",
      "ano_compra",
      "capacidad_lt",
    ]);
  }
  if (themeId === "banco-de-maquinaria") {
    if (lookupBy === "convenio" || lookupBy === "contrato") {
      return new Set([
        "orden_de_proveeduria",
        "clave_seguimiento",
        "no_convenio",
        "objeto",
        "valor_total",
        "valor_aporte_municipio",
        "valor_aporte_gobernacion",
        "valor_aporte_ungrd",
        "responsable_juridico",
        "responsable_financiero",
        "responsable_tecnico",
        "no_cdp",
        "no_rc",
        "fecha_cdp",
        "fecha_de_rc",
      ]);
    }
    return new Set([
      "orden_de_proveeduria",
      "clave_seguimiento",
      "serial",
      "no_maquina",
      "referencia",
      "nit",
      "clasificacion",
      "empresa",
      "tipo_maquinaria",
      "valor",
      "n_motor",
      "ano_modelo",
      "placa",
      "chasis_camabaja",
      "placa_camabaja",
      "linea",
      "modelo_y_o_referencia",
      "modalidad",
      "no_orden_de_compra",
      "no_convenio",
    ]);
  }
  return HIDDEN_AFTER_LOOKUP;
}

const HIDDEN_AFTER_PUENTE_LOOKUP = new Set<string>([
  "id_puente",
  "clave_seguimiento",
  "departamento",
  "municipio",
  "region",
  "tipo",
  "configuracion",
  "ubicacion_actual",
  "contrato_convenio",
  "convenio_o_cto",
  "tipo_vinculo",
  "clave_proceso",
  "clase",
  "latitud",
  "longitud",
  "entidad_receptora",
]);

/**
 * Identidad del proceso: se fija con el lookup (o al crearlo en la capa raíz),
 * nunca con un input suelto, para que el contrato no diverja entre capas.
 */
const HIDDEN_AFTER_PROCESO_LOOKUP = new Set<string>([
  "contrato_convenio",
  "convenio_o_cto",
  "clave_proceso",
  "tipo_vinculo",
]);

/**
 * Datos del proceso que las capas hijas reciben heredados y no vuelven a pedir.
 * En la capa que origina el proceso (Estructuración) sí son capturables.
 */
const HIDDEN_IN_CHILD_LAYERS = new Set<string>(["descripcion_proceso"]);

/**
 * Llaves del proceso que las capas hijas heredan del puente y nunca capturan.
 * El contrato solo se escribe en la capa Estructuración.
 */
const PROCESO_INHERITED_KEYS = [
  "contrato_convenio",
  "convenio_o_cto",
  "clave_proceso",
  "tipo_vinculo",
] as const;

/**
 * Al modificar un proceso ya registrado, solo cambian etapa y estado.
 * El resto de datos del contrato queda fijo tras el registro inicial.
 */
const PROCESO_EDITABLE_WHEN_EXISTING = new Set<string>(["etapa", "estado"]);

function sameCapa(a: string, b: string, themeId: string) {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  if (left === right) return true;
  if (themeId === "agua-y-saneamiento") {
    const na = normalizeAguaCapa(left);
    const nb = normalizeAguaCapa(right);
    return Boolean(na && nb && na === nb);
  }
  if (themeId === "puentes") {
    const na = normalizePuenteCapa(left);
    const nb = normalizePuenteCapa(right);
    return Boolean(na && nb && na === nb);
  }
  if (themeId === "banco-de-maquinaria") {
    const na = normalizeBmaqCapa(left);
    const nb = normalizeBmaqCapa(right);
    return Boolean(na && nb && na === nb);
  }
  return left.toLowerCase() === right.toLowerCase();
}

function sameOp(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Parseo numérico tolerante (COP / miles). */
function parseMoneyInput(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;
  // Si hay coma y punto, asume formato es-CO (1.234.567,89) o US (1,234,567.89)
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0].replace(/\./g, "")}.${parts[1]}`
        : cleaned.replace(/,/g, "");
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    normalized = cleaned.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function firstMoney(
  form: Record<string, string>,
  primary: string,
  fallbacks?: string[],
): number {
  const keys = [primary, ...(fallbacks || [])];
  for (const key of keys) {
    const n = parseMoneyInput(form[key]);
    if (n !== null) return n;
  }
  return 0;
}

/** Aplica reglas `computedFields` del subformulario activo. */
function applyComputedFields(
  form: Record<string, string>,
  rules: CaptureFormConfig["computedFields"] | undefined,
): Record<string, string> {
  if (!rules || Object.keys(rules).length === 0) return form;
  const next = { ...form };
  for (const [target, rule] of Object.entries(rules)) {
    if (rule.op === "subtract") {
      const left = firstMoney(next, rule.left, rule.leftFallbacks);
      const right = firstMoney(next, rule.right, rule.rightFallbacks);
      const hasLeft =
        parseMoneyInput(next[rule.left]) !== null ||
        (rule.leftFallbacks || []).some((k) => parseMoneyInput(next[k]) !== null);
      const hasRight =
        parseMoneyInput(next[rule.right]) !== null ||
        (rule.rightFallbacks || []).some((k) => parseMoneyInput(next[k]) !== null);
      // Solo calcula si hay al menos un valor de orden o de pago
      next[target] = hasLeft || hasRight ? String(left - right) : "";
    }
  }
  return next;
}

function hitToRecordRow(hit: OrdenLookupHit): RecordRow {
  return {
    ...(hit.payload || {}),
    id: hit.id,
    orden_de_proveeduria: hit.orden_de_proveeduria,
    departamento: hit.departamento || String(hit.payload?.departamento || ""),
    municipio: hit.municipio || String(hit.payload?.municipio || ""),
    valor:
      typeof hit.valor === "number"
        ? hit.valor
        : Number(hit.valor) || Number(hit.payload?.valor) || 0,
    fecha: hit.fecha || String(hit.payload?.fecha || ""),
    estado: String(hit.payload?.estado || ""),
  };
}

function puenteHitToRecordRow(hit: PuenteLookupHit): RecordRow {
  return {
    ...(hit.payload || {}),
    id: hit.id,
    id_puente: hit.id_puente,
    clave_seguimiento: hit.id_puente,
    departamento: hit.departamento || String(hit.payload?.departamento || ""),
    municipio: hit.municipio || String(hit.payload?.municipio || ""),
    valor:
      typeof hit.valor === "number"
        ? hit.valor
        : Number(hit.valor) || Number(hit.payload?.valor) || 0,
    fecha: String(hit.payload?.fecha || ""),
    estado: String(hit.payload?.estado || hit.estado_puente || ""),
  };
}

type Props = {
  theme: ThemeConfig;
  records?: RecordRow[];
  onSaved: () => void;
  /** form = captura puntual; excel = carga de archivo (pestaña propia). */
  variant?: "form" | "excel";
};

type UploadError = {
  row: number;
  field: string;
  code: string;
  message: string;
};

type DrySummary = {
  totalRows: number;
  valid: number;
  invalid: number;
  wouldInsert: number;
  wouldUpdate: number;
  wouldSkipDuplicate: number;
  withoutTrackingKey: number;
  tip?: string;
};

function rowCapa(r: RecordRow) {
  return String(r.tipo_registro || r.capa || "").trim();
}

function rowOp(r: RecordRow) {
  return String(r.orden_de_proveeduria || r.clave_seguimiento || "").trim();
}

function rowIdPuente(r: RecordRow) {
  return String(r.id_puente || r.id || r.clave_seguimiento || "").trim();
}

function rowClaveProceso(r: RecordRow) {
  return String(r.clave_proceso || "").trim();
}

/** Fecha de evento para ordenar historial de tablas append. */
function eventDateKey(r: RecordRow) {
  const raw = String(
    r.fecha_estado ||
      r.fecha_de_pago ||
      r.fecha_inicio ||
      r.fecha_inicio_proceso ||
      r.fecha ||
      "",
  ).trim();
  if (!raw) return "9999-99-99";
  return raw.slice(0, 10);
}

function cellText(r: RecordRow, name: string) {
  const v = r[name];
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

export function CapturePanel({
  theme,
  records = [],
  onSaved,
  variant = "form",
}: Props) {
  const { role } = useAuth();
  const writable = canWrite(role || undefined);
  const captureForms = theme.captureForms || [];
  const hasCaptureForms = captureForms.length > 0;

  const mode = variant;
  const [activeFormId, setActiveFormId] = useState(captureForms[0]?.id || "");
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecordRow[]>([]);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [busy, setBusy] = useState(false);
  const [upsertMode, setUpsertMode] = useState(true);
  const [drySummary, setDrySummary] = useState<DrySummary | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedOrden, setSelectedOrden] = useState<OrdenLookupHit | null>(
    null,
  );
  const [selectedPuente, setSelectedPuente] = useState<PuenteLookupHit | null>(
    null,
  );
  const [selectedProceso, setSelectedProceso] =
    useState<ProcesoLookupHit | null>(null);
  /** Si el formulario upsert ya tiene fila para esa OP+capa, editar con PATCH+versión. */
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [loadingLayer, setLoadingLayer] = useState(false);
  /** Historial append cargado desde API (realidad DB), no solo del listado en memoria. */
  const [appendLayerRows, setAppendLayerRows] = useState<RecordRow[] | null>(
    null,
  );
  /** Versiones del registro upsert (trazabilidad). */
  const [upsertVersions, setUpsertVersions] = useState<
    {
      version: number;
      changedFields: string[];
      reason: string;
      createdAt: string;
      createdBy?: string | null;
      payload?: Record<string, unknown>;
    }[]
  >([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const feedGuide = useMemo(
    () => (isSourceTheme(theme.id) ? feedingGuideForTheme(theme.id) : null),
    [theme.id],
  );

  const activeForm = useMemo(
    () => captureForms.find((f) => f.id === activeFormId) || captureForms[0],
    [captureForms, activeFormId],
  );

  const needsOrdenLookup = Boolean(activeForm?.requiresOrdenLookup);
  const needsPuenteLookup = Boolean(activeForm?.requiresPuenteLookup);
  const needsProcesoLookup = Boolean(activeForm?.requiresProcesoLookup);
  const needsEntityLookup =
    needsOrdenLookup || needsPuenteLookup || needsProcesoLookup;
  /** La capa que origina la entidad puede crearla desde el propio lookup. */
  const lookupCanCreate = Boolean(activeForm?.lookupCanCreate);
  /** true en Inventario y Bitácora: reciben el proceso heredado, no lo crean. */
  const isChildOfProceso =
    (needsProcesoLookup || needsPuenteLookup) && !lookupCanCreate;

  /**
   * El contrato solo se escribe en Estructuración.
   * Capas hijas: siempre oculto (heredado).
   * Capa raíz: visible para crear; oculto si ya se eligió el proceso.
   */
  const isInheritedProcesoField = useCallback(
    (name: string) => {
      if (isChildOfProceso) {
        return (
          HIDDEN_AFTER_PROCESO_LOOKUP.has(name) ||
          HIDDEN_IN_CHILD_LAYERS.has(name)
        );
      }
      if (
        needsProcesoLookup &&
        selectedProceso &&
        HIDDEN_AFTER_PROCESO_LOOKUP.has(name)
      ) {
        return true;
      }
      return false;
    },
    [isChildOfProceso, needsProcesoLookup, selectedProceso],
  );
  const hasEntitySelected =
    (needsOrdenLookup && Boolean(selectedOrden)) ||
    (needsPuenteLookup && Boolean(selectedPuente)) ||
    (needsProcesoLookup && Boolean(selectedProceso));
  /**
   * En Estructuración (lookupCanCreate) los campos del Excel quedan abiertos
   * para registrar uno nuevo sin obligatoriedad de seleccionar antes.
   * El lookup sirve para filtrar/elegir uno existente y modificarlo.
   */
  const entityGateOpen = hasEntitySelected || lookupCanCreate;

  /** Proceso ya registrado: solo se editan etapa y estado. */
  const procesoSoloEtapa =
    Boolean(lookupCanCreate && editingRecordId && needsProcesoLookup);

  /** Historial de la capa append (Bitácora, Pagos, Modificaciones…), por fecha. */
  const appendHistory = useMemo(() => {
    if (!activeForm || activeForm.mode !== "append") return [];
    const capa = activeForm.capa;
    const op = selectedOrden?.orden_de_proveeduria?.trim() || "";
    const idp = selectedPuente?.id_puente?.trim() || "";
    const claveProc = selectedProceso?.clave_proceso?.trim() || "";
    if (needsOrdenLookup && !op) return [];
    if (needsPuenteLookup && !idp) return [];
    if (needsProcesoLookup && !claveProc) return [];

    const fromApi = appendLayerRows;
    const hasSelection =
      (needsOrdenLookup && selectedOrden) ||
      (needsPuenteLookup && selectedPuente) ||
      (needsProcesoLookup && selectedProceso);

    const source =
      fromApi !== null && hasSelection
        ? fromApi
        : records.filter((r) => {
            if (!sameCapa(rowCapa(r), capa, theme.id)) return false;
            if (op && !sameOp(rowOp(r), op)) return false;
            if (idp && rowIdPuente(r).toLowerCase() !== idp.toLowerCase()) {
              return false;
            }
            if (
              claveProc &&
              rowClaveProceso(r).toLowerCase() !== claveProc.toLowerCase()
            ) {
              return false;
            }
            return true;
          });

    return source
      .slice()
      .sort((a, b) => {
        const da = eventDateKey(a);
        const db = eventDateKey(b);
        if (da !== db) return da.localeCompare(db);
        return String(a.id).localeCompare(String(b.id));
      });
  }, [
    activeForm,
    records,
    selectedOrden,
    selectedPuente,
    selectedProceso,
    needsOrdenLookup,
    needsPuenteLookup,
    needsProcesoLookup,
    appendLayerRows,
    theme.id,
  ]);

  /** Puentes del inventario ya vinculados al contrato seleccionado (Base General). */
  const puentesVinculados = useMemo(() => {
    if (!activeForm || !needsProcesoLookup || lookupCanCreate) return [];
    if (activeForm.mode !== "upsert" && activeForm.mode !== "create-once") {
      return [];
    }
    if (!selectedProceso || !appendLayerRows) return [];
    return appendLayerRows.slice().sort((a, b) => {
      const ia = rowIdPuente(a);
      const ib = rowIdPuente(b);
      const na = Number(ia);
      const nb = Number(ib);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return ia.localeCompare(ib, "es");
    });
  }, [
    activeForm,
    needsProcesoLookup,
    lookupCanCreate,
    selectedProceso,
    appendLayerRows,
  ]);

  const inventarioEditando = Boolean(
    activeForm?.id === "inventario" && editingRecordId,
  );

  const historyColumns = useMemo(() => {
    if (!activeForm) return [] as string[];
    return activeForm.fieldNames.filter((n) => {
      if (n === "tipo_registro" || n === "capa" || n === "clave_seguimiento") {
        return false;
      }
      if (
        needsOrdenLookup &&
        hiddenAfterOrdenLookup(theme.id, resolveOrdenLookupBy(activeForm, theme.id)).has(n) &&
        n !== "orden_de_proveeduria"
      ) {
        return false;
      }
      if (
        needsPuenteLookup &&
        HIDDEN_AFTER_PUENTE_LOOKUP.has(n) &&
        n !== "id_puente"
      ) {
        return false;
      }
      if (isInheritedProcesoField(n) && n !== "contrato_convenio") {
        return false;
      }
      return true;
    });
  }, [
    activeForm,
    needsOrdenLookup,
    needsPuenteLookup,
    isInheritedProcesoField,
  ]);

  useEffect(() => {
    setSelectedOrden(null);
    setSelectedPuente(null);
    setSelectedProceso(null);
    setEditingRecordId(null);
    setAppendLayerRows(null);
    setUpsertVersions([]);
    setExpandedVersion(null);
    const formCfg =
      captureForms.find((f) => f.id === activeFormId) || captureForms[0];
    if (hasCaptureForms && formCfg) {
      setForm({
        tipo_registro: formCfg.capa,
        capa: formCfg.capa,
      });
    } else {
      setForm({});
    }
    // Solo al cambiar de pestaña de formulario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFormId]);

  async function loadUpsertVersions(recordId: string) {
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/themes/${theme.id}/records/${recordId}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.versions)) {
        setUpsertVersions(data.versions);
      } else {
        setUpsertVersions([]);
      }
    } catch {
      setUpsertVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }

  useEffect(() => {
    if (!editingRecordId || activeForm?.mode !== "upsert") {
      setUpsertVersions([]);
      return;
    }
    void loadUpsertVersions(editingRecordId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecordId, activeForm?.mode, theme.id]);

  const department = form.departamento || "";
  const deptCanonical = findDepartment(department)?.name || "";
  const municipalities = useMemo(
    () => municipalityNames(department),
    [department],
  );
  const departmentOptions = useMemo(() => departmentNames(), []);

  const fieldSections = useMemo(() => {
    if (hasCaptureForms && activeForm) {
      const names = activeForm.fieldNames.filter((n) => {
        if (n === "tipo_registro" || n === "capa") return false;
        if (needsOrdenLookup && hiddenAfterOrdenLookup(theme.id, resolveOrdenLookupBy(activeForm, theme.id)).has(n))
          return false;
        if (needsPuenteLookup && HIDDEN_AFTER_PUENTE_LOOKUP.has(n)) return false;
        if (isInheritedProcesoField(n)) return false;
        return true;
      });
      return [
        {
          id: activeForm.id,
          title: activeForm.label,
          names,
        },
      ];
    }
    if (!isSourceTheme(theme.id)) {
      return [
        {
          id: "todos",
          title: "Datos del registro",
          names: theme.fields.map((f) => f.name),
        },
      ];
    }
    return groupCaptureFields(theme.fields);
  }, [
    theme,
    hasCaptureForms,
    activeForm,
    needsOrdenLookup,
    needsPuenteLookup,
    isInheritedProcesoField,
  ]);

  async function selectOrden(hit: OrdenLookupHit) {
    if (!activeForm) return;
    const lookupBy = resolveOrdenLookupBy(activeForm, theme.id);
    const byPlaca = isAssetOrdenLookup(lookupBy);
    const inherited = inheritFromAlta(hit, activeForm.fieldNames, {
      byPlaca: lookupBy === "placa",
      lookupBy,
    });
    const deptName =
      findDepartment(String(inherited.departamento || hit.departamento || ""))?.name ||
      String(inherited.departamento || hit.departamento || "");
    const muniName =
      findMunicipality(deptName, String(inherited.municipio || hit.municipio || ""))?.name ||
      String(inherited.municipio || hit.municipio || "");
    setSelectedOrden(hit);
    // Si el lookup es la misma capa (p. ej. categorías sobre maqueta), el hit ya es el registro.
    if (
      activeForm.mode === "upsert" &&
      activeForm.lookupCapa &&
      activeForm.lookupCapa === activeForm.capa &&
      hit.id
    ) {
      setEditingRecordId(hit.id);
    } else {
      setEditingRecordId(null);
    }
    setAppendLayerRows(null);
    setError(null);
    setMessage(null);

    const baseForm: Record<string, string> = {
      ...inherited,
      departamento: deptName,
      municipio: muniName,
      tipo_registro: activeForm.capa,
      capa: activeForm.capa,
    };

    // Siempre traer del payload de maqueta los campos del formulario (datos reales).
    if (byPlaca && hit.payload) {
      const payload = hit.payload as Record<string, unknown>;
      for (const name of activeForm.fieldNames) {
        if (name === "tipo_registro" || name === "capa") continue;
        const v = payload[name];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          baseForm[name] = String(v);
        }
      }
      if (!baseForm.placa) {
        const placa = String(payload.placa || hit.orden_de_proveeduria || "").trim();
        if (placa) baseForm.placa = placa;
      }
      // Marca se guarda en bitácora/suministro sin mostrarla; capacidad litros desde maqueta.
      if (payload.marca != null && String(payload.marca).trim()) {
        baseForm.marca = String(payload.marca);
      }
      if (
        !baseForm.cap_lts &&
        payload.capacidad_lt != null &&
        String(payload.capacidad_lt).trim() !== ""
      ) {
        baseForm.cap_lts = String(payload.capacidad_lt);
      }
    }

    // Precargar campos mutables desde el hit (misma capa) antes del refetch.
    if (
      activeForm.mode === "upsert" &&
      activeForm.lookupCapa === activeForm.capa &&
      hit.payload
    ) {
      const payload = hit.payload as Record<string, unknown>;
      for (const name of activeForm.fieldNames) {
        if (name === "tipo_registro" || name === "capa") continue;
        if (
          !byPlaca &&
          hiddenAfterOrdenLookup(theme.id, resolveOrdenLookupBy(activeForm, theme.id)).has(name) &&
          name !== "orden_de_proveeduria"
        ) {
          continue;
        }
        const v = payload[name];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          baseForm[name] = String(v);
        }
      }
      if (byPlaca && activeForm.patchFieldNames?.length) {
        setMessage(
          "Registro seleccionado. Actualice categorías o clasificación y guarde.",
        );
      }
    }

    // Upsert: cargar datos de la capa; si no hay fila, tomar campos desde el Alta.
    if (activeForm.mode === "upsert") {
      setLoadingLayer(true);
      try {
        const layerRes = await fetch(
          `/api/themes/${theme.id}/orders?op=${encodeURIComponent(hit.orden_de_proveeduria)}&capa=${encodeURIComponent(activeForm.capa)}`,
        );
        const layerData = await layerRes.json();
        let source: OrdenLookupHit | null =
          layerRes.ok && layerData.found && layerData.orders?.[0]
            ? (layerData.orders[0] as OrdenLookupHit)
            : null;
        let fromExistingLayer = Boolean(source);

        if (source) {
          setEditingRecordId(source.id);
        } else if (!(activeForm.lookupCapa === activeForm.capa && hit.id)) {
          // Datos de líder/control suelen venir en la Maqueta/Alta
          const altaRes = await fetch(
            `/api/themes/${theme.id}/orders?op=${encodeURIComponent(hit.orden_de_proveeduria)}&capa=${encodeURIComponent(activeForm.lookupCapa || "Alta / orden")}`,
          );
          const altaData = await altaRes.json();
          if (altaRes.ok && altaData.found && altaData.orders?.[0]) {
            source = altaData.orders[0] as OrdenLookupHit;
          }
          setEditingRecordId(null);
        }

        if (source) {
          const payload = source.payload || {};
          for (const name of activeForm.fieldNames) {
            if (name === "tipo_registro" || name === "capa") continue;
            if (
              hiddenAfterOrdenLookup(theme.id, resolveOrdenLookupBy(activeForm, theme.id)).has(name) &&
              name !== "orden_de_proveeduria"
            ) {
              continue;
            }
            const v = payload[name];
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              baseForm[name] = String(v);
            }
          }
          if (
            activeForm.fieldNames.includes("valor") &&
            source.valor !== undefined &&
            source.valor !== null &&
            String(source.valor) !== "" &&
            Number(source.valor) !== 0
          ) {
            baseForm.valor = String(source.valor);
          }
          setMessage(
            fromExistingLayer
              ? `Datos cargados de «${activeForm.label.replace(/^\d+\s*·\s*/, "")}». Edite y guarde.`
              : `Datos cargados del registro inicial. Complete y guarde.`,
          );
        } else {
          setMessage(
            byPlaca
              ? `Placa seleccionada. Complete los campos y guarde.`
              : `Orden seleccionada. Complete los campos y guarde.`,
          );
        }
      } catch {
        /* si falla la precarga, al menos deja el alta */
      } finally {
        setLoadingLayer(false);
      }
    }

    // Append: precarga contexto del alta + historial real de esa OP+capa desde DB.
    if (activeForm.mode === "append") {
      setLoadingLayer(true);
      try {
        // Refrescar alta por si el hit del autocomplete viene incompleto
        const altaRes = await fetch(
          `/api/themes/${theme.id}/orders?op=${encodeURIComponent(hit.orden_de_proveeduria)}&capa=${encodeURIComponent(activeForm.lookupCapa || "Alta / orden")}`,
        );
        const altaData = await altaRes.json();
        const refreshed =
          altaRes.ok && altaData.found && altaData.orders?.[0]
            ? (altaData.orders[0] as OrdenLookupHit)
            : null;
        // Conservar variante elegida (OP única vs OP x pago) del autocomplete.
        const altaHit: OrdenLookupHit = refreshed
          ? {
              ...refreshed,
              match_kind: hit.match_kind || refreshed.match_kind || "unica",
              display_op:
                hit.match_kind === "x_pago"
                  ? hit.display_op ||
                    hit.orden_de_proveeduria_x_pago ||
                    refreshed.orden_de_proveeduria_x_pago
                  : refreshed.display_op || refreshed.orden_de_proveeduria,
              orden_de_proveeduria_x_pago:
                hit.orden_de_proveeduria_x_pago ||
                refreshed.orden_de_proveeduria_x_pago ||
                (typeof refreshed.payload?.orden_de_proveeduria_x_pago ===
                "string"
                  ? refreshed.payload.orden_de_proveeduria_x_pago
                  : undefined),
            }
          : hit;
        if (altaHit.id !== hit.id || altaHit.payload || hit.match_kind) {
          setSelectedOrden(altaHit);
          const again = inheritFromAlta(altaHit, activeForm.fieldNames, {
            byPlaca,
          });
          for (const [k, v] of Object.entries(again)) {
            if (v !== undefined && String(v).trim() !== "") {
              baseForm[k] = String(v);
            }
          }
          if (byPlaca && altaHit.payload) {
            const payload = altaHit.payload as Record<string, unknown>;
            for (const name of activeForm.fieldNames) {
              if (name === "tipo_registro" || name === "capa") continue;
              const v = payload[name];
              if (v !== undefined && v !== null && String(v).trim() !== "") {
                baseForm[name] = String(v);
              }
            }
          }
          if (!byPlaca && altaHit.proveedor) baseForm.proveedor = altaHit.proveedor;
          if (
            activeForm.fieldNames.includes("valor") &&
            altaHit.valor !== undefined &&
            altaHit.valor !== null &&
            String(altaHit.valor).trim() !== "" &&
            Number(altaHit.valor) !== 0
          ) {
            baseForm.valor = String(altaHit.valor);
          }
        }

        const histRes = await fetch(
          `/api/themes/${theme.id}/orders?op=${encodeURIComponent(hit.orden_de_proveeduria)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
        );
        const histData = await histRes.json();
        const events: OrdenLookupHit[] =
          histRes.ok && Array.isArray(histData.orders)
            ? (histData.orders as OrdenLookupHit[])
            : [];
        setAppendLayerRows(events.map(hitToRecordRow));
        const n = events.length;
        setMessage(
          byPlaca
            ? n > 0
              ? `Placa seleccionada. Hay ${n} evento${n === 1 ? "" : "s"} en este formulario. El nuevo guardado agrega otra fila.`
              : `Placa seleccionada. Aún no hay eventos aquí: complete y guarde el primero.`
            : n > 0
              ? `Orden seleccionada. Hay ${n} evento${n === 1 ? "" : "s"} en este formulario. El nuevo guardado agrega otra fila.`
              : `Orden seleccionada. Aún no hay eventos aquí: complete y guarde el primero.`,
        );
      } catch {
        setAppendLayerRows([]);
        setMessage(
          `Orden seleccionada. Complete los datos; el historial aparecerá debajo.`,
        );
      } finally {
        setLoadingLayer(false);
      }
    }

    setForm(applyComputedFields(baseForm, activeForm.computedFields));
  }

  function clearOrden() {
    setEditingRecordId(null);
    setAppendLayerRows(null);
    setMessage(null);
    if (!activeForm) {
      setSelectedOrden(null);
      setForm({});
      return;
    }
    setSelectedOrden(null);
    setForm({
      tipo_registro: activeForm.capa,
      capa: activeForm.capa,
    });
  }

  async function selectPuente(hit: PuenteLookupHit) {
    if (!activeForm) return;
    const inherited = inheritFromInventario(hit, activeForm.fieldNames);
    const deptName =
      findDepartment(String(inherited.departamento || ""))?.name ||
      String(inherited.departamento || "");
    const muniName =
      findMunicipality(deptName, String(inherited.municipio || ""))?.name ||
      String(inherited.municipio || "");
    setSelectedPuente(hit);
    setEditingRecordId(null);
    setAppendLayerRows(null);
    setError(null);
    setMessage(null);

    const baseForm: Record<string, string> = {
      ...inherited,
      departamento: deptName,
      municipio: muniName,
      tipo_registro: activeForm.capa,
      capa: activeForm.capa,
    };

    if (activeForm.mode === "append") {
      setLoadingLayer(true);
      try {
        const histRes = await fetch(
          `/api/themes/${theme.id}/puentes?id=${encodeURIComponent(hit.id_puente)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
        );
        const histData = await histRes.json();
        const events: PuenteLookupHit[] =
          histRes.ok && Array.isArray(histData.puentes)
            ? (histData.puentes as PuenteLookupHit[])
            : [];
        setAppendLayerRows(events.map(puenteHitToRecordRow));
        const n = events.length;
        setMessage(
          n > 0
            ? `Puente ${hit.id_puente} cargado. Hay ${n} evento${n === 1 ? "" : "s"} en esta tabla (abajo).`
            : `Puente ${hit.id_puente} cargado. Complete el primer evento.`,
        );
      } catch {
        setAppendLayerRows([]);
        setMessage(`Puente ${hit.id_puente} seleccionado.`);
      } finally {
        setLoadingLayer(false);
      }
    } else {
      setMessage(`Puente ${hit.id_puente} seleccionado.`);
    }

    setForm(applyComputedFields(baseForm, activeForm.computedFields));
  }

  function clearPuente() {
    setEditingRecordId(null);
    setAppendLayerRows(null);
    setMessage(null);
    if (!activeForm) {
      setSelectedPuente(null);
      setForm({});
      return;
    }
    setSelectedPuente(null);
    setForm({
      tipo_registro: activeForm.capa,
      capa: activeForm.capa,
    });
  }

  async function selectProceso(hit: ProcesoLookupHit) {
    if (!activeForm) return;
    setSelectedProceso(hit);
    setEditingRecordId(null);
    setAppendLayerRows(null);
    setUpsertVersions([]);
    setError(null);
    setMessage(null);

    const baseForm: Record<string, string> = {
      tipo_registro: activeForm.capa,
      capa: activeForm.capa,
      contrato_convenio: hit.contrato_convenio,
      clave_proceso: hit.clave_proceso,
      tipo_vinculo: hit.tipo_vinculo,
      convenio_o_cto: hit.contrato_convenio,
    };
    if (
      hit.descripcion_proceso &&
      activeForm.fieldNames.includes("descripcion_proceso")
    ) {
      baseForm.descripcion_proceso = hit.descripcion_proceso;
    }

    // Inventario: el payload del hit es un puente representativo — NO volcar
    // sus campos (evita ID 17 por defecto). Solo llaves de proceso.
    const esInventarioContrato =
      needsProcesoLookup &&
      !lookupCanCreate &&
      (activeForm.mode === "upsert" || activeForm.mode === "create-once");

    if (!esInventarioContrato) {
      for (const name of activeForm.fieldNames) {
        if (name === "tipo_registro" || name === "capa") continue;
        if (
          HIDDEN_AFTER_PROCESO_LOOKUP.has(name) &&
          name !== "contrato_convenio"
        ) {
          continue;
        }
        const v = hit.payload?.[name];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          baseForm[name] = String(v);
        }
      }
      if (hit.vigencia && activeForm.fieldNames.includes("vigencia")) {
        baseForm.vigencia = hit.vigencia;
      }
      if (
        hit.valor !== undefined &&
        hit.valor !== null &&
        activeForm.fieldNames.includes("valor")
      ) {
        baseForm.valor = String(hit.valor);
      }
    }

    // Estructuración (upsert + crear): nace → registrar; ya existe → modificar.
    if (activeForm.mode === "upsert" && needsProcesoLookup && lookupCanCreate) {
      const esNuevo = !hit.estructurado || !hit.id;
      if (esNuevo) {
        setEditingRecordId(null);
        setMessage(
          `Proceso nuevo «${hit.contrato_convenio}». Complete los datos y regístrelo.`,
        );
        setForm(applyComputedFields(baseForm, activeForm.computedFields));
        return;
      }

      setLoadingLayer(true);
      try {
        const histRes = await fetch(
          `/api/themes/${theme.id}/procesos?clave=${encodeURIComponent(hit.clave_proceso)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
        );
        const histData = await histRes.json();
        const events: RecordRow[] =
          histRes.ok && Array.isArray(histData.procesos)
            ? (histData.procesos as RecordRow[])
            : [];
        const latest = events.length ? events[events.length - 1]! : null;
        if (latest) {
          setEditingRecordId(String(latest.id));
          for (const name of activeForm.fieldNames) {
            if (name === "tipo_registro" || name === "capa") continue;
            const v = latest[name];
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              baseForm[name] = String(v);
            }
          }
          baseForm.contrato_convenio = hit.contrato_convenio;
          baseForm.clave_proceso = hit.clave_proceso;
          baseForm.tipo_vinculo = hit.tipo_vinculo;
          setMessage(
            `Proceso existente cargado. Modifique y guarde: queda versionado.`,
          );
        } else if (hit.id) {
          setEditingRecordId(String(hit.id));
          setMessage(
            `Proceso existente. Modifique y guarde: queda versionado.`,
          );
        } else {
          setEditingRecordId(null);
          setMessage(
            `Proceso «${hit.contrato_convenio}». Complete y regístrelo.`,
          );
        }
      } catch {
        setEditingRecordId(hit.id ? String(hit.id) : null);
        setMessage(
          hit.id
            ? `Proceso existente. Modifique y guarde.`
            : `Proceso nuevo. Complete y regístrelo.`,
        );
      } finally {
        setLoadingLayer(false);
      }
      setForm(applyComputedFields(baseForm, activeForm.computedFields));
      return;
    }

    if (activeForm.mode === "append") {
      setLoadingLayer(true);
      try {
        const histRes = await fetch(
          `/api/themes/${theme.id}/procesos?clave=${encodeURIComponent(hit.clave_proceso)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
        );
        const histData = await histRes.json();
        const events: RecordRow[] =
          histRes.ok && Array.isArray(histData.procesos)
            ? (histData.procesos as RecordRow[])
            : [];
        setAppendLayerRows(events);
        const n = events.length;
        setMessage(
          n > 0
            ? `Proceso cargado. Hay ${n} etapa${n === 1 ? "" : "s"} registradas (abajo).`
            : `Proceso seleccionado. Registre la primera etapa.`,
        );
      } catch {
        setAppendLayerRows([]);
        setMessage("Proceso seleccionado.");
      } finally {
        setLoadingLayer(false);
      }
    } else if (esInventarioContrato) {
      // Inventario: listar todos; formulario vacío hasta elegir uno o alta nueva.
      setLoadingLayer(true);
      try {
        const listRes = await fetch(
          `/api/themes/${theme.id}/puentes?proceso=${encodeURIComponent(hit.clave_proceso)}&contrato=${encodeURIComponent(hit.contrato_convenio)}&capa=${encodeURIComponent(activeForm.capa || "Inventario puente")}&all=1`,
        );
        const listData = await listRes.json();
        const puentes: PuenteLookupHit[] =
          listRes.ok && Array.isArray(listData.puentes)
            ? (listData.puentes as PuenteLookupHit[])
            : [];
        setAppendLayerRows(puentes.map(puenteHitToRecordRow));
        const n = puentes.length;
        setMessage(
          n > 0
            ? `Contrato ${hit.contrato_convenio}: ${n} puente${n === 1 ? "" : "s"}. Elija uno en la lista para modificarlo, o pulse «Nuevo puente» para agregar otro.`
            : `Contrato ${hit.contrato_convenio} sin puentes aún. Complete el registro del primero.`,
        );
      } catch {
        setAppendLayerRows([]);
        setMessage(
          `Proceso ${hit.contrato_convenio} seleccionado. Registre el puente.`,
        );
      } finally {
        setLoadingLayer(false);
      }
    } else {
      setMessage(
        `Proceso ${hit.contrato_convenio} vinculado. Registre el puente que nace de él.`,
      );
    }

    setForm(applyComputedFields(baseForm, activeForm.computedFields));
  }

  function selectInventarioPuente(row: RecordRow) {
    if (!activeForm || !selectedProceso) return;
    const recordId = String(row.id || "").trim();
    if (!recordId) return;
    setError(null);
    setEditingRecordId(recordId);
    const baseForm: Record<string, string> = {
      tipo_registro: activeForm.capa,
      capa: activeForm.capa,
      contrato_convenio: selectedProceso.contrato_convenio,
      clave_proceso: selectedProceso.clave_proceso,
      tipo_vinculo: selectedProceso.tipo_vinculo,
      convenio_o_cto: selectedProceso.contrato_convenio,
    };
    for (const name of activeForm.fieldNames) {
      if (name === "tipo_registro" || name === "capa") continue;
      const v = row[name];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        baseForm[name] = String(v);
      }
    }
    const idp = rowIdPuente(row);
    if (idp) baseForm.id_puente = idp;
    if (String(row.convenio_o_cto || "").trim()) {
      baseForm.convenio_o_cto = String(row.convenio_o_cto);
    }
    setForm(applyComputedFields(baseForm, activeForm.computedFields));
    setMessage(
      `Puente ${idp || recordId} cargado. Modifique los campos y guarde: cada cambio queda versionado.`,
    );
    void loadUpsertVersions(recordId);
  }

  function startNuevoInventarioPuente() {
    if (!activeForm || !selectedProceso) return;
    setEditingRecordId(null);
    setUpsertVersions([]);
    setError(null);
    setForm(
      applyComputedFields(
        {
          tipo_registro: activeForm.capa,
          capa: activeForm.capa,
          contrato_convenio: selectedProceso.contrato_convenio,
          clave_proceso: selectedProceso.clave_proceso,
          tipo_vinculo: selectedProceso.tipo_vinculo,
          convenio_o_cto: selectedProceso.contrato_convenio,
        },
        activeForm.computedFields,
      ),
    );
    setMessage(
      "Nuevo puente. Complete el ID y los datos; el contrato ya está vinculado.",
    );
  }

  function clearProceso() {
    setEditingRecordId(null);
    setAppendLayerRows(null);
    setUpsertVersions([]);
    setMessage(null);
    if (!activeForm) {
      setSelectedProceso(null);
      setForm({});
      return;
    }
    setSelectedProceso(null);
    setForm({
      tipo_registro: activeForm.capa,
      capa: activeForm.capa,
    });
  }

  const fieldsByName = useMemo(() => {
    return new Map(theme.fields.map((f) => [f.name, f]));
  }, [theme.fields]);

  const computedFieldNames = useMemo(() => {
    return new Set(Object.keys(activeForm?.computedFields || {}));
  }, [activeForm]);

  function updateField(name: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Cascada DIVIPOLA: al cambiar departamento, limpia municipio si no pertenece.
      if (name === "departamento") {
        const munis = municipalityNames(value);
        const current = String(prev.municipio || "").trim();
        if (!current) {
          next.municipio = "";
        } else {
          const match = munis.find(
            (m) => m.toLowerCase() === current.toLowerCase(),
          );
          next.municipio = match || "";
        }
      }
      if (name === "municipio" && value) {
        const m = findMunicipality(prev.departamento || "", value);
        if (m) next.municipio = m.name;
      }
      return applyComputedFields(next, activeForm?.computedFields);
    });
  }

  function isRequired(fieldName: string, fieldRequired?: boolean) {
    if (activeForm?.requiredNames?.includes(fieldName)) return true;
    return Boolean(fieldRequired);
  }

  function renderField(fieldName: string) {
    const field = fieldsByName.get(fieldName);
    if (!field) return null;
    const required = isRequired(field.name, field.required);
    const isComputed = computedFieldNames.has(field.name);
    const lockedByProceso =
      procesoSoloEtapa && !PROCESO_EDITABLE_WHEN_EXISTING.has(field.name);
    const lockedByIdPuente =
      inventarioEditando && field.name === "id_puente";
    const lockedByReadonlyEditing =
      Boolean(activeForm?.readonlyWhenEditing?.includes(field.name)) &&
      (Boolean(editingRecordId) || Boolean(selectedOrden));
    const fieldLocked =
      isComputed ||
      lockedByProceso ||
      lockedByIdPuente ||
      lockedByReadonlyEditing;
    const common =
      "theme-input";
    const computedClass = common;

    // Estado del proceso: select solo en Estructuración (no valida inventario).
    if (field.name === "estado" && lookupCanCreate) {
      const options: string[] = [...PUENTES_ESTRUCTURA_ESTADO];
      const value = form[field.name] || "";
      if (value && !options.includes(value)) {
        options.unshift(value);
      }
      return (
        <label
          key={field.name}
          className="theme-field"
        >
          {field.label}
          {required ? (
            <span className="ml-1 text-ungrd-danger" aria-hidden>
              *
            </span>
          ) : null}
          <select
            value={value}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={computedClass}
            required={required && !fieldLocked}
            disabled={!writable || busy || fieldLocked}
          >
            <option value="">Seleccione…</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }

    // Departamento / municipio: siempre listas DIVIPOLA (no texto libre).
    if (field.name === "departamento") {
      const value = deptCanonical || form.departamento || "";
      return (
        <label
          key={field.name}
          className="theme-field"
        >
          {field.label}
          {required ? (
            <span className="ml-1 text-ungrd-danger" aria-hidden>
              *
            </span>
          ) : null}
          <select
            value={value}
            onChange={(e) => updateField("departamento", e.target.value)}
            className={common}
            required={required}
            disabled={!writable || busy || lockedByProceso}
          >
            <option value="">Seleccione departamento…</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.name === "municipio") {
      const hasDept = Boolean(deptCanonical || department);
      const muniCanonical =
        findMunicipality(department, form.municipio || "")?.name || "";
      const value = muniCanonical || form.municipio || "";
      return (
        <label
          key={field.name}
          className="theme-field"
        >
          {field.label}
          {required ? (
            <span className="ml-1 text-ungrd-danger" aria-hidden>
              *
            </span>
          ) : null}
          <select
            value={hasDept ? value : ""}
            onChange={(e) => updateField("municipio", e.target.value)}
            className={common}
            required={required}
            disabled={!writable || busy || !hasDept}
          >
            <option value="">
              {hasDept
                ? "Seleccione municipio…"
                : "Seleccione departamento primero"}
            </option>
            {municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <label
        key={field.name}
        className={`theme-field ${
          field.type === "textarea" ? "md:col-span-2" : ""
        }`}
      >
        {field.label}
        {required ? (
          <span className="ml-1 text-ungrd-danger" aria-hidden>
            *
          </span>
        ) : null}
        {isComputed ? (
          <span className="ml-2 text-xs font-normal text-ungrd-muted">
            (calculado)
          </span>
        ) : lockedByProceso ? (
          <span className="ml-2 text-xs font-normal text-ungrd-muted">
            (fijo · solo cambian etapa y estado)
          </span>
        ) : null}
        {field.type === "select" ? (
          <select
            value={form[field.name] || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={computedClass}
            required={required && !lockedByProceso}
            disabled={!writable || busy || fieldLocked}
          >
            <option value="">Seleccione…</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            value={form[field.name] || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={`${computedClass} min-h-24`}
            placeholder={field.placeholder}
            required={required && !lockedByProceso}
            disabled={!writable || busy || fieldLocked}
            readOnly={fieldLocked}
          />
        ) : (
          <input
            type={field.type}
            value={form[field.name] || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={computedClass}
            required={required && !lockedByProceso}
            placeholder={
              isComputed
                ? "Se calcula automáticamente"
                : lockedByProceso
                  ? "No se modifica"
                  : field.placeholder
            }
            min={field.min}
            max={field.max}
            disabled={!writable || busy || fieldLocked}
            readOnly={fieldLocked}
          />
        )}
      </label>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!writable) {
      setError("Su rol no permite captura (requiere operativo, coordinador, subdirector o admin).");
      return;
    }
    if (needsOrdenLookup && !selectedOrden) {
      setError(
        activeForm?.lookupBy === "placa" || theme.id === "carrotanques"
          ? "Busque y seleccione la placa del vehículo antes de guardar."
          : "Busque y seleccione la orden de proveeduría antes de guardar.",
      );
      return;
    }
    if (needsPuenteLookup && !selectedPuente) {
      setError(
        "Busque y seleccione el puente del inventario antes de guardar.",
      );
      return;
    }
    if (needsProcesoLookup && !selectedProceso) {
      if (!lookupCanCreate) {
        setError(
          "Seleccione el contrato o convenio ya estructurado. El proceso nace en «1 · Estructuración».",
        );
        return;
      }
      if (!String(form.contrato_convenio || "").trim()) {
        setError(
          "Indique el contrato o la donación en el formulario (o selecciónelo de la lista) para registrarlo.",
        );
        return;
      }
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const names =
        hasCaptureForms && activeForm
          ? activeForm.fieldNames
          : theme.fields.map((f) => f.name);

      // Recalcular derivados justo antes de persistir
      const formForSave = applyComputedFields(form, activeForm?.computedFields);

      const rawValues: Record<string, unknown> = {};
      for (const name of names) {
        const field = fieldsByName.get(name);
        const raw = formForSave[name] || "";
        rawValues[name] = field?.type === "number" ? Number(raw || 0) : raw;
      }
      // Asegurar OP + identidad heredada aunque estén ocultos en UI
      if (selectedOrden) {
        rawValues.orden_de_proveeduria = selectedOrden.orden_de_proveeduria;
        rawValues.clave_seguimiento = selectedOrden.orden_de_proveeduria;
        {
          const lookupBy = resolveOrdenLookupBy(activeForm, theme.id);
          const payload = selectedOrden.payload as Record<string, unknown>;
          if (lookupBy === "placa" || theme.id === "carrotanques") {
            const placa =
              String(payload?.placa || "").trim() ||
              selectedOrden.orden_de_proveeduria;
            rawValues.placa = placa;
            rawValues.clave_seguimiento = placa;
            if (!String(rawValues.marca || "").trim() && payload?.marca) {
              rawValues.marca = payload.marca;
            }
          } else if (lookupBy === "serial") {
            const serial =
              String(payload?.serial || "").trim() ||
              selectedOrden.orden_de_proveeduria;
            rawValues.serial = serial;
            rawValues.clave_seguimiento = serial;
          } else if (lookupBy === "convenio" || lookupBy === "contrato") {
            const convenio =
              String(payload?.no_convenio || "").trim() ||
              selectedOrden.orden_de_proveeduria;
            rawValues.no_convenio = convenio;
            const oc = String(
              payload?.no_orden_de_compra ||
                formForSave.no_orden_de_compra ||
                "",
            ).trim();
            if (oc && !String(rawValues.no_orden_de_compra || "").trim()) {
              rawValues.no_orden_de_compra = oc;
            }
            // Detalle / entrega: la llave del activo es el serial, no el convenio.
            const serial = String(
              rawValues.serial || formForSave.serial || "",
            ).trim();
            const capa = String(activeForm?.capa || "").trim();
            if (
              serial &&
              (capa === "Maqueta / inventario" ||
                capa === "Entrega a beneficiario")
            ) {
              rawValues.clave_seguimiento = serial;
            } else {
              rawValues.clave_seguimiento = convenio;
            }
          }
        }
        // Banco de Maquinaria: forzar clave según capa aunque no haya lookup.
        if (theme.id === "banco-de-maquinaria") {
          const capa = String(activeForm?.capa || rawValues.capa || "").trim();
          const serial = String(rawValues.serial || "").trim();
          const convenio = String(rawValues.no_convenio || "").trim();
          if (
            serial &&
            (capa === "Maqueta / inventario" ||
              capa === "Entrega a beneficiario")
          ) {
            rawValues.clave_seguimiento = serial;
          } else if (
            convenio &&
            (capa === "Convenio o proceso" || capa === "Bitácora convenio")
          ) {
            rawValues.clave_seguimiento = convenio;
          }
        }
        for (const key of ALTA_CONTEXT_KEYS) {
          if (names.includes(key) && formForSave[key]) {
            rawValues[key] = formForSave[key];
          }
        }
      }
      if (selectedPuente) {
        rawValues.id_puente = selectedPuente.id_puente;
        rawValues.clave_seguimiento = selectedPuente.id_puente;
        for (const key of PUENTE_CONTEXT_KEYS) {
          if (names.includes(key) && formForSave[key]) {
            rawValues[key] = formForSave[key];
          }
        }
        // El evento hereda el proceso del puente: la bitácora sigue al activo,
        // y el activo pertenece a un contrato que solo nace en Estructuración.
        for (const key of PROCESO_INHERITED_KEYS) {
          const value = String(selectedPuente[key] || "").trim();
          if (value) rawValues[key] = value;
        }
      }
      if (selectedProceso) {
        rawValues.contrato_convenio = selectedProceso.contrato_convenio;
        rawValues.clave_proceso = selectedProceso.clave_proceso;
        rawValues.tipo_vinculo = selectedProceso.tipo_vinculo;
        rawValues.convenio_o_cto =
          String(formForSave.convenio_o_cto || "").trim() ||
          selectedProceso.contrato_convenio;
        if (names.includes("vigencia") && selectedProceso.vigencia) {
          rawValues.vigencia = selectedProceso.vigencia;
        }
        if (
          !String(formForSave.descripcion_proceso || "").trim() &&
          selectedProceso.descripcion_proceso
        ) {
          rawValues.descripcion_proceso = selectedProceso.descripcion_proceso;
        }
      }
      if (theme.id === "puentes") {
        Object.assign(rawValues, applyProcesoKeys(rawValues));
      }
      if (activeForm) {
        rawValues.tipo_registro = activeForm.capa;
        rawValues.capa = activeForm.capa;
      }

      const prepared = prepareTrackingRow(theme, rawValues);
      const values: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(prepared)) {
        const field = fieldsByName.get(k);
        values[k] = field?.type === "number" ? Number(v || 0) : String(v ?? "");
      }

      const persistMode = activeForm?.mode || "append";

      // Upsert con fila existente → PATCH versionado (trazabilidad)
      if (persistMode === "upsert" && editingRecordId) {
        // Proceso ya registrado: solo viaja la etapa; el resto no se reescribe.
        const patchValues =
          lookupCanCreate && needsProcesoLookup
            ? {
                etapa: values.etapa,
                estado: values.estado,
                tipo_registro: values.tipo_registro,
                capa: values.capa,
                contrato_convenio: values.contrato_convenio,
                clave_proceso: values.clave_proceso,
                clave_seguimiento: values.clave_seguimiento,
                tipo_vinculo: values.tipo_vinculo,
              }
            : activeForm?.patchFieldNames?.length
              ? Object.fromEntries(
                  activeForm.patchFieldNames
                    .filter((n) => n in values)
                    .map((n) => [n, values[n]]),
                )
              : values;
        const res = await fetch(
          `/api/themes/${theme.id}/records/${editingRecordId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              values: patchValues,
              reason: lookupCanCreate
                ? `cambio de etapa/estado · ${String(values.etapa || "")} · ${String(values.estado || "")}`
                : activeForm?.patchFieldNames?.length
                  ? `categorías · ${activeForm.label}`
                  : `edición formulario · ${activeForm?.label || "capa"}`,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al actualizar");
          return;
        }
        setMessage(
          theme.id === "carrotanques"
            ? `Registro actualizado${
                data.changedFields?.length
                  ? ` · cambió: ${(data.changedFields as string[])
                      .map(
                        (n) =>
                          theme.fields.find((f) => f.name === n)?.label || n,
                      )
                      .join(", ")}`
                  : ""
              }.`
            : `Registro actualizado${
                data.changedFields?.length
                  ? ` · cambió: ${data.changedFields.join(", ")}`
                  : ""
              }.`,
        );
        if (editingRecordId) {
          void loadUpsertVersions(editingRecordId);
        }
        if (
          !lookupCanCreate &&
          needsProcesoLookup &&
          selectedProceso &&
          activeForm
        ) {
          try {
            const listRes = await fetch(
              `/api/themes/${theme.id}/puentes?proceso=${encodeURIComponent(selectedProceso.clave_proceso)}&contrato=${encodeURIComponent(selectedProceso.contrato_convenio)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
            );
            const listData = await listRes.json();
            if (listRes.ok && Array.isArray(listData.puentes)) {
              setAppendLayerRows(
                (listData.puentes as PuenteLookupHit[]).map(puenteHitToRecordRow),
              );
              setSelectedProceso({
                ...selectedProceso,
                puentes_vinculados: listData.puentes.length,
              });
            }
          } catch {
            /* onSaved refresca el listado global */
          }
        }
        onSaved();
        return;
      }

      const res = await fetch(`/api/themes/${theme.id}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values,
          mode: persistMode,
          formId: activeForm?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          data.errors?.[0]?.message || data.error || "Error al guardar";
        setError(detail);
        return;
      }
      if (data.record?.id && persistMode === "upsert") {
        setEditingRecordId(String(data.record.id));
      }
      const keepOp = form.orden_de_proveeduria || selectedOrden?.orden_de_proveeduria || "";
      const keepIdp = form.id_puente || selectedPuente?.id_puente || "";
      if (needsOrdenLookup && selectedOrden) {
        // Mantener OP seleccionada; si era alta nueva en upsert, recargar capa
        if (persistMode === "upsert" && data.record?.id) {
          setEditingRecordId(String(data.record.id));
          setMessage(
            `Registro guardado (${activeForm?.label || "formulario"}). Puede seguir editando; los cambios siguientes quedan versionados.`,
          );
        } else {
          setForm(
            applyComputedFields(
              {
                ...inheritFromAlta(selectedOrden, activeForm?.fieldNames || [], {
                  lookupBy: resolveOrdenLookupBy(activeForm, theme.id),
                  byPlaca:
                    resolveOrdenLookupBy(activeForm, theme.id) === "placa",
                }),
                tipo_registro: activeForm?.capa || "",
                capa: activeForm?.capa || "",
              },
              activeForm?.computedFields,
            ),
          );
          const action =
            data.updated > 0
              ? "actualizado"
              : persistMode === "append"
                ? "agregado"
                : "guardado";
          const syncNote =
            (persistMode === "append" || persistMode === "upsert") &&
            (data.carroSync?.ok || data.maquetaSync?.ok || data.bmaqSync?.ok)
              ? theme.id === "carrotanques"
                ? " También se actualizó el inventario con el último evento."
                : theme.id === "banco-de-maquinaria"
                  ? " También se actualizó el convenio o detalle relacionado."
                  : " También se actualizó el registro principal."
              : persistMode === "append"
                ? " El historial queda debajo."
                : "";
          setMessage(
            `Registro ${action} (${activeForm?.label || "formulario"}).${syncNote}`,
          );
          if (persistMode === "append" && selectedOrden && activeForm) {
            try {
              const histRes = await fetch(
                `/api/themes/${theme.id}/orders?op=${encodeURIComponent(selectedOrden.orden_de_proveeduria)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
              );
              const histData = await histRes.json();
              if (histRes.ok && Array.isArray(histData.orders)) {
                setAppendLayerRows(
                  (histData.orders as OrdenLookupHit[]).map(hitToRecordRow),
                );
              }
            } catch {
              /* el listado global se refresca con onSaved */
            }
          }
        }
      } else if (needsPuenteLookup && selectedPuente) {
        setForm(
          applyComputedFields(
            {
              ...inheritFromInventario(
                selectedPuente,
                activeForm?.fieldNames || [],
              ),
              tipo_registro: activeForm?.capa || "",
              capa: activeForm?.capa || "",
            },
            activeForm?.computedFields,
          ),
        );
        const action =
          data.updated > 0
            ? "actualizado"
            : persistMode === "append"
              ? "agregado"
              : "guardado";
        const syncNote =
          persistMode === "append" && data.inventarioSync?.ok
            ? " El inventario refleja el último estado de bitácora."
            : persistMode === "append"
              ? " El historial queda debajo; el inventario refleja el último evento."
              : "";
        setMessage(
          `Registro ${action} (${activeForm?.label || "formulario"}).${syncNote}`,
        );
        if (persistMode === "append" && selectedPuente && activeForm) {
          try {
            const histRes = await fetch(
              `/api/themes/${theme.id}/puentes?id=${encodeURIComponent(selectedPuente.id_puente)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
            );
            const histData = await histRes.json();
            if (histRes.ok && Array.isArray(histData.puentes)) {
              setAppendLayerRows(
                (histData.puentes as PuenteLookupHit[]).map(puenteHitToRecordRow),
              );
            }
          } catch {
            /* el listado global se refresca con onSaved */
          }
        }
      } else if (needsProcesoLookup && selectedProceso) {
        if (persistMode === "upsert" && data.record?.id && lookupCanCreate) {
          const newId = String(data.record.id);
          setEditingRecordId(newId);
          setSelectedProceso({
            ...selectedProceso,
            id: newId,
            estructurado: true,
          });
          setMessage(
            data.updated > 0
              ? `Proceso modificado. Etapa/estado quedan versionados abajo.`
              : `Proceso registrado. Si cambia etapa o estado, modifique: queda trazabilidad.`,
          );
          void loadUpsertVersions(newId);
        } else if (
          persistMode === "upsert" &&
          !lookupCanCreate &&
          activeForm
        ) {
          const newId = data.record?.id ? String(data.record.id) : null;
          if (newId) {
            setEditingRecordId(newId);
            void loadUpsertVersions(newId);
          }
          setMessage(
            data.updated > 0
              ? `Puente actualizado. La trazabilidad queda en versiones abajo.`
              : `Puente registrado. Puede seguir editándolo o pulsar «Nuevo puente».`,
          );
          try {
            const listRes = await fetch(
              `/api/themes/${theme.id}/puentes?proceso=${encodeURIComponent(selectedProceso.clave_proceso)}&contrato=${encodeURIComponent(selectedProceso.contrato_convenio)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
            );
            const listData = await listRes.json();
            if (listRes.ok && Array.isArray(listData.puentes)) {
              setAppendLayerRows(
                (listData.puentes as PuenteLookupHit[]).map(
                  puenteHitToRecordRow,
                ),
              );
              setSelectedProceso({
                ...selectedProceso,
                puentes_vinculados: listData.puentes.length,
              });
            }
          } catch {
            /* el listado global se refresca con onSaved */
          }
        } else {
          setForm(
            applyComputedFields(
              {
                contrato_convenio: selectedProceso.contrato_convenio,
                clave_proceso: selectedProceso.clave_proceso,
                tipo_vinculo: selectedProceso.tipo_vinculo,
                tipo_registro: activeForm?.capa || "",
                capa: activeForm?.capa || "",
              },
              activeForm?.computedFields,
            ),
          );
          const action =
            data.updated > 0
              ? "actualizado"
              : persistMode === "append"
                ? "agregado"
                : "guardado";
          setMessage(
            `Registro ${action} (${activeForm?.label || "formulario"}).`,
          );
          if (persistMode === "append" && selectedProceso && activeForm) {
            try {
              const histRes = await fetch(
                `/api/themes/${theme.id}/procesos?clave=${encodeURIComponent(selectedProceso.clave_proceso)}&capa=${encodeURIComponent(activeForm.capa)}&all=1`,
              );
              const histData = await histRes.json();
              if (histRes.ok && Array.isArray(histData.procesos)) {
                setAppendLayerRows(histData.procesos as RecordRow[]);
              }
            } catch {
              /* el listado global se refresca con onSaved */
            }
          }
        }
      } else {
        setForm(
          activeForm
            ? {
                orden_de_proveeduria: keepOp,
                id_puente: keepIdp,
                tipo_registro: activeForm.capa,
                capa: activeForm.capa,
              }
            : {},
        );
        const action =
          data.updated > 0
            ? "actualizado"
            : persistMode === "append"
              ? "agregado"
              : "guardado";
        setMessage(`Registro ${action} (${activeForm?.label || "formulario"}).`);
      }
      onSaved();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    setError(null);
    try {
      const res = await fetch(`/api/themes/${theme.id}/template`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo descargar la plantilla");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla_${theme.id}_v${theme.schemaVersion ?? 1}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Error al descargar la plantilla.");
    }
  }

  async function uploadExcel(file: File, dryRun: boolean) {
    setError(null);
    setMessage(null);
    if (!dryRun) setDrySummary(null);
    setPreview([]);
    setUploadErrors([]);
    if (!writable) {
      setError("Su rol no permite carga masiva.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("dryRun", dryRun ? "1" : "0");
      body.append("mode", upsertMode ? "upsert" : "insert");
      const res = await fetch(`/api/themes/${theme.id}/uploads`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error en la carga");
        return;
      }
      setPreview((data.preview as RecordRow[]) || []);
      setUploadErrors((data.errors as UploadError[]) || []);

      if (dryRun) {
        setPendingFile(file);
        setDrySummary({
          totalRows: data.totalRows ?? 0,
          valid: data.valid ?? data.accepted ?? 0,
          invalid: data.invalid ?? data.rejected ?? 0,
          wouldInsert: data.wouldInsert ?? 0,
          wouldUpdate: data.wouldUpdate ?? 0,
          wouldSkipDuplicate: data.wouldSkipDuplicate ?? data.duplicates ?? 0,
          withoutTrackingKey: data.withoutTrackingKey ?? 0,
          tip: data.tip,
        });
        setMessage(
          "Validación lista (no se guardó nada). Revise el resumen y pulse «Subir y guardar» si está correcto.",
        );
        return;
      }

      setPendingFile(null);
      if (data.async) {
        setMessage(
          `Carga encolada (${data.queued} filas, modo ${data.mode}). El progreso queda en la bandeja de esta pestaña.`,
        );
      } else {
        const ins = data.inserted ?? data.accepted ?? 0;
        const upd = data.updated ?? 0;
        setMessage(
          `Guardado: ${ins} nuevos · ${upd} actualizados · ${data.rejected ?? 0} rechazados · ${data.duplicates ?? 0} omitidos (duplicados).`,
        );
      }
      if (data.accepted > 0 || data.updated > 0 || data.async) onSaved();
    } catch {
      setError("No se pudo procesar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setPendingFile(file);
    await uploadExcel(file, true);
  }

  return (
    <div className="space-y-5" id="tour-captura">
      {!writable && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Modo lectura: su rol <strong>{role}</strong> no puede crear registros.
          Use un usuario con rol <strong>operativo</strong>,{" "}
          <strong>coordinador</strong>, <strong>subdirector</strong> o{" "}
          <strong>admin</strong>.
        </p>
      )}

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-ungrd-success">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-ungrd-danger">
          {error}
        </p>
      )}

      {mode === "form" ? (
        <form
          onSubmit={onSubmit}
          className={
            captureForms.length > 1
              ? "space-y-4 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0"
              : "space-y-4"
          }
        >
          <CaptureFormStepper
            themeId={theme.id}
            forms={captureForms}
            activeId={activeForm?.id || ""}
            onSelect={(id) => {
              setActiveFormId(id);
              setError(null);
              setMessage(null);
            }}
          />
          <div className="min-w-0 space-y-4">
          {hasCaptureForms ? (
            <div className="space-y-3">
              {activeForm ? (
                <p className="text-sm text-ungrd-muted">
                  {activeForm.description}
                </p>
              ) : null}

              {needsOrdenLookup && activeForm ? (
                <OrdenLookup
                  themeId={theme.id}
                  capa={activeForm.lookupCapa || "Alta / orden"}
                  selected={selectedOrden}
                  onSelect={(hit) => void selectOrden(hit)}
                  onClear={clearOrden}
                  disabled={!writable || busy || loadingLayer}
                  expandPaymentOps={Boolean(activeForm.lookupExpandPaymentOps)}
                  lookupBy={resolveOrdenLookupBy(activeForm, theme.id)}
                />
              ) : null}
              {needsPuenteLookup && activeForm ? (
                <PuenteLookup
                  themeId={theme.id}
                  capa={activeForm.lookupCapa || "Inventario puente"}
                  selected={selectedPuente}
                  onSelect={(hit) => void selectPuente(hit)}
                  onClear={clearPuente}
                  disabled={!writable || busy || loadingLayer}
                />
              ) : null}
              {needsProcesoLookup && activeForm ? (
                <ProcesoLookup
                  themeId={theme.id}
                  selected={selectedProceso}
                  onSelect={(hit) => void selectProceso(hit)}
                  onClear={clearProceso}
                  disabled={!writable || busy || loadingLayer}
                  initialQuery={selectedPuente?.contrato_convenio}
                  allowCreate={lookupCanCreate}
                  catalog={lookupCanCreate ? "estructuracion" : "inventario"}
                />
              ) : null}
              <CaptureIdentityFicha
                lookupBy={resolveOrdenLookupBy(activeForm, theme.id)}
                orden={selectedOrden}
                puente={selectedPuente}
                proceso={selectedProceso}
              />
              {loadingLayer ? (
                <p className="text-xs font-semibold text-ungrd-muted">
                  Cargando datos existentes de esta capa…
                </p>
              ) : null}
              {editingRecordId && activeForm?.mode === "upsert" ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  {lookupCanCreate
                    ? "Registro existente: aquí solo se actualizan etapa y estado."
                    : theme.id === "carrotanques" &&
                        activeForm.patchFieldNames?.length
                      ? "Registro existente: aquí solo se actualizan categorías y clasificación."
                      : "Editando este puente. Para agregar otro, use «Nuevo puente»."}
                </p>
              ) : null}
              {!lookupCanCreate &&
              needsProcesoLookup &&
              selectedProceso &&
              !editingRecordId &&
              activeForm?.mode === "upsert" ? (
                <p className="rounded-lg border border-ungrd-border bg-ungrd-row-alt px-3 py-2 text-xs font-semibold text-ungrd-heading">
                  Formulario listo para un puente nuevo, o elija uno de la lista
                  para editarlo.
                </p>
              ) : null}
              {lookupCanCreate && !selectedProceso && !editingRecordId ? (
                <p className="rounded-lg border border-ungrd-border bg-ungrd-row-alt px-3 py-2 text-xs font-semibold text-ungrd-heading">
                  Complete los campos para un proceso nuevo, o elija uno de la
                  lista para actualizar etapa y estado.
                </p>
              ) : null}
              {lookupCanCreate && selectedProceso && !editingRecordId ? (
                <p className="rounded-lg border border-ungrd-navy/20 bg-ungrd-navy/[0.04] px-3 py-2 text-xs font-semibold text-ungrd-navy">
                  Proceso nuevo seleccionado: complete los datos y pulse
                  Registrar.
                </p>
              ) : null}
            </div>
          ) : isSourceTheme(theme.id) ? (
            <p className="rounded-xl border border-ungrd-navy/15 bg-ungrd-navy/[0.04] px-4 py-3 text-sm text-ungrd-muted">
              Complete los campos y guarde. También puede cargar un Excel en la
              pestaña correspondiente.
            </p>
          ) : null}

          {activeForm?.mode === "upsert" &&
          needsProcesoLookup &&
          !lookupCanCreate ? (
            <div className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold tracking-[0.16em] text-ungrd-navy uppercase">
                    Puentes del contrato
                  </p>
                  <p className="mt-1 text-sm text-ungrd-muted">
                    Lista de puentes de este contrato. Clic en una fila para
                    editar; «Nuevo puente» para agregar otro.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ungrd-navy/10 px-3 py-1 text-xs font-bold text-ungrd-navy">
                    {puentesVinculados.length} puente
                    {puentesVinculados.length === 1 ? "" : "s"}
                    {selectedProceso
                      ? ` · ${selectedProceso.contrato_convenio.slice(0, 28)}${selectedProceso.contrato_convenio.length > 28 ? "…" : ""}`
                      : ""}
                  </span>
                  {selectedProceso ? (
                    <button
                      type="button"
                      onClick={startNuevoInventarioPuente}
                      disabled={!writable || busy}
                      className="rounded-lg border border-ungrd-navy/30 bg-ungrd-surface px-3 py-1.5 text-xs font-extrabold text-ungrd-heading transition hover:bg-ungrd-row-hover disabled:opacity-50"
                    >
                      Nuevo puente
                    </button>
                  ) : null}
                </div>
              </div>
              {!selectedProceso ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Seleccione un contrato de la lista para ver todos los puentes
                  ya vinculados en inventario.
                </p>
              ) : loadingLayer ? (
                <p className="mt-3 text-xs text-ungrd-muted">Cargando puentes…</p>
              ) : puentesVinculados.length === 0 ? (
                <p className="mt-3 text-sm text-ungrd-muted">
                  Este contrato aún no tiene puentes en inventario. Complete el
                  formulario y regístrelo.
                </p>
              ) : (
                <>
                <div className="ungrd-data-table mt-3 overflow-x-auto rounded-xl border border-ungrd-border">
                  <table className="min-w-full border-collapse text-left text-xs">
                    <thead className="bg-ungrd-surface">
                      <tr>
                        <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                          ID único
                        </th>
                        <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                          #
                        </th>
                        <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                          Tipo
                        </th>
                        <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                          Ubicación
                        </th>
                        <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                          Depto / Mpio
                        </th>
                        <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {puentesVinculados.map((r) => {
                        const selected = editingRecordId === String(r.id);
                        const codigo = String(
                          r.codigo_operativo || "",
                        ).trim();
                        return (
                          <tr
                            key={String(r.id)}
                            role="button"
                            tabIndex={0}
                            onClick={() => selectInventarioPuente(r)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectInventarioPuente(r);
                              }
                            }}
                            className={
                              selected
                                ? "cursor-pointer bg-ungrd-yellow/40"
                                : "cursor-pointer odd:bg-ungrd-row even:bg-ungrd-row-alt hover:bg-ungrd-row-hover text-ungrd-text"
                            }
                          >
                            <td className="border-b border-ungrd-border/60 px-2 py-1.5 font-semibold break-all text-ungrd-heading">
                              {codigo ||
                                (rowIdPuente(r)
                                  ? `ID ${rowIdPuente(r)}`
                                  : "—")}
                            </td>
                            <td className="border-b border-ungrd-border/60 px-2 py-1.5 text-ungrd-muted">
                              {rowIdPuente(r) || "—"}
                            </td>
                            <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                              {String(r.tipo || "—")}
                            </td>
                            <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                              {String(r.ubicacion_actual || "—")}
                            </td>
                            <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                              {String(r.departamento || "—")} /{" "}
                              {String(r.municipio || "—")}
                            </td>
                            <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                              {String(r.estado_puente || r.estado || "—")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-ungrd-muted">
                  Listado completo: {puentesVinculados.length} registro
                  {puentesVinculados.length === 1 ? "" : "s"} de este contrato.
                </p>
                </>
              )}
            </div>
          ) : null}

          {fieldSections.map((section) => (
            <fieldset
              key={section.id}
              className="theme-fieldset"
              disabled={needsEntityLookup && !entityGateOpen}
            >
              <legend>{section.title}</legend>
              {needsEntityLookup && !entityGateOpen ? (
                <p className="mt-2 text-sm text-ungrd-muted">
                  {needsOrdenLookup
                    ? activeForm?.lookupBy === "placa" ||
                      theme.id === "carrotanques"
                      ? "Seleccione primero la placa para habilitar los campos."
                      : "Seleccione primero la orden de proveeduría para habilitar los campos."
                    : needsPuenteLookup
                      ? "Seleccione primero el puente para habilitar los campos."
                      : "Seleccione primero el contrato o convenio para habilitar los campos."}
                </p>
              ) : (
                <div className="mt-3.5 grid gap-3 sm:gap-3.5 md:grid-cols-2">
                  {section.names.map((name) => renderField(name))}
                </div>
              )}
            </fieldset>
          ))}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--theme-accent)_35%,var(--ungrd-border))] bg-[color-mix(in_srgb,var(--ungrd-surface)_92%,var(--theme-wash))] px-4 py-3 ${
              !needsEntityLookup || entityGateOpen ? "theme-save-bar" : ""
            }`}
          >
            <p className="text-xs font-semibold text-ungrd-muted">
              {activeForm
                ? activeForm.label.replace(/^\d+\s*·\s*/, "")
                : "Registro"}
              {editingRecordId ? " · editando" : ""}
            </p>
            <button
              type="submit"
              disabled={
                !writable || busy || (needsEntityLookup && !entityGateOpen)
              }
              className="theme-btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {busy
                ? "Guardando…"
                : editingRecordId
                  ? lookupCanCreate
                    ? `Actualizar etapa/estado · ${activeForm?.label.replace(/^\d+\s*·\s*/, "") || "proceso"}`
                    : theme.id === "carrotanques"
                      ? `Actualizar vehículo · ${form.placa || selectedOrden?.orden_de_proveeduria || "placa"}`
                      : `Actualizar puente · ${form.id_puente || "inventario"}`
                  : lookupCanCreate && needsProcesoLookup
                    ? `Registrar · ${activeForm?.label.replace(/^\d+\s*·\s*/, "") || "proceso"}`
                    : needsProcesoLookup && !lookupCanCreate
                      ? "Registrar puente nuevo"
                      : activeForm
                        ? `Guardar · ${activeForm.label.replace(/^\d+\s*·\s*/, "")}`
                        : "Guardar registro"}
            </button>
          </div>

          {activeForm?.mode === "upsert" && editingRecordId ? (
            <div className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold tracking-[0.16em] text-ungrd-navy uppercase">
                    {theme.id === "carrotanques"
                      ? "Historial de cambios"
                      : lookupCanCreate
                        ? "Historial del proceso"
                        : "Historial de cambios"}
                  </p>
                  <p className="mt-1 max-w-2xl text-sm text-ungrd-muted">
                    {theme.id === "carrotanques"
                      ? "Cada guardado conserva qué cambió y cuándo. Nada se borra."
                      : lookupCanCreate
                        ? "El contrato queda fijo; solo cambian etapa y estado. Cada cambio queda registrado."
                        : "Cada modificación queda registrada con el detalle de campos."}
                  </p>
                </div>
                <span className="rounded-full bg-ungrd-navy/10 px-3 py-1 text-xs font-bold text-ungrd-navy">
                  {upsertVersions.length} versión
                  {upsertVersions.length === 1 ? "" : "es"}
                  {theme.id === "carrotanques" &&
                  (form.placa || selectedOrden?.orden_de_proveeduria)
                    ? ` · ${form.placa || selectedOrden?.orden_de_proveeduria}`
                    : ""}
                </span>
              </div>

              {loadingVersions ? (
                <p className="mt-3 text-xs text-ungrd-muted">
                  Cargando historial…
                </p>
              ) : upsertVersions.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-ungrd-border bg-ungrd-row-alt/60 px-4 py-6 text-center text-sm text-ungrd-muted">
                  Aún no hay versiones guardadas. Al editar y guardar aparecerá
                  aquí el historial completo.
                </p>
              ) : (
                <ol className="relative mt-4 space-y-0 border-l-2 border-ungrd-navy/20 pl-4">
                  {upsertVersions.map((v, idx) => {
                    const prev = upsertVersions.find(
                      (x) => x.version === v.version - 1,
                    );
                    const when = v.createdAt
                      ? new Date(v.createdAt).toLocaleString("es-CO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—";
                    const isLatest = idx === 0;
                    const isInitial =
                      !v.changedFields?.length ||
                      /versi[oó]n inicial/i.test(v.reason || "");
                    const focusKeys =
                      theme.id === "carrotanques"
                        ? [
                            "otras_categorizaciones",
                            "clasificacion_propiedad",
                            "placa",
                            "marca",
                            "estado",
                            "ubicacion_actual",
                            "departamento",
                            "municipio",
                          ]
                        : lookupCanCreate
                          ? ["etapa", "estado", "estado_proceso"]
                          : null;
                    const changed = (v.changedFields || []).filter(Boolean);
                    const detailKeys =
                      changed.length > 0
                        ? changed
                        : focusKeys?.filter((k) => {
                            const cur = String(v.payload?.[k] ?? "").trim();
                            return cur !== "";
                          }) || [];
                    const open =
                      expandedVersion === v.version ||
                      (expandedVersion === null && isLatest);
                    const labelOf = (name: string) =>
                      theme.fields.find((f) => f.name === name)?.label || name;
                    const fmt = (raw: unknown) => {
                      if (raw === undefined || raw === null) return "—";
                      const s = String(raw).trim();
                      return s === "" ? "—" : s;
                    };

                    return (
                      <li key={`${v.version}-${v.createdAt}`} className="relative pb-4">
                        <span
                          className={`absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 ${
                            isLatest
                              ? "border-ungrd-navy bg-ungrd-yellow"
                              : "border-ungrd-navy/40 bg-ungrd-surface"
                          }`}
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedVersion(open ? -1 : v.version)
                          }
                          className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                            open
                              ? "border-ungrd-navy/30 bg-ungrd-surface shadow-sm"
                              : "border-ungrd-border/80 bg-ungrd-row-alt hover:border-ungrd-navy/25"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-ungrd-navy px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-white">
                              v{v.version}
                            </span>
                            {isLatest ? (
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-emerald-900 uppercase dark:bg-emerald-900/40 dark:text-emerald-100">
                                Vigente
                              </span>
                            ) : null}
                            {isInitial ? (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-slate-700 uppercase dark:bg-slate-800 dark:text-slate-200">
                                Inicial
                              </span>
                            ) : null}
                            <span className="text-xs text-ungrd-muted">{when}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-ungrd-heading">
                            {isInitial
                              ? "Registro inicial"
                              : changed.length
                                ? `${changed.length} campo${changed.length === 1 ? "" : "s"} modificado${changed.length === 1 ? "" : "s"}`
                                : v.reason || "Cambio registrado"}
                          </p>
                          {!isInitial && changed.length > 0 ? (
                            <p className="mt-0.5 text-xs text-ungrd-muted">
                              {changed
                                .slice(0, 4)
                                .map((n) => labelOf(n))
                                .join(" · ")}
                              {changed.length > 4
                                ? ` · +${changed.length - 4}`
                                : ""}
                            </p>
                          ) : null}
                        </button>

                        {open ? (
                          <div className="mt-2 space-y-2 rounded-xl border border-ungrd-border bg-ungrd-bg/40 p-3 dark:bg-ungrd-navy-deep/30">
                            {v.reason ? (
                              <p className="text-[11px] text-ungrd-muted">
                                Motivo:{" "}
                                <span className="font-semibold text-ungrd-heading">
                                  {v.reason}
                                </span>
                              </p>
                            ) : null}
                            {detailKeys.length === 0 ? (
                              <p className="text-xs text-ungrd-muted">
                                Sin detalle de campos en esta versión.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {detailKeys.map((name) => {
                                  const after = fmt(v.payload?.[name]);
                                  const before = prev
                                    ? fmt(prev.payload?.[name])
                                    : null;
                                  const didChange =
                                    changed.includes(name) &&
                                    before !== null &&
                                    before !== after;
                                  return (
                                    <li
                                      key={name}
                                      className="rounded-lg border border-ungrd-border/70 bg-ungrd-surface px-3 py-2"
                                    >
                                      <p className="text-[10px] font-bold tracking-wide text-ungrd-navy uppercase">
                                        {labelOf(name)}
                                      </p>
                                      {didChange ? (
                                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                                          <span className="rounded bg-rose-50 px-1.5 py-0.5 font-medium text-rose-900 line-through decoration-rose-300 dark:bg-rose-950/40 dark:text-rose-100">
                                            {before}
                                          </span>
                                          <span className="text-ungrd-muted" aria-hidden>
                                            →
                                          </span>
                                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
                                            {after}
                                          </span>
                                        </p>
                                      ) : (
                                        <p className="mt-1 text-sm font-semibold text-ungrd-heading">
                                          {after}
                                        </p>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ) : null}

          {activeForm?.mode === "append" ? (
            <div className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold tracking-[0.16em] text-ungrd-navy uppercase">
                    Historial · {activeForm.label.replace(/^\d+\s*·\s*/, "")}
                  </p>
                  <p className="mt-1 text-sm text-ungrd-muted">
                    Eventos ordenados por fecha. Cada guardado agrega una fila
                    nueva.
                  </p>
                </div>
                <span className="rounded-full bg-ungrd-navy/10 px-3 py-1 text-xs font-bold text-ungrd-navy">
                  {appendHistory.length} registro
                  {appendHistory.length === 1 ? "" : "s"}
                  {selectedOrden
                    ? ` · ${selectedOrden.orden_de_proveeduria}`
                    : selectedPuente
                      ? ` · Puente ${selectedPuente.id_puente}`
                      : selectedProceso
                        ? ` · ${selectedProceso.contrato_convenio.slice(0, 40)}${selectedProceso.contrato_convenio.length > 40 ? "…" : ""}`
                        : ""}
                </span>
              </div>

              {needsEntityLookup && !hasEntitySelected ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {needsOrdenLookup
                    ? activeForm?.lookupBy === "placa" ||
                      theme.id === "carrotanques"
                      ? "Seleccione la placa para ver el historial."
                      : "Seleccione la orden de proveeduría para ver el historial."
                    : needsPuenteLookup
                      ? "Seleccione el puente para ver el historial."
                      : "Seleccione el contrato o convenio para ver el historial."}
                </p>
              ) : null}

              <div className="ungrd-data-table mt-3 max-h-[28rem] overflow-auto rounded-xl border border-ungrd-border">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-ungrd-navy text-white">
                    <tr>
                      <th className="whitespace-nowrap px-2 py-2 font-bold">#</th>
                      <th className="whitespace-nowrap px-2 py-2 font-bold">
                        Fecha
                      </th>
                      {historyColumns.map((name) => (
                        <th
                          key={name}
                          className="whitespace-nowrap px-2 py-2 font-bold"
                        >
                          {theme.fields.find((f) => f.name === name)?.label ||
                            name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!hasEntitySelected && needsEntityLookup ? (
                      <tr>
                        <td
                          colSpan={historyColumns.length + 2}
                          className="px-3 py-8 text-center text-sm text-ungrd-muted"
                        >
                          {needsOrdenLookup
                            ? activeForm?.lookupBy === "placa" ||
                              theme.id === "carrotanques"
                              ? "Elija una placa para ver el historial."
                              : "Elija una orden de proveeduría para ver el historial."
                            : needsPuenteLookup
                              ? "Elija un puente para ver el historial."
                              : "Elija un contrato o convenio para ver el historial."}
                        </td>
                      </tr>
                    ) : appendHistory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={historyColumns.length + 2}
                          className="px-3 py-8 text-center text-sm text-ungrd-muted"
                        >
                          Aún no hay eventos
                          {selectedOrden
                            ? " para esta OP"
                            : selectedPuente
                              ? ` para el puente ${selectedPuente.id_puente}`
                              : selectedProceso
                                ? " para este proceso"
                                : ""}
                          . Al guardar, aparecerán aquí en orden de fecha.
                        </td>
                      </tr>
                    ) : (
                      appendHistory.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={`border-t border-ungrd-border text-ungrd-text ${
                            idx % 2 ? "bg-ungrd-row-alt" : "bg-ungrd-row"
                          }`}
                        >
                          <td className="px-2 py-1.5 text-ungrd-muted">
                            {idx + 1}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-ungrd-heading">
                            {eventDateKey(row) === "9999-99-99"
                              ? "—"
                              : eventDateKey(row)}
                          </td>
                          {historyColumns.map((name) => (
                            <td
                              key={name}
                              className="max-w-[14rem] truncate px-2 py-1.5"
                              title={cellText(row, name)}
                            >
                              {cellText(row, name)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-[color-mix(in_srgb,var(--theme-accent)_22%,var(--ungrd-border))] bg-ungrd-surface p-5">
          {feedGuide ? (
            <div className="rounded-xl border border-ungrd-navy/20 bg-ungrd-navy/[0.04] px-4 py-3 text-sm">
              <p className="text-[11px] font-extrabold tracking-wide text-ungrd-navy uppercase">
                Cómo cargar este tema
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-ungrd-muted">
                <li>
                  <strong className="text-ungrd-heading">Identificador:</strong>{" "}
                  {feedGuide.clave}
                </li>
                <li>
                  <strong className="text-ungrd-heading">Formularios:</strong>{" "}
                  {feedGuide.capas.join(" · ")}
                </li>
                <li>{feedGuide.tip}</li>
              </ul>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ungrd-navy/20 bg-ungrd-navy/[0.04] px-4 py-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={upsertMode}
              disabled={!writable || busy}
              onChange={(e) => setUpsertMode(e.target.checked)}
            />
            <span className="text-sm">
              <span className="inline-flex items-center gap-1.5 font-extrabold text-ungrd-heading">
                <RefreshCw className="h-3.5 w-3.5" />
                Actualizar si el registro ya existe
              </span>
              <span className="mt-1 block text-xs font-normal text-ungrd-muted">
                Si ya hay una fila con el mismo identificador y tipo, se
                corrige en lugar de crear otra.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-ungrd-border bg-ungrd-surface px-4 py-2.5 text-sm font-bold text-ungrd-heading"
            >
              <FileSpreadsheet className="h-4 w-4 text-ungrd-navy" />
              Descargar plantilla de {theme.shortName || theme.name}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-bold text-white">
              <Upload className="h-4 w-4" />
              Validar Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={!writable || busy}
                onChange={(e) => onFile(e.target.files?.[0] || null)}
              />
            </label>
            {pendingFile && drySummary && drySummary.invalid === 0 ? (
              <button
                type="button"
                disabled={!writable || busy}
                onClick={() => uploadExcel(pendingFile, false)}
                className="inline-flex items-center gap-2 rounded-lg bg-ungrd-yellow px-4 py-2.5 text-sm font-extrabold text-ungrd-navy-deep"
              >
                <ShieldCheck className="h-4 w-4" />
                Subir y guardar
              </button>
            ) : null}
          </div>

          {drySummary ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-ungrd-border p-3 text-sm">
                <p className="text-[11px] font-bold uppercase text-ungrd-muted">
                  Filas
                </p>
                <p className="text-lg font-extrabold">{drySummary.totalRows}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                <p className="text-[11px] font-bold uppercase text-emerald-800">
                  Válidas
                </p>
                <p className="text-lg font-extrabold text-emerald-900">
                  {drySummary.valid}
                </p>
              </div>
              <div className="rounded-xl border border-ungrd-border p-3 text-sm">
                <p className="text-[11px] font-bold uppercase text-ungrd-muted">
                  Insertar / actualizar
                </p>
                <p className="text-lg font-extrabold">
                  {drySummary.wouldInsert} / {drySummary.wouldUpdate}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 text-sm">
                <p className="text-[11px] font-bold uppercase text-red-800">
                  Inválidas
                </p>
                <p className="text-lg font-extrabold text-red-900">
                  {drySummary.invalid}
                </p>
              </div>
            </div>
          ) : null}

          {uploadErrors.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-bold">Errores de validación</p>
              <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-4">
                {uploadErrors.slice(0, 40).map((err, i) => (
                  <li key={`${err.row}-${err.field}-${i}`}>
                    Fila {err.row}: {err.field} — {err.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.length > 0 ? (
            <div className="rounded-xl border border-ungrd-border p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
                <ClipboardList className="h-3.5 w-3.5" />
                Vista previa ({preview.length})
              </p>
              <pre className="max-h-48 overflow-auto rounded-lg bg-ungrd-bg p-3 text-[11px] text-ungrd-muted">
                {JSON.stringify(preview.slice(0, 5), null, 2)}
              </pre>
            </div>
          ) : null}

          {!drySummary && !preview.length ? (
            <p className="flex items-center gap-2 text-sm text-ungrd-muted">
              <CheckCircle2 className="h-4 w-4 text-ungrd-navy" />
              Primero valide el Excel; solo entonces podrá confirmar el guardado.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
