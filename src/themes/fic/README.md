# Tema: FIC

| | |
|---|---|
| **ID / slug** | `fic` |
| **Ruta** | `/app/temas/fic` |
| **Carpeta** | `src/themes/fic/` |
| **Fuente** | `Seguimiento_FIC_2026.xlsx` (FR-1703-SMD-44) |
| **Captura** | AppSheet CONTROL FIC (`alimentador.fic_transferencias_Form`) |
| **schemaVersion** | 3 |

## Capas

Una por vigencia (`Transferencia FIC 2014` … `2026`). Clave de seguimiento: **número FIC** (columna Excel `No. CDP` / campo `no_cdp`).

La capa se deriva de la **vigencia** al guardar (`prepareTrackingRow`); no hace falta elegirla a mano.

## Formularios de captura

1. **Transferencia FIC** — alta del FIC (plazo inicial + fecha inicial de legalización).
2. **Seguimiento legalización** — estado/valores; el visor usa la **fecha final** (con prórroga si hubo).
3. **Modificación / prórroga** — conserva plazo/fecha inicial; suma adición y recalcula plazo/fecha final.

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

El **% de avance** = `(desembolso − por legalizar) / desembolso × 100`.

Excel `fields-from-source.ts` intacto. `fecha_cdp` / `fecha_rc` / `plazo_final_dias` / `fecha_final_para_legalizacion` se agregan en `theme.ts` solo para captura. Bitácora/expedientes quedan fuera de esta entrega.

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
