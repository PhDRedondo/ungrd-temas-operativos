/** Línea presupuestal del seguimiento → modalidad de la tabla Todo Manejo. */
const REGLAS: { test: RegExp; modalidad: string }[] = [
  { test: /MAQUINARIA|BANCO/, modalidad: "orden de proveeduría" },
  { test: /CONVENIO/, modalidad: "convenio" },
  { test: /FIC|FONDO DE INVERSION|INVERSION COLECTIVA/, modalidad: "transferencia" },
  { test: /OBRA|REFUGIO|CONTRATO/, modalidad: "contrato" },
  { test: /AYUDA HUMANITARIA|\bAHE\b|OLLA|INCENDIO|LOGIST|CANASTA/, modalidad: "orden de proveeduría" },
  { test: /ARRIENDO/, modalidad: "subsidio" },
  { test: /AGUA|CARROTANQUE|SANEAMIENTO/, modalidad: "agua" },
  { test: /SEGURO/, modalidad: "seguro" },
  { test: /HONORARIO/, modalidad: "honorarios" },
  { test: /VEHICULO/, modalidad: "vehículo" },
];

export function modalidadDeLinea(linea: unknown): string {
  const t = String(linea ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (!t.trim()) return "";
  return REGLAS.find((r) => r.test.test(t))?.modalidad ?? "";
}
