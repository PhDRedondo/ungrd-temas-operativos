export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
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
};

const geoFields: FormField[] = [
  {
    name: "departamento",
    label: "Departamento",
    type: "select",
    required: true,
    options: [
      "Antioquia",
      "Atlántico",
      "Bogotá D.C.",
      "Bolívar",
      "Boyacá",
      "Caldas",
      "Cauca",
      "Cesar",
      "Córdoba",
      "Cundinamarca",
      "Huila",
      "La Guajira",
      "Magdalena",
      "Meta",
      "Nariño",
      "Norte de Santander",
      "Quindío",
      "Risaralda",
      "Santander",
      "Sucre",
      "Tolima",
      "Valle del Cauca",
    ],
  },
  {
    name: "municipio",
    label: "Municipio",
    type: "text",
    required: true,
    placeholder: "Nombre del municipio",
  },
];

const baseDates: FormField[] = [
  { name: "fecha", label: "Fecha", type: "date", required: true },
  {
    name: "estado",
    label: "Estado",
    type: "select",
    required: true,
    options: ["Programado", "En ejecución", "Finalizado", "Suspendido"],
  },
  {
    name: "observaciones",
    label: "Observaciones",
    type: "textarea",
    placeholder: "Detalle adicional…",
  },
];

function theme(
  partial: Omit<ThemeConfig, "fields"> & { extraFields: FormField[] },
): ThemeConfig {
  return {
    ...partial,
    fields: [...geoFields, ...partial.extraFields, ...baseDates],
  };
}

export const THEMES: ThemeConfig[] = [
  theme({
    id: "agua-y-saneamiento",
    name: "Agua y Saneamiento",
    shortName: "Agua",
    description:
      "Proyectos de acueducto, alcantarillado y potabilización en emergencias.",
    icon: "droplets",
    unit: "beneficiarios",
    valueLabel: "Beneficiarios",
    extraFields: [
      {
        name: "tipo_intervencion",
        label: "Tipo de intervención",
        type: "select",
        required: true,
        options: [
          "Acueducto",
          "Alcantarillado",
          "Potabilización",
          "Carrotanque",
          "Kit higiene",
        ],
      },
      {
        name: "valor",
        label: "Valor (COP)",
        type: "number",
        required: true,
      },
      {
        name: "beneficiarios",
        label: "Beneficiarios",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "carrotanques",
    name: "Carrotanques",
    shortName: "Carrotanques",
    description: "Despacho y seguimiento de carrotanques de agua potable.",
    icon: "truck",
    unit: "m³",
    valueLabel: "Volumen (m³)",
    extraFields: [
      {
        name: "placa",
        label: "Placa",
        type: "text",
        required: true,
      },
      {
        name: "volumen_m3",
        label: "Volumen (m³)",
        type: "number",
        required: true,
      },
      {
        name: "destino",
        label: "Sitio de descarga",
        type: "text",
        required: true,
      },
      {
        name: "valor",
        label: "Costo (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "obras-de-emergencia",
    name: "Obras de Emergencia",
    shortName: "Obras emerg.",
    description: "Obras temporales y de estabilización ante eventos.",
    icon: "hard-hat",
    unit: "obras",
    valueLabel: "Obras",
    extraFields: [
      {
        name: "tipo_obra",
        label: "Tipo de obra",
        type: "select",
        required: true,
        options: [
          "Jarillón",
          "Descolmatación",
          "Estabilización",
          "Vía temporal",
          "Otra",
        ],
      },
      {
        name: "valor",
        label: "Inversión (COP)",
        type: "number",
        required: true,
      },
      {
        name: "avance",
        label: "Avance (%)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "puentes",
    name: "Puentes",
    shortName: "Puentes",
    description: "Intervención y reconstrucción de puentes vehiculares y peatonales.",
    icon: "bridge",
    unit: "puentes",
    valueLabel: "Puentes",
    extraFields: [
      {
        name: "tipo_puente",
        label: "Tipo",
        type: "select",
        required: true,
        options: ["Vehicular", "Peatonal", "Bailey", "Provisional"],
      },
      {
        name: "longitud_m",
        label: "Longitud (m)",
        type: "number",
        required: true,
      },
      {
        name: "valor",
        label: "Inversión (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "banco-de-maquinaria",
    name: "Banco de Maquinaria",
    shortName: "Maquinaria",
    description: "Disponibilidad y asignación de maquinaria amarilla.",
    icon: "cog",
    unit: "horas",
    valueLabel: "Horas máquina",
    extraFields: [
      {
        name: "equipo",
        label: "Equipo",
        type: "select",
        required: true,
        options: [
          "Retroexcavadora",
          "Bulldozer",
          "Volqueta",
          "Motoniveladora",
          "Cargador",
        ],
      },
      {
        name: "horas",
        label: "Horas asignadas",
        type: "number",
        required: true,
      },
      {
        name: "valor",
        label: "Costo (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "obras-por-impuestos",
    name: "Obras por impuestos",
    shortName: "Obras impuestos",
    description: "Proyectos financiados mediante el mecanismo de obras por impuestos.",
    icon: "landmark",
    unit: "proyectos",
    valueLabel: "Proyectos",
    extraFields: [
      {
        name: "contribuyente",
        label: "Contribuyente",
        type: "text",
        required: true,
      },
      {
        name: "proyecto",
        label: "Nombre del proyecto",
        type: "text",
        required: true,
      },
      {
        name: "valor",
        label: "Valor aprobado (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "asistencia-humanitaria",
    name: "Asistencia Humanitaria",
    shortName: "Asist. hum.",
    description: "Entrega de ayudas humanitarias a población afectada.",
    icon: "heart-handshake",
    unit: "kits",
    valueLabel: "Kits entregados",
    extraFields: [
      {
        name: "tipo_ayuda",
        label: "Tipo de ayuda",
        type: "select",
        required: true,
        options: [
          "Kit de cocina",
          "Kit de aseo",
          "Kit de hábitat",
          "Alimento",
          "Frazada",
        ],
      },
      {
        name: "cantidad",
        label: "Cantidad",
        type: "number",
        required: true,
      },
      {
        name: "familias",
        label: "Familias beneficiadas",
        type: "number",
        required: true,
      },
      {
        name: "valor",
        label: "Valor (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "gestion-de-servicios",
    name: "Gestión de Servicios",
    shortName: "Servicios",
    description: "Solicitudes y gestión de servicios institucionales.",
    icon: "briefcase",
    unit: "solicitudes",
    valueLabel: "Solicitudes",
    extraFields: [
      {
        name: "servicio",
        label: "Servicio",
        type: "select",
        required: true,
        options: [
          "Asesoría técnica",
          "Logística",
          "Transporte",
          "Almacenamiento",
          "Otro",
        ],
      },
      {
        name: "solicitante",
        label: "Solicitante",
        type: "text",
        required: true,
      },
      {
        name: "valor",
        label: "Costo estimado (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "subsidios-de-arriendos",
    name: "Subsidios de Arriendos",
    shortName: "Arriendos",
    description: "Apoyo de arriendo temporal a hogares damnificados.",
    icon: "home",
    unit: "hogares",
    valueLabel: "Hogares",
    extraFields: [
      {
        name: "documento",
        label: "Documento beneficiario",
        type: "text",
        required: true,
      },
      {
        name: "meses",
        label: "Meses cubiertos",
        type: "number",
        required: true,
      },
      {
        name: "valor",
        label: "Valor mensual (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "alertas-tempranas",
    name: "Alertas tempranas",
    shortName: "Alertas",
    description: "Monitoreo y emisión de alertas tempranas territoriales.",
    icon: "bell-ring",
    unit: "alertas",
    valueLabel: "Alertas",
    extraFields: [
      {
        name: "nivel",
        label: "Nivel",
        type: "select",
        required: true,
        options: ["Amarilla", "Naranja", "Roja"],
      },
      {
        name: "amenaza",
        label: "Amenaza",
        type: "select",
        required: true,
        options: ["Inundación", "Deslizamiento", "Incendio", "Sismo", "Otro"],
      },
      {
        name: "poblacion_expuesta",
        label: "Población expuesta",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "asistencia-tecnica",
    name: "Asistencia técnica",
    shortName: "Asist. téc.",
    description: "Acompañamiento técnico a entidades territoriales.",
    icon: "wrench",
    unit: "asistencias",
    valueLabel: "Asistencias",
    extraFields: [
      {
        name: "entidad",
        label: "Entidad",
        type: "text",
        required: true,
      },
      {
        name: "tema_asistencia",
        label: "Tema",
        type: "text",
        required: true,
      },
      {
        name: "horas",
        label: "Horas",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "equipo-de-respuesta",
    name: "Equipo de respuesta",
    shortName: "Respuesta",
    description: "Despliegue y operación de equipos de respuesta inmediata.",
    icon: "users",
    unit: "misiones",
    valueLabel: "Misiones",
    extraFields: [
      {
        name: "equipo",
        label: "Equipo",
        type: "select",
        required: true,
        options: ["USAR", "Forestal", "Médico", "Logístico", "Evaluación"],
      },
      {
        name: "personas",
        label: "Integrantes",
        type: "number",
        required: true,
      },
      {
        name: "dias",
        label: "Días en terreno",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "compra-de-materiales",
    name: "Compra de materiales",
    shortName: "Compra mat.",
    description: "Adquisición de materiales para respuesta y recuperación.",
    icon: "shopping-cart",
    unit: "órdenes",
    valueLabel: "Órdenes",
    extraFields: [
      {
        name: "material",
        label: "Material",
        type: "text",
        required: true,
      },
      {
        name: "cantidad",
        label: "Cantidad",
        type: "number",
        required: true,
      },
      {
        name: "proveedor",
        label: "Proveedor",
        type: "text",
        required: true,
      },
      {
        name: "valor",
        label: "Valor (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "fic",
    name: "FIC",
    shortName: "FIC",
    description: "Fondo de Inversión para la Construcción — seguimiento de recursos.",
    icon: "building-2",
    unit: "proyectos",
    valueLabel: "Proyectos FIC",
    extraFields: [
      {
        name: "codigo_fic",
        label: "Código FIC",
        type: "text",
        required: true,
      },
      {
        name: "proyecto",
        label: "Proyecto",
        type: "text",
        required: true,
      },
      {
        name: "valor",
        label: "Valor (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "convenios",
    name: "Convenios",
    shortName: "Convenios",
    description: "Convenios interadministrativos y de cooperación.",
    icon: "file-signature",
    unit: "convenios",
    valueLabel: "Convenios",
    extraFields: [
      {
        name: "numero",
        label: "Número de convenio",
        type: "text",
        required: true,
      },
      {
        name: "contraparte",
        label: "Contraparte",
        type: "text",
        required: true,
      },
      {
        name: "objeto",
        label: "Objeto",
        type: "textarea",
        required: true,
      },
      {
        name: "valor",
        label: "Valor (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "presupuesto",
    name: "Presupuesto",
    shortName: "Presupuesto",
    description: "Asignación y programación presupuestal por rubro.",
    icon: "wallet",
    unit: "millones",
    valueLabel: "Presupuesto (COP)",
    extraFields: [
      {
        name: "rubro",
        label: "Rubro",
        type: "text",
        required: true,
      },
      {
        name: "vigencia",
        label: "Vigencia",
        type: "select",
        required: true,
        options: ["2024", "2025", "2026"],
      },
      {
        name: "valor",
        label: "Valor asignado (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "ejecucion-financiera",
    name: "Ejecución financiera",
    shortName: "Ejecución",
    description: "Seguimiento de compromisos, obligaciones y pagos.",
    icon: "line-chart",
    unit: "COP",
    valueLabel: "Ejecutado (COP)",
    extraFields: [
      {
        name: "rubro",
        label: "Rubro",
        type: "text",
        required: true,
      },
      {
        name: "comprometido",
        label: "Comprometido (COP)",
        type: "number",
        required: true,
      },
      {
        name: "pagado",
        label: "Pagado (COP)",
        type: "number",
        required: true,
      },
      {
        name: "valor",
        label: "Obligado (COP)",
        type: "number",
        required: true,
      },
    ],
  }),
  theme({
    id: "materiales",
    name: "Materiales",
    shortName: "Materiales",
    description: "Inventario y movimiento de materiales de respuesta.",
    icon: "package",
    unit: "unidades",
    valueLabel: "Unidades",
    extraFields: [
      {
        name: "item",
        label: "Ítem",
        type: "text",
        required: true,
      },
      {
        name: "cantidad",
        label: "Cantidad",
        type: "number",
        required: true,
      },
      {
        name: "bodega",
        label: "Bodega / almacén",
        type: "text",
        required: true,
      },
      {
        name: "movimiento",
        label: "Movimiento",
        type: "select",
        required: true,
        options: ["Entrada", "Salida", "Traslado"],
      },
    ],
  }),
  theme({
    id: "declaratoria-de-emergencia",
    name: "Declaratoria de emergencia",
    shortName: "Declaratoria",
    description: "Registro y seguimiento de declaratorias de calamidad y emergencia.",
    icon: "siren",
    unit: "declaratorias",
    valueLabel: "Declaratorias",
    extraFields: [
      {
        name: "tipo",
        label: "Tipo",
        type: "select",
        required: true,
        options: [
          "Calamidad pública",
          "Emergencia",
          "Desastre",
          "Alerta máxima",
        ],
      },
      {
        name: "acto_administrativo",
        label: "Acto administrativo",
        type: "text",
        required: true,
      },
      {
        name: "poblacion_afectada",
        label: "Población afectada",
        type: "number",
        required: true,
      },
    ],
  }),
];

export function getTheme(id: string): ThemeConfig | undefined {
  return THEMES.find((t) => t.id === id);
}
