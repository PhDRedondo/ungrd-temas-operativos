# Modelo de datos real: maqueta, bitácora y cruces

Auditoría de las bases ArcGIS / Excel oficiales frente a los temas de la app.
Objetivo: captura fiel, seguimiento temporal y cruce entre módulos **sin romper** el modelo `records` existente.

## Hallazgos corregidos (schemaVersion 3)

| Problema | Impacto | Mejora aplicada |
|----------|---------|-----------------|
| Mezclar maqueta + bitácora sin etiqueta | No se distingue inventario vs evento | Campos `tipo_registro` + `capa` |
| Sin clave de unión | Imposible seguir una OP/placa en el tiempo | `clave_seguimiento` auto-rellenada |
| Agua sin hoja Control / Modificaciones / Pagos | Falta ejecución física y financiera | Incluidas en formulario Agua |
| Carrotanques sin SUMINISTRO DEF | Falta litros/beneficiarios | Incluida |
| `placa` tipada como número | Rompe validación | Placa/serial/OP siempre `text` |
| Analítica solo por depto/estado | No ve capas ni seguimiento | SQL `byTipoRegistro` + `byClaveSeguimiento` |

## Arquitectura lógica (por entidad de negocio)

```text
                    ┌── Maqueta / inventario (foto actual)
ENTIDAD ────────────┼── Bitácora (cambios de estado en el tiempo)
(clave_seguimiento) ├── Control / suministro (métricas físicas)
                    └── Pagos / entregas / convenios (capa contractual)
```

No son “bases distintas” en silos: son **capas del mismo objeto**, unidas por una clave.

## Claves de cruce (canónicas)

| Dominio | Clave | Une |
|---------|-------|-----|
| Agua y saneamiento | `orden_de_proveeduria` | Maqueta General ↔ Control ↔ Modificaciones ↔ Bitácora ↔ Pagos ↔ Obras O.P. |
| Carrotanques | `placa` | Maqueta ↔ Bitácora estado ↔ Suministro |
| Banco maquinaria | `serial` / `no_maquina` / `no_convenio` | Inventario ↔ Convenio ↔ Bitácora ↔ Entrega |
| Obras emergencia | `contrato_de_obra` o `orden_de_proveeduria` | Contrato ↔ O.P. ↔ (futuro) Agua |
| Obras por impuestos | `no_convenio` (BPIN) | Convenio ↔ Interventoría |
| Declaratorias | `no_declaratoria` + DIVIPOLA | Habilita obras en mismo municipio |
| Espacial (todos ArcGIS) | `divipola` / depto+muni / lat-long | Mapa y cruce territorial |

Al importar, `fillFixedAliases` copia la mejor clave disponible a `clave_seguimiento`.

## Capas por tema (estructura real)

### Agua y Saneamiento — 125 campos
| Capa | Fuente | Qué representa |
|------|--------|----------------|
| Maqueta / orden | `General` | OP, proveedor, CDP/RC, estado, tiempos por dependencia |
| Control ejecución física | `control y seguimiento…` | Tanques, carrotanques, vactor, horas máquina **contratadas vs ejecutadas** |
| Modificación contractual | `modificaciones` | Otrosí, prórrogas, valores parciales |
| Bitácora estado | `bitacora` | Timeline: fecha → estado macro → proceso → dependencia |
| Pago / desembolso | `PAGOS` | SD, voucher, valores pagados, saldos |

### Carrotanques — 43 campos
| Capa | Fuente | Qué representa |
|------|--------|----------------|
| Maqueta / inventario | `MAQUETA` | Activo físico (placa, capacidad, ubicación, estado, préstamo) |
| Bitácora estado | `Bitacora` | Cambios de estado / ubicación / ente receptor |
| Suministro / viajes | `SUMINISTRO DEF` | Litros, personas y comunidades beneficiadas |

### Banco de Maquinaria — schemaVersion 6 (convenio raíz)
| Capa | Fuente | Llave | Modo |
|------|--------|-------|------|
| Convenio o proceso | `CONVENIOS O PROCESOS` | `no_convenio` | Alta única; F–I upsert |
| Maqueta / inventario | `DETALLE MAQUINARIA` | `serial` (cuelga del convenio) | Alta por equipo |
| Bitácora convenio | `BITACORA CONVENIOS` | `no_convenio` | Append |
| Entrega a beneficiario | `BASE ENTREGA BOMBEROS` | `serial` | Upsert |

- **Orden:** como Puentes — nace el convenio; luego se atan las máquinas (`CONTRATO DE ADQUISICION O CONVENIO`).
- **F–I editables:** cantidad expectativa, cantidad entregada, tiempo ejecución, fecha acta de inicio.
- **Sync:** bitácora → estado convenio/equipos; entrega → `ENTREGADA`.

### Puentes — schemaVersion 4 (multi-capa)
| Capa | Fuente Excel | Llave | Modo |
|------|--------------|-------|------|
| Inventario puente | `Base General Puentes` | `id_puente` → `clave_seguimiento` | Alta única |
| Bitácora estado | `bitacora` | `id_puente` (lookup facetado) | Append |
| Contrato estructuración | `Contratos Estructuracion` | `clave_proceso` (contrato/donación) | Append |

- **Activo vs proceso:** muchos puentes comparten un contrato; estructuración es por `clave_proceso`, no por puente.
- **Llaves derivadas (`asset-keys.ts`):** `origen_adquisicion` (donación EEUU / contrato…), `proceso_sigla` (`DON-EEUU`), `numero_unidad` y `codigo_operativo` (`DON-EEUU-03`). Alias legible del activo dentro de su proceso; se calculan, no se capturan. Backfill: `npx tsx scripts/backfill-puentes-llaves.ts --apply`.
- **Lookup facetado:** `GET /api/themes/puentes/puentes?facets=1&origen=…&proceso=…` devuelve opciones disponibles con conteos (cascada) más los resultados.
- **Sync:** tras bitácora, inventario refleja último `ubicacion_actual`, `estado_puente`, `situacion_prestamo`.
- **Reimport:** `npx tsx scripts/reimport-puentes.ts`

### ArcGIS (una capa inventario + geo)
- **Obras emergencia** (contrato+OP), **Obras por impuestos**, **Declaratorias**  
- Traen `DIVIPOLA` + lat/long → base del análisis espacial.
- **Puentes** migró a multi-capa (v4); el ArcGIS legacy queda como alias de columnas en import.

## Cómo se hace el seguimiento (operativo)

1. Cargar **maqueta** → queda el inventario con `clave_seguimiento`.
2. Cargar **bitácora** (mismas claves) → varias filas por clave = historial.
3. Analítica SQL agrupa por `tipo_registro` / `clave_seguimiento`.
4. Cruce futuro entre temas: misma `orden_de_proveeduria` en Agua y Obras O.P.; misma `placa` en Carrotanques; mismo municipio/DIVIPOLA con Declaratoria.

## Regenerar / sincronizar

```bash
node scripts/generate-theme-fields.cjs
npm run db:seed   # actualiza field_schema en themes
```

Importar por capa (recomendado):

```bash
npx tsx scripts/import-source-file.ts agua-y-saneamiento ".../Maqueta Agua....xlsx" General
npx tsx scripts/import-source-file.ts agua-y-saneamiento ".../Bitacora Agua....xlsx" bitacora
```

El importador asigna `tipo_registro` según hoja/hint.

## Pendiente (sin romper v1)

- Vista materializada `analytics.seguimiento_op` (join maqueta↔bitácora por clave).
- UI “timeline” por `clave_seguimiento`.
- Homologación DIVIPOLA estricta en reimportación.
- Separar tablas `core.*` solo tras piloto de publicación (plataforma workflows).
