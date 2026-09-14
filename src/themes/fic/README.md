# Tema: FIC

| | |
|---|---|
| **ID / slug** | `fic` |
| **Ruta** | `/app/temas/fic` |
| **Carpeta** | `src/themes/fic/` |
| **Fuente** | `transferencias_fic.parquet` (AppSheet CONTROL FIC) + Excel histórico `Seguimiento_FIC_2026.xlsx` |
| **Captura** | AppSheet CONTROL FIC (`alimentador.fic_transferencias_Form`) |
| **schemaVersion** | 4 |
| **Import** | `npx tsx scripts/import-fic-xlsx.ts [/ruta/plantilla_fic_v3.xlsx]` · parquet: `import-fic-parquet.ts` |

## Capas

Una por vigencia (`Transferencia FIC 2014` … `2026`). Clave de seguimiento: **número FIC** (columna AppSheet `numero_cdp` / campo `no_cdp`; `id_transferencia` desambigua duplicados).

La capa se deriva de la **vigencia** al guardar (`prepareTrackingRow`); no hace falta elegirla a mano.

## Formularios de captura

1. **Transferencia FIC** — alta del FIC (formato de aprobación, actos 1 y 2, valor/fecha desembolso, plazos).
2. **Seguimiento legalización** — estado/valores; el visor usa la **fecha final** (con prórroga si hubo).
3. **Modificación / prórroga** — acto de prórroga + fecha acto administrativo modificación; recalcula plazo/fecha final.

### Plazos y fechas (misma fila / tabla principal)

| Campo | Rol |
|-------|-----|
| `plazo_ejecucion_dias` | Plazo **inicial** (no se pierde con la prórroga) |
| `plazo_adicion_dias` | Días de **prórroga** |
| `plazo_final_dias` | Inicial + adición (calculado) |
| `fecha_inicial_para_legalizacion` | Fecha **inicial** |
| `fecha_final_para_legalizacion` | Fecha **final** = inicial + plazo final (calculado; lo usa el visor/decisión) |
| `fecha_actual` | Fecha de hoy (se graba al guardar/importar; comparación vs fecha final en el visor) |
| `fecha_de_legalizacion_por_prorroga` | Igual a la fecha final cuando hay adición (columna Excel) |

Ejemplo: inicial 180 días + prórroga 30 → plazo final 210; la fecha final corre 210 días desde la fecha inicial.

El KPI **Vencidos** del tablero es la columna **estado de legalización** (`VENCIDO`), el mismo filtro que en Excel. No se infiere por `fecha_final_para_legalizacion`.

El **% de avance** = `(desembolso − por legalizar) / desembolso × 100`.

Excel `fields-from-source.ts` intacto. Campos de plantilla v3 (`formato_de_aprobacion`, acto/fecha 2, `fecha_acto_administrativo_modificacion`, valor/fecha desembolso, anticipo) viven en `theme.ts` + `excel-aliases.ts`. Bitácora/expedientes quedan fuera de esta entrega.

## Plantilla Excel v3 (carga)

Cabeceras de `plantilla_fic_v3.xlsx` (hoja `FIC`) que se mapean al tema:

| Columna plantilla | Campo |
|---|---|
| `#formato de aprobacion` | `formato_de_aprobacion_de_la_atencion` |
| `acto_administrativo_otorgamiento_del_recurso -2` | `acto_administrativo_otorgamiento_del_recurso_2` |
| `fecha_acto_administrativo_resolucion-2` | `fecha_acto_administrativo_resolucion_2` |
| `valor desembolso` | `valor` |
| `fecha de desembolso` | `fecha` |
| `fecha acto administrativo modificacion` | `fecha_acto_administrativo_modificacion` |

## Regenerar campos

```bash
node scripts/generate-theme-fields.cjs
```

## Importar datos

```bash
npx tsx scripts/import-source-file.ts fic ~/Downloads/Seguimiento_FIC_2026.xlsx "TRANSFERENCIAS - FIC - 2026"
# o todas las vigencias:
npm run db:reimport
```

## Archivos

- `theme.ts` — configuración + `captureForms` + selects + campos captura-only.
- `capture-forms.ts` — formularios y variantes de capa para lookup.
- `select-options.ts` — estados de legalización canónicos.
- `fields-from-source.ts` — campos generados desde el Excel (no editar a mano).
- `index.ts` — reexporta el módulo.
