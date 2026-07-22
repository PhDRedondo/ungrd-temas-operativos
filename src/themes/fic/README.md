# Tema: FIC

| | |
|---|---|
| **ID / slug** | `fic` |
| **Ruta** | `/app/temas/fic` |
| **Carpeta** | `src/themes/fic/` |
| **Fuente** | `Seguimiento_FIC_2026.xlsx` (FR-1703-SMD-44) |
| **schemaVersion** | 3 |

## Capas

Una por vigencia (`Transferencia FIC 2014` … `2026`). Clave de seguimiento: **No. CDP**.

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

- `theme.ts` — configuración del tema.
- `fields-from-source.ts` — campos generados desde el Excel (no editar a mano).
- `index.ts` — reexporta el módulo.
