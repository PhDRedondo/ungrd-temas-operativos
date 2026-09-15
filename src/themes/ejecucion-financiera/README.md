# Tema: Ejecución financiera

| | |
|---|---|
| **ID / slug** | `ejecucion-financiera` |
| **Ruta** | `/app/temas/ejecucion-financiera` |
| **Carpeta** | `src/themes/ejecucion-financiera/` |

## Qué hace

Carga el reporte Fidusap **tal como sale**. En cada subida:

1. Prefiere la pestaña **SMD** (~834 CDP, con GRUPO y filas SDG). Si no existe, lee `cdextendido` / CDP extendido.
2. En CDP extendido filtra Área ejecutora = SMD o **W · Área solicitante** = Manejo de Desastres.
3. Conserva las columnas SMD y usa **GRUPO** del Excel (si falta, lo infiere: honorarios, maquinaria, FIC, AHE…).
4. Reemplaza el corte anterior (upsert por No. CDP + archivo de lo que ya no viene).

Pestañas del workspace: **Cargar Excel**, **Dashboard operativo**, **QuickBI**.

## Archivos

- `theme.ts` — config, `workspaceTabs`.
- `fields.ts` — columnas SMD (schema v5).
- `fidusap.ts` — parseo (pestaña SMD o CDP extendido), grupo, fechas/montos.
- `dashboard.ts` — KPIs, semáforo y tabla operativa.
- `README.md` — esta guía.

## No modificar (núcleo compartido)

El parseo se engancha en `src/app/api/themes/[slug]/uploads/route.ts` y el tablero en `DecisionDashboard` / `AnalyticsPanel` porque la carga Fidusap no cabe en la plantilla genérica.
