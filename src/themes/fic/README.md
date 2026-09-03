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

Una por vigencia (`Transferencia FIC 2014` … `2026`). Clave de seguimiento: **No. CDP**.

La capa se deriva de la **vigencia** al guardar (`prepareTrackingRow`); no hace falta elegirla a mano.

## Formularios de captura

1. **Transferencia FIC** — alta/upsert (CDP, acto, desembolso, legalización).
2. **Seguimiento legalización** — lookup por CDP; patch de estado/valores/%.
3. **Modificación / prórroga** — lookup por CDP; acto y plazo de prórroga.

Excel `fields-from-source.ts` intacto. Campos AppSheet sin columna Excel (`aplica_entidad_receptora`, `fecha_cdp`, `fecha_rc`, bitácora/expedientes) quedan fuera de esta entrega.

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

- `theme.ts` — configuración + `captureForms` + selects (estado, vigencia).
- `capture-forms.ts` — formularios y variantes de capa para lookup.
- `select-options.ts` — estados de legalización canónicos.
- `fields-from-source.ts` — campos generados desde el Excel (no editar a mano).
- `index.ts` — reexporta el módulo.
