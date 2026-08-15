# Catálogo de conexiones medallón — mismos nombres que el Excel

## Modelo

| Qué | Valor |
|-----|--------|
| **URL** | Una sola, solo lectura (`medallion_reader`) |
| **Tablas** | Una por **hoja Excel** / base operativa (mismo nombre) |
| **Columnas** | Todas las del formulario + extras de la hoja (nada omitido) |
| **JOINs** | Solo **dentro del mismo schema** (`puentes.*` o `agua.*`; Silver: `silver_*`) |
| **Lista Bronze** | `SELECT * FROM medallion.v_connections;` |
| **Mapa JOIN Bronze** | `SELECT * FROM medallion.v_join_map;` |
| **Lista Silver** | `SELECT * FROM medallion.v_silver_catalog;` |
| **Mapa JOIN Silver** | `SELECT * FROM medallion.v_silver_join_map;` |
| **Guía Silver** | [`MEDALLION-SILVER.md`](./MEDALLION-SILVER.md) |

```text
URL única
  ├── agua.general                              ← hoja «General»
  ├── agua.bitacora                             ← hoja «bitacora»
  ├── agua.pagos                                ← hoja «PAGOS»
  ├── agua.modificaciones
  ├── agua.cdps_y_rc
  ├── agua.bitacora_estructuracion
  ├── agua.control_y_seguimiento_detalle_m      ← hoja «control y seguimiento-detalle m»
  ├── agua.variables_lider                      ← capa de captura (columnas de General)
  ├── puentes.base_general_puentes              ← hoja «Base General Puentes»
  ├── puentes.bitacora                          ← hoja «bitacora» (incluye convenio_o_cto)
  └── puentes.contratos_estructuracion          ← hoja «Contratos Estructuracion»
```

No hay `puentes.all` / `puentes.inventario` / `agua.maqueta` inventados.
No se cruzan schemas: **no** JOIN `puentes.*` con `agua.*`.

---

## 0. Por qué Alibaba / BI muestra `record_id`, `theme_id`, `source`…

Todas las tablas tipadas (`agua.*`, `puentes.*`) empiezan con un **sobre técnico**
heredado de `public.records`. **No son columnas del Excel**; son metadatos de la app:

| Orden | Columna | Qué es |
|------:|---------|--------|
| 1 | `record_id` | UUID interno del registro |
| 2 | `theme_id` | Tema (`agua-y-saneamiento`, `puentes`, …) |
| 3 | `source` | Origen (`excel`, `form`, …) |
| 4–5 | `created_at`, `updated_at` | Auditoría |
| 6–8 | `capa`, `tipo_registro`, `clave_seguimiento` | Capa / llave de seguimiento |
| **9+** | **columnas de negocio** | Empiezan en la llave Excel (Agua: `orden_de_proveeduria`) |

En la UI de Alibaba el scrollbar horizontal es normal: desplace a la derecha para
ver `orden_de_proveeduria`, `proveedor`, `municipio`, etc.

**Tablas correctas Agua (hoja Excel):** `agua.general`, `agua.bitacora`,
`agua.pagos`, `agua.modificaciones`, `agua.cdps_y_rc`,
`agua.bitacora_estructuracion`, `agua.control_y_seguimiento_detalle_m`,
`agua.variables_lider`.

**No usar** como “hoja Excel”: `medallion.v_bronze_records` (crudo + `payload`
jsonb), ni nombres legacy `agua.maqueta` / `agua.control` (deben desaparecer
tras aplicar `sql/medallion/003_theme_capa_views.sql` en prod).

Lista viva: `SELECT * FROM medallion.v_connections WHERE schema_name = 'agua';`

---

## 1. URL de lectura

```text
postgresql://medallion_reader.vbxvqctdemtnmkifrxeo:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require
```

---

## 2. Mapa de JOIN — schema `puentes` (solo tablas Puentes)

```text
contratos_estructuracion ──clave_proceso / convenio_o_cto──► base_general_puentes
                                    │
                                    │ id_puente (+ codigo_operativo)
                                    ▼
                               bitacora
                         (+ convenio_o_cto / clave_proceso / contrato_convenio)
```

| Relación | Llave primaria | Alternativa |
|----------|----------------|-------------|
| `bitacora` ↔ `base_general_puentes` | **`id_puente`** | `codigo_operativo` (ID UNICO) |
| `bitacora` ↔ `contratos_estructuracion` | **`clave_proceso`** | `convenio_o_cto` (= contrato) |
| `base_general_puentes` ↔ `contratos_estructuracion` | **`clave_proceso`** | `contrato_convenio` / `convenio_o_cto` |

### Ejemplos SQL (Puentes)

```sql
-- Eventos de bitácora + datos del puente
SELECT b.id_puente, b.fecha_inicio, b.estado_puente, b.convenio_o_cto,
       i.clase, i.municipio, i.codigo_operativo
FROM puentes.bitacora b
JOIN puentes.base_general_puentes i ON i.id_puente = b.id_puente;

-- Bitácora + etapa del contrato
SELECT b.id_puente, b.fecha_inicio, e.contrato_convenio, e.etapa, e.estado
FROM puentes.bitacora b
JOIN puentes.contratos_estructuracion e
  ON e.clave_proceso = b.clave_proceso;

-- Inventario + proceso (N puentes : 1 contrato)
SELECT i.id_puente, i.codigo_operativo, e.etapa, e.grupo
FROM puentes.base_general_puentes i
JOIN puentes.contratos_estructuracion e
  ON e.clave_proceso = i.clave_proceso;
```

---

## 3. Mapa de JOIN — schema `agua` (solo tablas Agua)

```text
                    ┌── bitacora
                    ├── pagos
agua.general ──OP── ├── cdps_y_rc
 (hoja General)     ├── modificaciones
                    ├── bitacora_estructuracion
                    ├── control_y_seguimiento_detalle_m
                    └── variables_lider
```

| Relación | Llave |
|----------|-------|
| Cualquier satélite ↔ `agua.general` | **`orden_de_proveeduria`** (OP) |
| Satélite ↔ satélite (mismo historial OP) | **`orden_de_proveeduria`** |

### Ejemplos SQL (Agua)

```sql
-- Bitácora + fila vigente de maqueta/General
SELECT b.orden_de_proveeduria, b.fecha_estado, b.estado, b.proceso,
       g.proveedor, g.municipio, g.estado_actual
FROM agua.bitacora b
JOIN agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria;

-- Pagos + General
SELECT p.orden_de_proveeduria, p.fecha_de_pago, p.valor_pagado_total_con_impuestos,
       g.proveedor, g.valor AS valor_op
FROM agua.pagos p
JOIN agua.general g ON g.orden_de_proveeduria = p.orden_de_proveeduria;

-- CDPS/RC + General
SELECT c.orden_de_proveeduria, c.n_cdp, c.n_rc, g.objeto
FROM agua.cdps_y_rc c
JOIN agua.general g ON g.orden_de_proveeduria = c.orden_de_proveeduria;
```

---

## 4. Tablas por hoja

### Puentes (`puentes 2.xlsx`)

| Tabla Postgres | Hoja Excel |
|----------------|------------|
| `puentes.base_general_puentes` | Base General Puentes |
| `puentes.bitacora` | bitacora (incluye **`convenio_o_cto`**) |
| `puentes.contratos_estructuracion` | Contratos Estructuracion |

### Agua (Exceles Maqueta + Bitácora)

| Tabla Postgres | Hoja Excel | Cols (aprox.) | 1ª col. negocio tras sobre |
|----------------|------------|--------------:|----------------------------|
| `agua.general` | General | 86 | `orden_de_proveeduria` |
| `agua.bitacora` | bitacora | 15 | `orden_de_proveeduria` |
| `agua.modificaciones` | modificaciones | 26 | `orden_de_proveeduria` |
| `agua.pagos` | PAGOS | 26 | `orden_de_proveeduria` |
| `agua.cdps_y_rc` | CDPS Y RC | 23 | `orden_de_proveeduria` |
| `agua.bitacora_estructuracion` | bitacora estructuracion | 20 | `orden_de_proveeduria` |
| `agua.control_y_seguimiento_detalle_m` | control y seguimiento-detalle m | 38 | `orden_de_proveeduria` |
| `agua.variables_lider` | capa captura (subconjunto General) | 18 | `orden_de_proveeduria` |

### Subsidios de arriendos (consolidado de envíos)

| Tabla Postgres | Fuente | Llave |
|----------------|--------|-------|
| `subsidios_arriendos.consolidado` | Excel consolidado Bronze | **`uuid`** |

`numero_envio` y `n_orden` identifican el envío y el orden interno. Departamento/municipio vienen del archivo. Capas futuras de seguimiento se unen por `uuid`.

```sql
SELECT uuid, numero_envio, n_orden, departamento, municipio,
       nombres_arrendatario, valor_total_pagado, _archivo_fuente
FROM subsidios_arriendos.consolidado;
```

**Import maqueta ancha:** en prod, CDP/RC y variables líder llegaron dentro de
filas `Alta / orden` (no como capa aparte). Las vistas `agua.cdps_y_rc` y
`agua.variables_lider` incluyen esas filas Alta cuando hay marcadores
(`n_cdp` / `fecha_cdp` / `administracion` / etc.).  
`agua.bitacora_estructuracion` queda vacía hasta que exista import con
`semana_seguimiento` / `comentario_semanal`.

Auditoría local: `npx tsx scripts/audit-agua-silver-gaps.ts` ·
`npx tsx scripts/audit-agua-field-collisions.ts`.

Renombres legacy → canónico (tras aplicar 003): `agua.maqueta` → `agua.general`,
`agua.control` → `agua.control_y_seguimiento_detalle_m`.

---

## 5. Silver (tablas físicas — preferido para JOINs con FK)

Misma semántica de hoja Excel, pero en `silver_agua` / `silver_puentes` con
PK/FK. Guía: [`MEDALLION-SILVER.md`](./MEDALLION-SILVER.md).

```sql
SELECT * FROM medallion.v_silver_catalog;
SELECT * FROM medallion.v_silver_join_map;
SELECT count(*) FROM silver_agua.general;
SELECT count(*) FROM silver_puentes.bitacora;
```

---

## 6. Regenerar

```bash
npm run medallion:generate          # Bronze vistas 003
npm run medallion:generate-silver   # Silver 010/011 + manifest
npm run medallion:sync-silver       # truncate+reload (admin)
npm run medallion:test-silver
```

```sql
SELECT * FROM medallion.v_join_map WHERE schema_name = 'puentes';
SELECT * FROM medallion.v_join_map WHERE schema_name = 'agua';
SELECT * FROM medallion.v_silver_join_map;
```
