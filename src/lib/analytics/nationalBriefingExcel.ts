import * as XLSX from "xlsx";
import type { NationalBrief } from "@/lib/analytics/national";

/** Export Excel del briefing nacional (Director). */
export function downloadNationalBriefingExcel(brief: NationalBrief) {
  const stamp = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();

  const resumen = [
    ["Briefing nacional UNGRD", brief.briefing.headline],
    ["Generado", brief.generatedAt],
    ["Criterios", brief.criteriaVersion],
    ["Registros", brief.totals.records],
    ["Bases con dato", brief.totals.themesWithData],
    ["Deptos con dato", brief.totals.departamentosConDato],
    ["Dinero en riesgo", brief.briefing.moneyAtRisk],
    ["Declaratorias abiertas", brief.briefing.openDeclaratorias],
    ["Deptos con brecha", brief.briefing.gapMunicipios],
    [],
    ["Puntos clave"],
    ...brief.briefing.bullets.map((b) => [b]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(resumen),
    "Resumen",
  );

  const alertas = [
    ["Severidad", "Título", "Detalle", "Qué hacer", "Conteo", "Valor"],
    ...brief.alerts.map((a) => [
      a.severity,
      a.title,
      a.detail,
      a.action || "",
      a.count ?? "",
      a.valor ?? "",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(alertas),
    "Alertas",
  );

  const deptos = [
    [
      "Departamento",
      "Presión",
      "Declaratoria abierta",
      "Intervenciones",
      "Valor total",
      "Brecha respuesta",
    ],
    ...brief.priorityDepts.map((d) => [
      d.departamento,
      d.pressure,
      d.declaratoriaAbierta,
      d.intervenciones,
      d.valorTotal,
      d.gapRespuesta ? "Sí" : "No",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(deptos),
    "Top deptos",
  );

  const claves = [
    ["Tema", "Clave", "Etiqueta", "Extra", "Valor", "Href"],
    ...brief.priorityKeys.map((k) => [
      k.themeId,
      k.key,
      k.label,
      k.extra || "",
      k.valor,
      k.href,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(claves),
    "Claves",
  );

  XLSX.writeFile(wb, `briefing_mando_nacional_${stamp}.xlsx`);
}
