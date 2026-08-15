# Tema: Banco de Maquinaria

| | |
|---|---|
| **ID / slug** | `banco-de-maquinaria` |
| **Ruta** | `/app/temas/banco-de-maquinaria` |
| **Carpeta** | `src/themes/banco-de-maquinaria/` |
| **schemaVersion** | 6 |

## Modelo (como Puentes)

Todo nace del **convenio o proceso** (`CONTRATO DE ADQUISICIÓN O CONVENIO`).  
Cada convenio adquiere varias máquinas en **Detalle maquinaria**.

| Orden | Capa | Hoja | Llave | Modo |
|------:|------|------|-------|------|
| 1 | Convenio o proceso | `CONVENIOS O PROCESOS` | `no_convenio` | Alta única |
| 2 | Maqueta / inventario | `DETALLE MAQUINARIA` | `serial` | Alta por equipo (lookup convenio) |
| 3 | Bitácora convenio | `BITACORA CONVENIOS` | `no_convenio` | Append |

## Sync

1. **Bitácora** → último `estado` (+ comentario) del convenio y `estado_convenio` en equipos. Departamento/municipio se heredan del convenio y no se pisan.

## Archivos

- `theme.ts` · `fields-from-source.ts` · `capture-forms.ts`
- `maqueta-mutable.ts` · `maqueta-sync.ts` · `select-options.ts`

## Importar

```bash
npx tsx scripts/import-source-file.ts banco-de-maquinaria "~/Downloads/Banco de Maquinaria.xlsx" "CONVENIOS"
npx tsx scripts/import-source-file.ts banco-de-maquinaria "~/Downloads/Banco de Maquinaria.xlsx" "DETALLE"
npx tsx scripts/import-source-file.ts banco-de-maquinaria "~/Downloads/Banco de Maquinaria.xlsx" "BITACORA"
npx tsx scripts/import-source-file.ts banco-de-maquinaria "~/Downloads/Banco de Maquinaria.xlsx" "ENTREGA"
```
