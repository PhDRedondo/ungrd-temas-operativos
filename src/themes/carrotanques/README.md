# Tema: Carrotanques

| | |
|---|---|
| **ID / slug** | `carrotanques` |
| **Ruta** | `/app/temas/carrotanques` |
| **Carpeta** | `src/themes/carrotanques/` |
| **schemaVersion** | 5 |

## Llave y capas

- **Llave:** `placa` → `clave_seguimiento`
- **Capas:** Maqueta / inventario · Bitácora estado · Suministro / viajes
- **Geo:** departamento / municipio / región se capturan en **Bitácora** (DIVIPOLA + lista Región) y el sync los copia a la maqueta (M–P).

## Lógica de maqueta (columnas Excel)

| Columnas | Origen | Comportamiento |
|----------|--------|----------------|
| **B–J** | Alta maqueta | Ingreso inicial: placa, placa UNGRD, clase, marca, modelo-REF, serial, modelo, año, capacidad. **No cambian** tras el alta. |
| **K, L** | Actualizar categorías | Otras categorizaciones y clasificación propiedad: **editables sobre la misma fila** (formulario 2 · upsert + PATCH versionado). |
| **M–P** | Bitácora (último) | Ubicación actual, departamento, municipio, región |
| **Q–R–S** | Suma suministro | Acumulado de **todos** los registros de suministro de esa placa (`lt_suministrados`, `per_benef`, `com_benef`) |
| **T–Z** | Bitácora (último) | Fechas inicio/fin/desde, entidad, estado, situación, observaciones |

## Suministro (formulario 4)

Campos: galones, capacidad litros, ente/sitio, región, depto, municipio, litros / personas / comunidades, fecha corte, observaciones. **Sin marca** (viene de la maqueta vía placa).

## Archivos

| Archivo | Rol |
|---------|-----|
| `theme.ts` | Registro + `captureForms` |
| `fields-from-source.ts` | Campos (schema v5) |
| `capture-forms.ts` | Formularios 1–4 |
| `maqueta-sync.ts` | Sync maqueta ← bitácora + suma suministro |
| `select-options.ts` | Listas dominio (estado, préstamo, región, propiedad) |

## Flujo operativo

1. **Alta maqueta (B–J)** — `create-once` por placa.
2. **Actualizar K–L** — upsert sobre la maqueta (lookup por placa).
3. **Bitácora** — append; al guardar, sync actualiza M–P y T–Z.
4. **Suministro** — append; al guardar, sync recalcula Q–R–S.

## Fuentes Excel

- Maqueta: `Copia de maqueta carrotanques.xlsx` → hoja `MAQUETA`
- Bitácora + suministro: `Copia de Bitacora Carrotanques.xlsx` → `Bitacora`, `SUMINISTRO DEF`

## No modificar (núcleo)

Shell, analítica y APIs compartidas: solo se engancha el sync en `records` / `uploads` (igual que Agua y Puentes).
