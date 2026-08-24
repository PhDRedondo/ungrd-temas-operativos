# Tema: Obras de Emergencia

| | |
|---|---|
| **ID / slug** | `obras-de-emergencia` |
| **Ruta** | `/app/temas/obras-de-emergencia` |
| **Carpeta** | `src/themes/obras-de-emergencia/` |

## Capas (Postgres / Supabase)

- **Contrato de obra** — convenio, contratista, valor, avances, fechas.
- **Orden de proveeduría** — O.P. maquinaria / horas máquina.

Clave de seguimiento: `contrato_de_obra` o `orden_de_proveeduria` → `clave_seguimiento`.

## Captura (formularios)

| Formulario | Modo | Qué hace |
|------------|------|----------|
| 1 · Contrato de obra | upsert | Alta/actualiza contrato (campos del tablero SMD) |
| 2 · Orden de proveeduría | upsert | Alta/actualiza O.P. |
| 3 · Seguimiento de avances | upsert + lookup | Actualiza estado/avances de un contrato existente |

Excel oficial (`fields-from-source.ts`) **no se reduce**: los forms solo exponen el subconjunto operativo.

## Indicadores (SPI / CPI / IRP)

`calculations.ts` — motor por contrato.  
`dashboard.ts` — KPIs ejecutivos del zip SMD (valor, en ejecución, urgentes, IRP, SPI, avance ponderado).  
Usados en el tablero de decisión (`buildObrasEmergencia`).

## Archivos

- `theme.ts` — config + `captureForms` + estado como select.
- `capture-forms.ts` — formularios por capa.
- `calculations.ts` — SPI / CPI / IRP / alerta plazo.
- `select-options.ts` — estados canónicos + alias.
- `fields-from-source.ts` — schema Excel (no editar a mano).

## Trabajo autónomo

Edite **solo** esta carpeta salvo toques mínimos de núcleo ya hechos (lookup/capa/decisión) para que la captura funcione.
