# Tema: Ejecución financiera

| | |
|---|---|
| **ID / slug** | `ejecucion-financiera` |
| **Ruta** | `/app/temas/ejecucion-financiera` |
| **Carpeta** | `src/themes/ejecucion-financiera/` |

## Qué hace

Carga el reporte Fidusap **tal como sale** (sin plantilla ni Captura). En cada subida:

1. Prefiere la pestaña **SMD**. Si no existe, lee `cdextendido` / CDP extendido.
2. En CDP extendido **ignora las filas 1–5** de título (FIDUPREVISORA, Informe, Fecha, Hora) y toma el encabezado **No CDP**.
3. Filtra Área ejecutora = SMD o **W · Área solicitante** = Manejo de Desastres.
4. Transforma cada fila a las columnas de la hoja SMD. Si no viene GRUPO, lo infiere.
5. Marca el **corte** con el nombre del archivo. Reemplaza el corte anterior (upsert por No. CDP).
6. El **Dashboard** replica Control y seguimiento **por línea**: CDP, compromiso, saldo (CDP − RC), pagado y por pagar. Apropiación y disponible salen del formulario de cupo del corte, no de un catálogo SIIF.

Pestañas: **Cargar Excel**, **Registros** (grilla SMD), **Dashboard operativo**, **QuickBI**.

## Archivos

- `theme.ts` — config, `workspaceTabs`.
- `fields.ts` — columnas SMD (schema v5).
- `fidusap.ts` — parseo (pestaña SMD o CDP extendido), grupo, fechas/montos.
- `corte-cupo.ts` — cupo COP por línea ligado al corte del Excel.
- `dashboard.ts` — Control y seguimiento por línea + KPIs operativos.
- `README.md` — esta guía.

## No modificar (núcleo compartido)

El parseo se engancha en `src/app/api/themes/[slug]/uploads/route.ts`. El tablero vive en `SmdControlDashboard` + `AnalyticsPanel` porque el layout FNGRD no cabe en la plantilla genérica.
