# Tema: Obras por impuestos

| | |
|---|---|
| **ID / slug** | `obras-por-impuestos` |
| **Ruta** | `/app/temas/obras-por-impuestos` |
| **Carpeta** | `src/themes/obras-por-impuestos/` |

## Capas (Postgres / Supabase)

- **Convenio obra por impuesto** — una sola capa (BPIN / Nº convenio).

Clave: `no_convenio` → `clave_seguimiento`.

## Captura

| Formulario | Modo | Qué hace |
|------------|------|----------|
| 1 · Convenio | upsert | Alta/actualiza convenio (contribuyente, valor, plazos) |
| 2 · Interventoría | upsert + lookup | Datos del convenio de interventoría |
| 3 · Seguimiento | upsert + lookup | Estado y fechas |

Excel ArcGIS (`fields-from-source.ts`) intacto.

## Indicadores

`calculations.ts` — reusa SPI/CPI/IRP de emergencia con fechas de convenio.  
`dashboard.ts` — KPIs (valor, interventoría, vencidos, urgentes, IRP).

## Archivos

- `theme.ts` · `capture-forms.ts` · `select-options.ts`
- `calculations.ts` · `dashboard.ts` · `fields-from-source.ts`
