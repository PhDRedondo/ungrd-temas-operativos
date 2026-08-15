# Tema: Puentes

| | |
|---|---|
| **ID / slug** | `puentes` |
| **Ruta** | `/app/temas/puentes` |
| **Carpeta** | `src/themes/puentes/` |
| **schemaVersion** | 5 (multi-capa + convenio en bitácora) |
| **Excel fuente** | `puentes 2.xlsx` |

## Modelo operativo

Tres capas en PostgreSQL, en **orden de alimentación**: el proceso nace primero,
de él nacen los puentes y de cada puente sus eventos.

| # | Capa | Modo captura | Llave | Requisito previo |
|---|------|--------------|-------|------------------|
| 1 | **Contrato estructuración** | Append por etapa | `clave_proceso` (1 proceso : N puentes) | Ninguno: **aquí nace el proceso** |
| 2 | **Inventario puente** | Alta única (`create-once`) | `id_puente` → `clave_seguimiento` | Proceso estructurado (`ProcesoLookup` obligatorio) |
| 3 | **Bitácora estado** | Append por evento | Lookup por puente (`id_puente`) + `convenio_o_cto` | Puente en inventario (`PuenteLookup`) |

### JOIN map (schema `puentes` — medallón)

Tablas: `puentes.contratos_estructuracion` · `puentes.base_general_puentes` · `puentes.bitacora`.

| Relación | Llave | Notas |
|----------|-------|-------|
| bitácora ↔ inventario | `id_puente` | Alt: `codigo_operativo` (ID UNICO) |
| inventario ↔ estructuración | `clave_proceso` | Alt: `contrato_convenio` / `convenio_o_cto` |
| bitácora ↔ estructuración | `clave_proceso` | Alt: `convenio_o_cto` (columna Excel «convenio o cto») |

La bitácora **siempre** lleva `convenio_o_cto` (Excel) y hereda `contrato_convenio` /
`clave_proceso` del puente. No se cruza con schema `agua`.

### El contrato tiene un único punto de entrada

`contrato_convenio` **solo se escribe en la capa 1**, que es la única con
`lookupCanCreate`: si el contrato o la donación no existe todavía, el operador lo
escribe en el buscador y lo usa como proceso nuevo (`clave_proceso` y
`tipo_vinculo` se calculan solos). Si ya existe, lo selecciona y suma etapa al
mismo expediente.

En Inventario y Bitácora el contrato **nunca es capturable**: llega heredado y
actúa como **filtro raíz**. La regla se aplica en tres frentes, no solo en la UI:

| Frente | Comportamiento |
|--------|----------------|
| Captura | `HIDDEN_AFTER_PROCESO_LOOKUP` oculta `contrato_convenio`, `clave_proceso` y `tipo_vinculo`; al guardar bitácora esas llaves se toman del puente |
| API (`POST`/`PATCH` de records) | `proceso-chain.ts` rechaza inventario con contrato inexistente, fuerza en bitácora el contrato del puente y descarta ediciones del contrato fuera de Estructuración |
| Import | `capa-inference.ts` descarta el contrato que traiga la hoja de bitácora; el reimport lo reinyecta desde el inventario |

`searchThemeProcesos` toma los procesos de la capa Estructuración; los que solo
aparecen referenciados desde el inventario se marcan **sin etapas** para que se
completen.

### Filtros del lookup: el contrato es la base

`PuenteLookup` filtra en jerarquía, no en paralelo. `FACET_LEVEL` en
`src/lib/records/puente-lookup.ts` define los niveles:

```
0 · contrato / proceso  →  1 · origen  →  2 · departamento  →  3 · municipio
                        →  4 · tipo    →  5 · configuración →  6 · ubicación
```

Cada faceta se calcula aplicando **solo** los filtros de nivel superior, de modo
que los conteos corresponden al subconjunto real; al cambiar un nivel se
reinician los de abajo. `lookupFilterFields` en `capture-forms.ts` declara ese
mismo orden.

### Llaves por nivel

| Nivel | Llave | Cardinalidad | Se captura |
|-------|-------|--------------|------------|
| **Proceso** | `clave_proceso` + `proceso_sigla` + `origen_adquisicion` | 1 proceso : N puentes | Derivada de `contrato_convenio` |
| **Activo** | `id_puente` (canónica) + `codigo_operativo` (alias legible) | 1 : 1 puente | `id_puente` manual; código derivado |
| **Evento** | `records.id` (UUID) + `fecha_inicio` | N eventos : 1 puente | Append en bitácora |

- **`id_puente`** (etiqueta UI: **ID**) es la llave corta del activo (columna Excel `ID`). Una fila de inventario por puente.
- **`codigo_operativo`** (etiqueta UI: **ID UNICO**) corresponde a la última columna Excel `ID UNICO`; también puede derivarse como `proceso_sigla` + número de unidad (`DON-EEUU-03`). Nunca se escribe a mano: lo calcula `asset-keys.ts` o llega del import.
- **`origen_adquisicion`**: `donacion_eeuu` | `donacion_otra` | `contrato_nacional` | `sin_definir`. Permite filtrar sin parsear el texto legal.
- **`clave_proceso`** derivada de `contrato_convenio` + `tipo_vinculo`. Muchos puentes comparten contrato; la estructuración **no** se duplica por puente.

Ejemplo: los 10 puentes ACROW de la donación EEUU comparten un solo proceso (`DON-EEUU`) y se distinguen por `DON-EEUU-01` … `DON-EEUU-10` (id_puente 18 … 27).

Tras guardar bitácora, `puente-sync.ts` actualiza el inventario con ubicación, estado y préstamo vigentes.

### Backfill de llaves derivadas

```bash
npx tsx scripts/backfill-puentes-llaves.ts           # dry-run
npx tsx scripts/backfill-puentes-llaves.ts --apply   # escribe con versionado
```

No crea ni borra registros: solo calcula `codigo_operativo`, `numero_unidad`, `proceso_sigla` y `origen_adquisicion` sobre lo existente.

## Hojas Excel (`puentes 2.xlsx`)

| Hoja | Capa destino |
|------|--------------|
| Base General Puentes | Inventario puente |
| bitacora | Bitácora estado |
| Contratos Estructuracion | Contrato estructuración |

## Archivos del tema

| Archivo | Rol |
|---------|-----|
| `theme.ts` | Registro del tema + `captureForms` |
| `fields-from-source.ts` | Campos alineados al Excel |
| `capture-forms.ts` | Formularios por capa + lookups |
| `process-keys.ts` | `tipo_vinculo`, `clave_proceso` |
| `proceso-chain.ts` | Regla servidor: contrato solo nace en Estructuración; bitácora hereda del puente |
| `proceso-seed.ts` | Etapa raíz para procesos que solo venían del inventario |
| `asset-keys.ts` | `codigo_operativo`, `numero_unidad`, `proceso_sigla`, `origen_adquisicion`, alias de búsqueda |
| `select-options.ts` | Listas (estado, préstamo, etapa…) |
| `puente-sync.ts` | Sync inventario ← última bitácora |

## Captura en UI

1. **Estructuración del proceso** — el **contrato se registra una vez**. Al hacer clic en el campo se despliega la lista de contratos de la base (nadie los memoriza); se puede filtrar escribiendo. Si ya existe, **solo se modifican etapa y estado**.
2. **Alta / inventario del puente** — exige seleccionar el proceso; hereda `contrato_convenio`, `clave_proceso`, `tipo_vinculo` y la descripción del proceso (campos ocultos, no se reescriben). Luego se captura el activo con su `id_puente`; el `codigo_operativo` se calcula.
3. **Bitácora del puente** — `PuenteLookup`: filtros en cascada origen → proceso → departamento → municipio → contrato → tipo → configuración → ubicación; listas pobladas con valores reales del inventario y conteos. Búsqueda rápida acepta `DON-EEUU-03`, `EEUU 3`, `20` o un lugar. Historial append debajo.

## Import / reimport

```bash
npx tsx scripts/reimport-puentes.ts
npx tsx scripts/reimport-puentes.ts "$HOME/Downloads/puentes 2.xlsx"
npx tsx scripts/reimport-puentes.ts "$HOME/Downloads/puentes 2.xlsx" --seed-procesos
```

Orden: soft-delete previo → **Estructuración** → Inventario (reporta puentes cuyo
proceso no está estructurado) → Bitácora (geo heredada) → sync inventario.

`--seed-procesos` crea la etapa raíz de los procesos que solo venían referenciados
desde el inventario, para que ningún puente quede sin proceso de origen.

También incluido al final de `scripts/prep-reimport-all.ts`.

### Sembrar raíces sobre datos ya cargados

```bash
npx tsx scripts/seed-procesos-estructuracion.ts           # dry-run
npx tsx scripts/seed-procesos-estructuracion.ts --apply   # crea etapa raíz
```

No inventa procesos: usa el `contrato_convenio` que ya está en el inventario.
La etapa creada queda marcada como `Registro inicial desde inventario` con estado
`Pendiente estructuración documental`, para completarla luego con el expediente real.

## Verificación

```bash
npx tsx scripts/demo-puentes-orden.ts        # solo lectura: proceso → puentes → eventos
```

- Ruta: `/app/temas/puentes`
- Estado actual: 3 procesos con raíz · 28 puentes · 35 eventos.
- Contrato **9677-CV020-875-2023**: 17 puentes, 21 eventos.
- Donación EEUU: 10 puentes (`DON-EEUU-01` … `DON-EEUU-10`), 12 eventos.
- Puente **28** sigue sin contrato en inventario: no se puede vincular a un proceso hasta corregir el dato en la fuente.

## Trabajo autónomo

1. Rama: `feat/puentes-descripcion`
2. Edite **solo** `src/themes/puentes/` salvo cambio explícito de núcleo.
3. PR enfocado a este tema.
