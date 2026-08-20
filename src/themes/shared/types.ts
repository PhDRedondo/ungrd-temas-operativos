export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  /** Validación numérica / Excel */
  min?: number;
  max?: number;
  pattern?: string;
  excelWidth?: number;
};

/** Modo de persistencia del subformulario. */
export type CaptureFormMode = "create-once" | "upsert" | "append";

/**
 * Regla de cálculo para un campo de captura (solo lectura en UI).
 * `subtract`: left − right (usa el primer campo con valor en left/right + fallbacks).
 */
export type ComputedFieldRule = {
  op: "subtract";
  left: string;
  right: string;
  leftFallbacks?: string[];
  rightFallbacks?: string[];
};

/**
 * Subformulario operativo por capa (p. ej. Alta, Bitácora, AK–AV).
 * Si el tema define `captureForms`, la UI de captura los usa en lugar del form monolítico.
 */
export type CaptureFormConfig = {
  id: string;
  label: string;
  description: string;
  /** Valor de tipo_registro / capa que se fija al guardar. */
  capa: string;
  mode: CaptureFormMode;
  /** Nombres de FormField a mostrar (además de orden/clave implícitos). */
  fieldNames: string[];
  /** Campos siempre requeridos en este formulario (además de required del field). */
  requiredNames?: string[];
  /**
   * Si true, hay que buscar y seleccionar una OP del alta antes de capturar.
   * Evita reescribir datos del registro inicial.
   * En temas por placa (Carrotanques) use `lookupBy: "placa"`.
   */
  requiresOrdenLookup?: boolean;
  /** Buscar puente del inventario antes de capturar (Puentes). */
  requiresPuenteLookup?: boolean;
  /** Buscar contrato/convenio antes de capturar estructuración. */
  requiresProcesoLookup?: boolean;
  /**
   * Esta capa **origina** la entidad: el lookup permite crearla cuando no
   * existe (p. ej. Estructuración da de alta el contrato o la donación).
   * Sigue siendo obligatorio tener una entidad elegida o creada para guardar.
   */
  lookupCanCreate?: boolean;
  /** Capa fuente del lookup (default: formulario create-once / Alta). */
  lookupCapa?: string;
  /**
   * Clave de identidad del lookup compartido (`OrdenLookup`).
   * - `orden` (default): OP / clave de proveeduría (Agua).
   * - `placa`: placa de la maqueta (Carrotanques).
   * - `serial`: serial del equipo (Banco de Maquinaria / detalle).
   * - `convenio`: nº convenio o proceso (Banco de Maquinaria / bitácora).
   * - `contrato`: orden de compra o contrato de adquisición (Detalle maquinaria).
   */
  lookupBy?: "orden" | "placa" | "serial" | "convenio" | "contrato";
  /** Filtros facetados para PuenteLookup (departamento, municipio, …). */
  lookupFilterFields?: string[];
  /**
   * Si true, el lookup muestra la OP única y la OP por pago
   * (`orden_de_proveeduria_x_pago`) como resultados seleccionables.
   * Pensado para Pagos; no altera Bitácora / Modificaciones.
   */
  lookupExpandPaymentOps?: boolean;
  /**
   * Campos derivados (p. ej. saldo = valor orden − valor pagado).
   * Se recalculan al cambiar inputs; el input queda deshabilitado.
   */
  computedFields?: Record<string, ComputedFieldRule>;
  /**
   * En modo upsert con registro existente, solo estos campos viajan en el PATCH.
   * El resto del registro (p. ej. B–J de maqueta) no se reescribe.
   */
  patchFieldNames?: string[];
  /**
   * Con registro existente (editing), estos campos se muestran deshabilitados.
   */
  readonlyWhenEditing?: string[];
};

export type ThemeConfig = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  unit: string;
  valueLabel: string;
  fields: FormField[];
  /** URL de publicación/embed de Quick BI (Alibaba) para la pestaña QuickBI. */
  quickBiUrl?: string;
  /**
   * Varios tableros QuickBI por tema (preferido).
   * Si está vacío, se usa el catálogo central o `quickBiUrl`.
   */
  quickBiDashboards?: {
    title: string;
    description: string;
    url: string;
  }[];
  /** Versión del schema para plantillas Excel (bump al cambiar fields). */
  schemaVersion?: number;
  /** Formularios por capa (Agua y temas multi-capa). */
  captureForms?: CaptureFormConfig[];
};

/** Módulo autónomo de un tema: lo que cada desarrollador mantiene en su carpeta. */
export type ThemeModule = {
  config: ThemeConfig;
};

export type AppRole =
  | "admin"
  | "subdirector"
  | "coordinador"
  | "operativo";
