"use client";

import { driver } from "driver.js";

export function startGuidedTour() {
  const d = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    popoverClass: "ungrd-tour-popover",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    steps: [
      {
        element: "#tour-sidebar",
        popover: {
          title: "Navegación lateral",
          description:
            "Desde aquí accede a los temas operativos, la plantilla de referencia, la visita guiada y la sección Acerca de.",
          side: "right",
        },
      },
      {
        element: "#tour-temas",
        popover: {
          title: "Temas",
          description:
            "Cada tema abre captura de datos y analítica. Seleccione cualquiera para comenzar.",
          side: "right",
        },
      },
      {
        element: "#tour-visita",
        popover: {
          title: "Visita guiada",
          description:
            "Puede relanzar este recorrido en cualquier momento desde este botón.",
          side: "right",
        },
      },
      {
        element: "#tour-acerca",
        popover: {
          title: "Acerca de",
          description:
            "Consulta el propósito de la plataforma, alcance y notas de la versión demo.",
          side: "right",
        },
      },
      {
        element: "#tour-tabs",
        popover: {
          title: "Captura, descriptiva y avanzado",
          description:
            "Tres pestañas por tema: captura de datos, analítica descriptiva (filtros, mapa y gráficos) y análisis avanzado (redes complejas y métricas).",
          side: "bottom",
        },
      },
    ],
  });
  d.drive();
}
