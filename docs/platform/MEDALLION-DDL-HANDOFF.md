# Handoff DDL — Medallón reader (Puentes + Agua)

Paquete único para entregar al equipo de datos / Alibaba: **conexión solo-lectura,
schemas, columnas, JOIN, DDL y pasos para re-aplicar en Supabase**.

| Meta | Valor |
|------|--------|
| Fecha | 2026-08-06 |
| Proyecto Supabase | `vbxvqctdemtnmkifrxeo` |
| Estado prod | **001 + 003 + Silver 010/011 + sync** (Bronze + `silver_agua` / `silver_puentes`) |
| Rol | `medallion_reader` (SELECT only) |
| DDL Bronze | `sql/medallion/001_bronze_views.sql` + `003_theme_capa_views.sql` |
| DDL Silver | `sql/medallion/010_silver_tables.sql` + `011_silver_grants.sql` |
| Guía Silver | [`MEDALLION-SILVER.md`](./MEDALLION-SILVER.md) |
| Grants rol | `sql/medallion/004_create_reader_*.sql` + `005_fix_set_role.sql` |
| Password | **Nunca en este doc** — vault / `MEDALLION_DATABASE_URL` |

---

## Nota Alibaba (leer primero)

1. **Solo datos operativos reales.** Bronze y Silver exponen captura
   `form` / `excel` con `deleted_at IS NULL`. Se excluyen fuentes de prueba
   (`seed`, `demo`, `harness`, `smoke`, `test`). No hay filas dummy del seed
   local en el contrato de lectura.
2. **Primeras columnas = envelope de plataforma** (no son del Excel):
   `record_id`, `theme_id`, `source`, `created_at`, `updated_at`.
   Luego van `capa` / llaves de negocio y el resto de campos de la hoja.
3. **Bronze (compat / tipado):** schemas `agua.*` / `puentes.*` (vistas).
4. **Silver (relacional con PK/FK — preferido para Alibaba avanzado):**
   - `silver_agua.*` (dim `orden` + tablas por hoja)
   - `silver_puentes.*` (`base_general_puentes`, `bitacora`, `contratos_estructuracion`)
   - Guía: [`MEDALLION-SILVER.md`](./MEDALLION-SILVER.md)
5. **No** construir el lake desde `public.records` crudo (salvo bronze
   `medallion.v_bronze_records` si necesitan el JSONB completo).
6. **JOINs solo intra-schema** (nunca Puentes↔Agua; tampoco `silver_agua`↔`silver_puentes`).
7. Prod 2026-08-06: Bronze canónico + Silver aplicado y sincronizado (sin seed).

---

## 1. Conexión reader (sin password)

Variable: `MEDALLION_DATABASE_URL` (ver `.env.example`).

```text
# Pooler (recomendado)
postgresql://medallion_reader.vbxvqctdemtnmkifrxeo:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require

# Directo
postgresql://medallion_reader:[PASSWORD]@db.vbxvqctdemtnmkifrxeo.supabase.co:5432/postgres?sslmode=require
```

| Campo | Valor |
|-------|--------|
| Host pooler | `aws-1-us-west-2.pooler.supabase.com` |
| Host directo | `db.vbxvqctdemtnmkifrxeo.supabase.co` |
| Puerto | `5432` |
| DB | `postgres` |
| User pooler | `medallion_reader.vbxvqctdemtnmkifrxeo` |
| User directo | `medallion_reader` |
| SSL | `require` |
| Password | **aparte** (no documentado aquí) |

```sql
SELECT current_user, current_database();
SELECT count(*) FROM agua.general;
SELECT count(*) FROM puentes.base_general_puentes;
SELECT * FROM medallion.v_join_map LIMIT 5;
```

Si fallan `agua.general` o `v_join_map` → entorno legacy; aplicar §5.

---

## 2. Schemas completos (canónico repo)

### 2.1 `puentes`

| Vista | Hoja Excel | Propósito |
|-------|------------|-----------|
| `puentes.base_general_puentes` | Base General Puentes | Inventario / activo |
| `puentes.bitacora` | bitacora | Eventos (+ `convenio_o_cto`, `clave_proceso`, `contrato_convenio`) |
| `puentes.contratos_estructuracion` | Contratos Estructuracion | Proceso / contrato |

### 2.2 `agua`

| Vista | Hoja Excel | Propósito |
|-------|------------|-----------|
| `agua.general` | General | Hub OP (capas Alta / Maqueta) |
| `agua.bitacora` | bitacora | Historial de estados |
| `agua.pagos` | PAGOS | Desembolsos |
| `agua.modificaciones` | modificaciones | Modificaciones contractuales |
| `agua.cdps_y_rc` | CDPS Y RC | CDP / RC |
| `agua.bitacora_estructuracion` | bitacora estructuracion | Seguimiento operativo |
| `agua.control_y_seguimiento_detalle_m` | control y seguimiento-detalle m | Control físico |
| `agua.variables_lider` | Variables líder | Facetas líder |

### 2.3 `medallion`

| Vista | Propósito |
|-------|-----------|
| `v_bronze_themes` | Catálogo temas + `field_schema` |
| `v_bronze_theme_fields` | Campos aplanados |
| `v_bronze_records` | Records vigentes + `payload` jsonb |
| `v_bronze_records_deleted` | Soft-deletes |
| `v_bronze_record_versions` | Historial de versiones |
| `v_bronze_uploads` | Metadatos de cargas Excel |
| `v_bronze_counts_by_theme_capa` | Conteos por tema/capa |
| `v_connections` | Catálogo connection_id → tabla hoja |
| `v_source_catalog` | Catálogo simplificado |
| `v_join_map` | Mapa de JOIN intra-schema |
| `v_agua_general` / `v_agua_maqueta` | Alias → `agua.general` |
| `v_agua_bitacora` | Alias → `agua.bitacora` |
| `v_agua_pagos` | Alias → `agua.pagos` |
| `v_agua_modificaciones` | Alias → `agua.modificaciones` |
| `v_agua_cdps_rc` | Alias → `agua.cdps_y_rc` |
| `v_agua_control` | Alias → `agua.control_y_seguimiento_detalle_m` |
| `v_agua_variables_lider` | Alias → `agua.variables_lider` |
| `v_agua_bitacora_estructuracion` | Alias → `agua.bitacora_estructuracion` |
| `v_agua_y_saneamiento_*` | Aliases legacy por slug largo |
| `v_puentes_base_general` / `v_puentes_inventario` | Alias → `puentes.base_general_puentes` |
| `v_puentes_bitacora` | Alias → `puentes.bitacora` |
| `v_puentes_estructuracion` / `v_puentes_contratos_estructuracion` | Alias → `puentes.contratos_estructuracion` |

### 2.4 Legacy → canónico (histórico; ya aplicado en prod 2026-08-06)

| Antes (legacy) | Ahora (canónico live) |
|----------------|------------------------|
| `agua.maqueta` | `agua.general` (+ alias `medallion.v_agua_maqueta`) |
| `agua.control` | `agua.control_y_seguimiento_detalle_m` (+ alias `v_agua_control`) |
| sin `v_join_map` | `medallion.v_join_map` (13 filas) |
| Puentes sin llaves de proceso | `clave_proceso`, `convenio_o_cto`, `contrato_convenio` en bitácora/inventario |

Verificación reader post-apply: `agua.maqueta` / `agua.control` **ausentes**;
`agua.general` (86 cols, 134 filas); JOINs OP e `id_puente` / `clave_proceso` OK.

---

## 3. Mapa de JOIN (intra-schema)

```sql
SELECT * FROM medallion.v_join_map WHERE schema_name IN ('puentes','agua');
```

### Puentes

```text
contratos_estructuracion ──clave_proceso──► base_general_puentes ──id_puente──► bitacora
         │                         │                              │
         └──── convenio_o_cto ─────┴──── contrato_convenio ───────┘
```

| Relación | Llave primaria | Alternativa |
|----------|----------------|-------------|
| `bitacora` ↔ `base_general_puentes` | `id_puente` | `codigo_operativo` |
| `bitacora` ↔ `contratos_estructuracion` | `clave_proceso` | `convenio_o_cto` |
| `base_general_puentes` ↔ `contratos_estructuracion` | `clave_proceso` | `contrato_convenio` / `convenio_o_cto` |

```sql
SELECT b.id_puente, b.fecha_inicio, i.clase, i.municipio
FROM puentes.bitacora b
JOIN puentes.base_general_puentes i ON i.id_puente = b.id_puente;

SELECT b.id_puente, e.etapa, e.estado
FROM puentes.bitacora b
JOIN puentes.contratos_estructuracion e ON e.clave_proceso = b.clave_proceso;
```

### Agua

```text
                    ┌── bitacora
                    ├── pagos
agua.general ──OP── ├── cdps_y_rc
 (hub)              ├── modificaciones
                    ├── bitacora_estructuracion
                    ├── control_y_seguimiento_detalle_m
                    └── variables_lider
```

| Relación | Llave |
|----------|-------|
| Satélite ↔ `agua.general` | `orden_de_proveeduria` |
| Satélite ↔ satélite | `orden_de_proveeduria` |

```sql
SELECT b.orden_de_proveeduria, b.fecha_estado, g.proveedor, g.municipio
FROM agua.bitacora b
JOIN agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria;
```

### Filas `v_join_map` (VALUES del 003)

| schema | left | right | key | prioridad |
|--------|------|-------|-----|-----------|
| puentes | bitacora | base_general_puentes | id_puente | primaria |
| puentes | bitacora | base_general_puentes | codigo_operativo | secundaria |
| puentes | bitacora | contratos_estructuracion | clave_proceso | primaria |
| puentes | bitacora | contratos_estructuracion | convenio_o_cto | alternativa |
| puentes | base_general_puentes | contratos_estructuracion | clave_proceso | primaria |
| agua | bitacora | general | orden_de_proveeduria | primaria |
| agua | pagos | general | orden_de_proveeduria | primaria |
| agua | cdps_y_rc | general | orden_de_proveeduria | primaria |
| agua | modificaciones | general | orden_de_proveeduria | primaria |
| agua | bitacora_estructuracion | general | orden_de_proveeduria | primaria |
| agua | control_y_seguimiento_detalle_m | general | orden_de_proveeduria | primaria |
| agua | variables_lider | general | orden_de_proveeduria | primaria |
| agua | pagos | bitacora | orden_de_proveeduria | secundaria |

---

## 4. Columnas (canónico 003)

Envelope siempre primero: `record_id`, `theme_id`, `source`, `created_at`, `updated_at`.

### Schema `puentes`

### `puentes.contratos_estructuracion` (29 columnas)

- **Excel / capa:** Contratos Estructuracion — proceso / contrato

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `contrato_convenio`, `clave_proceso`, `tipo_vinculo`, `descripcion_proceso`, `valor`, `vigencia`, `tipo_proceso`, `grupo`, `etapa`, `estado`, `area`, `responsable`, `fecha_inicio_proceso`, `fecha_fin_proceso`, `plazo_ejecucion`, `tiempo_etapa_dias`, `tiempo_acumulado_dias`, `alerta`, `comentarios`, `reporte`, `convenio_o_cto`

### `puentes.base_general_puentes` (43 columnas)

- **Excel / capa:** Base General Puentes — inventario / activo

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `id_puente`, `codigo_operativo`, `clase`, `tipo`, `configuracion`, `ano_compra`, `longitud_m`, `capacidad_ton`, `clasificacion_propiedad`, `valor`, `ubicacion_actual`, `region`, `departamento`, `municipio`, `personas_beneficiadas`, `latitud`, `longitud`, `entidad_receptora`, `estado_puente`, `situacion_prestamo`, `fecha_inicio_estado_actual`, `fecha_fin_estado_actual`, `fecha_desde_ultimo_estado`, `observaciones`, `contrato_convenio`, `contrato`, `clave_proceso`, `tipo_vinculo`, `descripcion_proceso`, `convenio_o_cto`, `id_unico`, `id`, `origen_adquisicion`, `proceso_sigla`, `numero_unidad`

### `puentes.bitacora` (32 columnas)

- **Excel / capa:** bitacora — eventos de estado (+ llaves de proceso)

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `id_puente`, `codigo_operativo`, `tipo`, `cantidad_viajes`, `ubicacion_actual`, `region`, `departamento`, `municipio`, `vereda`, `ente_receptor`, `situacion_prestamo`, `estado_puente`, `fecha_inicio`, `fecha_fin`, `fecha_corte_reporte`, `fundamento`, `observaciones`, `nombre_hoja_reporte`, `convenio_o_cto`, `contrato_convenio`, `clave_proceso`, `tipo_vinculo`, `id_unico`, `id`


### Schema `agua`

### `agua.general` (86 columnas)

- **Excel / capa:** General / Maqueta (hub OP) — hoja «General»; capas Alta/Maqueta

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `orden_de_proveeduria_segmentado`, `op2`, `orden_de_proveeduria_x_pago`, `nit`, `proveedor`, `valor`, `vigencia`, `tipo_de_orden`, `orden_relacionada_control_y_seg`, `proveedor_o_p_par`, `region`, `provincia`, `departamento`, `municipio`, `fecha`, `objeto`, `decreto`, `tipo_maquina`, `n_sigob_de_solicitud`, `n_sigob_de_respuesta`, `tipo_de_evento`, `coordenadas`, `plazo_de_ejecucion_dias`, `forma_de_pago`, `no_cdp`, `n_cdp`, `fecha_cdp`, `valor_cdp`, `no_rc`, `n_rc`, `fecha_rc`, `valor_rc`, `expediente`, `responsable_apoyo_a_la_supervision`, `fecha_de_asignacion`, `estado`, `estado_de_ejecucion`, `fecha_inicio_orden`, `fecha_fin_orden`, `ejecucion`, `fecha_radicacion_expediente`, `tecnico_asignado`, `abogado_asignado_r_tecnica`, `financiero_asignado`, `fecha_de_aval`, `cantidad_reiteraciones`, `cantidad_observaciones`, `dias_en_tecnico`, `dias_en_proveedor`, `dias_contractual`, `dias_financiera`, `dias_subdirector`, `dias_subdireccion_general`, `dias_gafc`, `dias_fiduprevisora`, `dias_totales_en_la_linea`, `dias_en_gestion_de_pagos`, `n_ratificacion`, `sd`, `valor_pagado`, `comprobante_de_egreso`, `voucher`, `fecha_de_pago`, `op_paga`, `etapa`, `estado_actual`, `proceso_actual`, `dependencia`, `dias_desde_ult_gestion`, `fecha_ultimo_seguimiento`, `comentario_ult_seguimiento_a_supervision`, `novedades`, `validaciom`, `administracion`, `procesos_juridicos`, `nombre_orden`, `categorizacion`

### `agua.variables_lider` (18 columnas)

- **Excel / capa:** Variables líder — capa captura Variables líder

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `administracion`, `procesos_juridicos`, `nombre_orden`, `categorizacion`, `responsable_apoyo_a_la_supervision`, `tecnico_asignado`, `abogado_asignado_r_tecnica`, `financiero_asignado`, `fecha_de_aval`

### `agua.modificaciones` (26 columnas)

- **Excel / capa:** modificaciones — hoja «modificaciones»

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `proveedor`, `num_modificacion`, `tipo_de_modificacion`, `modificacion`, `fecha`, `valor`, `plazo_de_ejecucion_dias`, `horas_maquina`, `dias_volqueta`, `sin_info`, `forma_de_pago`, `valor_parcial_1`, `valor_parcial_2`, `valor_parcial_3`, `observaciones`, `horas`, `verif`

### `agua.bitacora` (15 columnas)

- **Excel / capa:** bitacora — hoja «bitacora»

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `fecha_estado`, `estado_macro`, `estado`, `proceso`, `dependencia`, `comentario`

### `agua.pagos` (26 columnas)

- **Excel / capa:** PAGOS — hoja «PAGOS»

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `orden_de_proveeduria_x_pago`, `nit`, `proveedor`, `valor_op_parcial`, `ano`, `n_contrato`, `sd_solicitud_de_desembolso`, `comprobante_de_egreso`, `voucher`, `valor_pagado_sin_impuestos`, `valor_pagado_total_con_impuestos`, `saldo_a_liberar`, `fecha_de_pago`, `op_paga`, `saldo_por_liberar`, `comentario_depuracion`, `odern_3`

### `agua.cdps_y_rc` (23 columnas)

- **Excel / capa:** CDPS Y RC — hoja «CDPS Y RC»

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `proveedor`, `valor`, `ano`, `no_cdp`, `n_cdp`, `fecha_cdp`, `valor_cdp`, `no_rc`, `n_rc`, `fecha_rc`, `valor_rc`, `valor_pagado`, `n_ratificacion`, `observaciones`

### `agua.bitacora_estructuracion` (20 columnas)

- **Excel / capa:** bitacora estructuracion — hoja «bitacora estructuracion»

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `estado_de_ejecucion`, `semana_seguimiento`, `fecha_estado`, `comentario_semanal`, `responsable_apoyo_a_la_supervision`, `fecha_de_asignacion`, `fecha_inicio_orden`, `fecha_fin_orden`, `ejecucion`, `expediente`, `fecha_radicacion_expediente`

### `agua.control_y_seguimiento_detalle_m` (38 columnas)

- **Excel / capa:** control y seguimiento-detalle m — control ejecución física

- **Envelope (primeras):** `record_id`, `theme_id`, `source`, `created_at`, `updated_at`

- **Negocio:** `capa`, `tipo_registro`, `clave_seguimiento`, `orden_de_proveeduria`, `tipo_de_orden`, `tipo_maquina`, `nombre_orden`, `cntd_tanques_de_almacenamiento_de_agua_contratados`, `capacidad_lts_tanques_contratados`, `cantidad_carrotanques_contratadas`, `capacidad_lt_crrt_contratadas`, `dias_suministro_crrt_contratada`, `cntd_vactor_contratadas`, `capacidad_lt_vactor_contratada`, `dias_suministro_vactor_contratada`, `cantidad_maquinas_m_a_contratadas`, `horas_maquina_m_a`, `dias_volqueta_m_a_contratadas`, `cantidad_de_tanques_de_almacenamiento_de_agua_ejecutadas`, `capacidad_lt_tanques_ejecutados`, `cantidad_carrotanques_ejecutadas`, `capacidad_lt_2_crrt`, `dias_suministro_crrt`, `cntd_vactor_ejecutadas`, `capacidad_lt_vactor_ejecutadas`, `dias_suministro_vactor_ejecutadas`, `cantidad_maquinas_m_a_ejecutadas`, `horas_maquina_m_a_ejecutadas`, `dias_volqueta_m_a_ejecutadas`, `vigencia`, `proveedor`, `municipio`, `departamento`


### Bronze `medallion.v_bronze_records`

`record_id`, `theme_id`, `departamento`, `municipio`, `fecha`, `estado`, `valor`,
`source`, `content_hash`, `upload_id`, `created_by`, `created_at`, `updated_at`,
`payload` (jsonb)

---

## 5. Aplicar en Supabase SQL Editor (admin)

**Prod `vbxvqctdemtnmkifrxeo` ya tiene 001+003 (2026-08-06).**  
Usar esta sección para re-aplicar tras `npm run medallion:generate`, o en otro entorno con legacy (`agua.maqueta` / sin `v_join_map`).

Requiere rol **`postgres`** (Session pooler :5432, user `postgres.vbxvqctdemtnmkifrxeo`).
El reader **no** puede `CREATE VIEW`.

**Orden (rol `postgres` en SQL Editor):**

1. Crear/actualizar rol reader → pegar contenido de `sql/medallion/004_create_reader_vbxvqctdemtnmkifrxeo.sql`  
   (reemplazar `<PASSWORD_APARTE>` / placeholder por el password del vault; **no** commitear).
2. Opcional fix `SET ROLE` → `sql/medallion/005_fix_set_role.sql`
3. Bronze → pegar **íntegro** `sql/medallion/001_bronze_views.sql` → Run
4. Vistas tipadas + join map + grants → pegar **íntegro** `sql/medallion/003_theme_capa_views.sql` → Run  
   (el 003 regenera todos los schemas de tema; es idempotente con `DROP VIEW IF EXISTS … CASCADE`)
5. Verificar:

```sql
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema IN ('agua','puentes','medallion')
ORDER BY 1,2;

SELECT * FROM medallion.v_join_map;
SELECT count(*) FROM agua.general;
SELECT count(*) FROM puentes.bitacora;

-- Reader
SET ROLE medallion_reader;
SELECT count(*) FROM agua.general;
SELECT count(*) FROM puentes.base_general_puentes;
RESET ROLE;
```

**Desde CLI** (si hay `DATABASE_URL` admin, no el reader):

```bash
npm run medallion:generate   # regenera 003 desde theme.ts
psql "$DATABASE_URL" -f sql/medallion/001_bronze_views.sql
psql "$DATABASE_URL" -f sql/medallion/003_theme_capa_views.sql
```

---

## 6. Grants (reader)

### 6.1 Crear rol (plantilla 004 — password fuera)

```sql
-- Ejecutar en Supabase → SQL Editor (como postgres).
-- Host: db.vbxvqctdemtnmkifrxeo.supabase.co
--
-- Orden recomendado:
--   1) Este archivo (crea schema + rol lector)
--   2) sql/medallion/001_bronze_views.sql
--   3) sql/medallion/003_theme_capa_views.sql
--
-- Cambia '<PASSWORD_APARTE>' por el password del vault antes de ejecutar.

BEGIN;

-- Schema de lectura (por si aún no corrieron 001)
CREATE SCHEMA IF NOT EXISTS medallion;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
    CREATE ROLE medallion_reader LOGIN PASSWORD '<PASSWORD_APARTE>';
  ELSE
    ALTER ROLE medallion_reader WITH LOGIN PASSWORD '<PASSWORD_APARTE>';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO medallion_reader;
GRANT USAGE ON SCHEMA medallion TO medallion_reader;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO medallion_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA medallion TO medallion_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO medallion_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA medallion
  GRANT SELECT ON TABLES TO medallion_reader;

-- Opcional: no exponer IAM de la app
REVOKE SELECT ON TABLE public.users FROM medallion_reader;
REVOKE SELECT ON TABLE public.user_theme_access FROM medallion_reader;

COMMIT;

-- Después de 001 + 003, probar:
--   SELECT count(*) FROM medallion.v_agua_maqueta;
--   SELECT * FROM medallion.v_source_catalog LIMIT 5;
```

### 6.2 Fix SET ROLE (005)

```sql
-- Arregla: permission denied to set role "medallion_reader"
-- Ejecutar en Supabase SQL Editor como postgres.

-- 1) Permitir que postgres (y el SQL Editor) asuman el rol
GRANT medallion_reader TO postgres;

-- 2) Asegurar login + password (usar el password del vault / secret manager)
ALTER ROLE medallion_reader WITH LOGIN PASSWORD '<PASSWORD_APARTE>';

-- 3) Privilegios de lectura (por si faltó algo)
GRANT USAGE ON SCHEMA public TO medallion_reader;
GRANT USAGE ON SCHEMA medallion TO medallion_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO medallion_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA medallion TO medallion_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO medallion_reader;

-- 4) Probar
SET ROLE medallion_reader;
SELECT current_user AS quien_soy;
SELECT count(*) AS agua FROM medallion.v_agua_all;
SELECT count(*) AS puentes FROM medallion.v_puentes_all;
RESET ROLE;
```

### 6.3 Grants mínimos Puentes + Agua + medallion

```sql
-- Grants reader (schemas de este handoff)
GRANT USAGE ON SCHEMA public TO medallion_reader;
GRANT USAGE ON SCHEMA medallion TO medallion_reader;
GRANT USAGE ON SCHEMA agua TO medallion_reader;
GRANT USAGE ON SCHEMA puentes TO medallion_reader;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO medallion_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA medallion TO medallion_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA agua TO medallion_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA puentes TO medallion_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA medallion GRANT SELECT ON TABLES TO medallion_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA agua GRANT SELECT ON TABLES TO medallion_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA puentes GRANT SELECT ON TABLES TO medallion_reader;

REVOKE SELECT ON TABLE public.users FROM medallion_reader;
REVOKE SELECT ON TABLE public.user_theme_access FROM medallion_reader;
```

(El `003` completo también otorga USAGE/SELECT a los demás schemas de tema.)

---

## 7. DDL canónico — `001` bronze (`medallion`)

Fuente: [`sql/medallion/001_bronze_views.sql`](../../sql/medallion/001_bronze_views.sql)

```sql
-- Medallón UNGRD — bronze limpio (sin columnas inventadas de otros temas)
-- Idempotente (DROP + CREATE: CREATE OR REPLACE no puede quitar columnas).
-- Uso: psql "$DATABASE_URL" -f sql/medallion/001_bronze_views.sql

CREATE SCHEMA IF NOT EXISTS medallion;

COMMENT ON SCHEMA medallion IS
  'Contrato de lectura para lake/warehouse. Portátil entre hosts Postgres.';

-- Catálogo de temas (definición de campos)
DROP VIEW IF EXISTS medallion.v_bronze_themes CASCADE;
CREATE VIEW medallion.v_bronze_themes AS
SELECT
  id AS theme_id,
  name,
  short_name,
  description,
  unit,
  value_label,
  schema_version,
  field_schema,
  updated_at
FROM public.themes;

COMMENT ON VIEW medallion.v_bronze_themes IS
  'Catálogo de temas + field_schema (nombres/tipos de columnas lógicas).';

-- Campos aplanados del schema (guía para tipar)
DROP VIEW IF EXISTS medallion.v_bronze_theme_fields CASCADE;
CREATE VIEW medallion.v_bronze_theme_fields AS
SELECT
  t.id AS theme_id,
  t.schema_version,
  (f.ordinality)::int AS field_ord,
  f.elem->>'name' AS field_name,
  f.elem->>'label' AS field_label,
  f.elem->>'type' AS field_type,
  (f.elem->>'required')::boolean AS field_required
FROM public.themes t
CROSS JOIN LATERAL jsonb_array_elements(t.field_schema)
  WITH ORDINALITY AS f(elem, ordinality);

-- Registros crudos vigentes: SOLO columnas reales de public.records
-- El detalle del tema vive en payload (jsonb). Para columnas tipadas por tema
-- use medallion.v_<tema>_all / v_<tema>_<capa> (archivo 003).
DROP VIEW IF EXISTS medallion.v_bronze_records CASCADE;
CREATE VIEW medallion.v_bronze_records AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.departamento,
  r.municipio,
  r.fecha,
  r.estado,
  r.valor,
  r.source,
  r.content_hash,
  r.upload_id,
  r.created_by,
  r.created_at,
  r.updated_at,
  r.payload
FROM public.records r
WHERE r.deleted_at IS NULL;

COMMENT ON VIEW medallion.v_bronze_records IS
  'Crudo operativo. Sin columnas extraídas artificiales; payload = campos del tema.';

DROP VIEW IF EXISTS medallion.v_bronze_records_deleted CASCADE;
CREATE VIEW medallion.v_bronze_records_deleted AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.departamento,
  r.municipio,
  r.fecha,
  r.estado,
  r.valor,
  r.source,
  r.content_hash,
  r.upload_id,
  r.created_by,
  r.created_at,
  r.updated_at,
  r.deleted_at,
  r.payload
FROM public.records r
WHERE r.deleted_at IS NOT NULL;

DROP VIEW IF EXISTS medallion.v_bronze_record_versions CASCADE;
CREATE VIEW medallion.v_bronze_record_versions AS
SELECT
  v.id AS version_id,
  v.record_id,
  v.theme_id,
  v.version,
  v.departamento,
  v.municipio,
  v.fecha,
  v.estado,
  v.valor,
  v.changed_fields,
  v.reason,
  v.created_by,
  v.created_at,
  v.payload
FROM public.record_versions v;

DROP VIEW IF EXISTS medallion.v_bronze_uploads CASCADE;
CREATE VIEW medallion.v_bronze_uploads AS
SELECT
  u.id AS upload_id,
  u.theme_id,
  u.schema_version,
  u.file_name,
  u.status,
  u.accepted,
  u.rejected,
  u.duplicates,
  u.errors,
  u.created_by,
  u.created_at,
  u.finished_at
FROM public.uploads u;

DROP VIEW IF EXISTS medallion.v_bronze_counts_by_theme_capa CASCADE;
CREATE VIEW medallion.v_bronze_counts_by_theme_capa AS
SELECT
  theme_id,
  nullif(trim(coalesce(payload->>'capa', payload->>'tipo_registro', '')), '') AS capa,
  count(*)::bigint AS n_records,
  min(fecha) AS fecha_min,
  max(fecha) AS fecha_max,
  max(updated_at) AS updated_at_max
FROM public.records
WHERE deleted_at IS NULL
GROUP BY 1, 2;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA medallion TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA medallion TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA medallion GRANT SELECT ON TABLES TO medallion_reader';
  END IF;
END $$;
```

---

## 8. DDL canónico — schema `agua` (extracto 003)

Fuente: bloque Agua de [`sql/medallion/003_theme_capa_views.sql`](../../sql/medallion/003_theme_capa_views.sql)

```sql
-- === Agua y Saneamiento → schema agua ===
CREATE SCHEMA IF NOT EXISTS agua;

DROP VIEW IF EXISTS agua.general CASCADE;
CREATE VIEW agua.general AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'orden_de_proveeduria_segmentado' AS orden_de_proveeduria_segmentado,
  r.payload->>'op2' AS op2,
  r.payload->>'orden_de_proveeduria_x_pago' AS orden_de_proveeduria_x_pago,
  r.payload->>'nit' AS nit,
  r.payload->>'proveedor' AS proveedor,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'vigencia' AS vigencia,
  r.payload->>'tipo_de_orden' AS tipo_de_orden,
  r.payload->>'orden_relacionada_control_y_seg' AS orden_relacionada_control_y_seg,
  r.payload->>'proveedor_o_p_par' AS proveedor_o_p_par,
  r.payload->>'region' AS region,
  r.payload->>'provincia' AS provincia,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  r.payload->>'objeto' AS objeto,
  r.payload->>'decreto' AS decreto,
  r.payload->>'tipo_maquina' AS tipo_maquina,
  r.payload->>'n_sigob_de_solicitud' AS n_sigob_de_solicitud,
  r.payload->>'n_sigob_de_respuesta' AS n_sigob_de_respuesta,
  r.payload->>'tipo_de_evento' AS tipo_de_evento,
  r.payload->>'coordenadas' AS coordenadas,
  r.payload->>'plazo_de_ejecucion_dias' AS plazo_de_ejecucion_dias,
  r.payload->>'forma_de_pago' AS forma_de_pago,
  r.payload->>'no_cdp' AS no_cdp,
  r.payload->>'n_cdp' AS n_cdp,
  r.payload->>'fecha_cdp' AS fecha_cdp,
  r.payload->>'valor_cdp' AS valor_cdp,
  r.payload->>'no_rc' AS no_rc,
  r.payload->>'n_rc' AS n_rc,
  r.payload->>'fecha_rc' AS fecha_rc,
  r.payload->>'valor_rc' AS valor_rc,
  r.payload->>'expediente' AS expediente,
  r.payload->>'responsable_apoyo_a_la_supervision' AS responsable_apoyo_a_la_supervision,
  r.payload->>'fecha_de_asignacion' AS fecha_de_asignacion,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'estado_de_ejecucion' AS estado_de_ejecucion,
  r.payload->>'fecha_inicio_orden' AS fecha_inicio_orden,
  r.payload->>'fecha_fin_orden' AS fecha_fin_orden,
  r.payload->>'ejecucion' AS ejecucion,
  r.payload->>'fecha_radicacion_expediente' AS fecha_radicacion_expediente,
  r.payload->>'tecnico_asignado' AS tecnico_asignado,
  r.payload->>'abogado_asignado_r_tecnica' AS abogado_asignado_r_tecnica,
  r.payload->>'financiero_asignado' AS financiero_asignado,
  r.payload->>'fecha_de_aval' AS fecha_de_aval,
  r.payload->>'cantidad_reiteraciones' AS cantidad_reiteraciones,
  r.payload->>'cantidad_observaciones' AS cantidad_observaciones,
  r.payload->>'dias_en_tecnico' AS dias_en_tecnico,
  r.payload->>'dias_en_proveedor' AS dias_en_proveedor,
  r.payload->>'dias_contractual' AS dias_contractual,
  r.payload->>'dias_financiera' AS dias_financiera,
  r.payload->>'dias_subdirector' AS dias_subdirector,
  r.payload->>'dias_subdireccion_general' AS dias_subdireccion_general,
  r.payload->>'dias_gafc' AS dias_gafc,
  r.payload->>'dias_fiduprevisora' AS dias_fiduprevisora,
  r.payload->>'dias_totales_en_la_linea' AS dias_totales_en_la_linea,
  r.payload->>'dias_en_gestion_de_pagos' AS dias_en_gestion_de_pagos,
  r.payload->>'n_ratificacion' AS n_ratificacion,
  r.payload->>'sd' AS sd,
  r.payload->>'valor_pagado' AS valor_pagado,
  r.payload->>'comprobante_de_egreso' AS comprobante_de_egreso,
  r.payload->>'voucher' AS voucher,
  r.payload->>'fecha_de_pago' AS fecha_de_pago,
  r.payload->>'op_paga' AS op_paga,
  r.payload->>'etapa' AS etapa,
  r.payload->>'estado_actual' AS estado_actual,
  r.payload->>'proceso_actual' AS proceso_actual,
  r.payload->>'dependencia' AS dependencia,
  r.payload->>'dias_desde_ult_gestion' AS dias_desde_ult_gestion,
  r.payload->>'fecha_ultimo_seguimiento' AS fecha_ultimo_seguimiento,
  r.payload->>'comentario_ult_seguimiento_a_supervision' AS comentario_ult_seguimiento_a_supervision,
  r.payload->>'novedades' AS novedades,
  r.payload->>'validaciom' AS validaciom,
  r.payload->>'administracion' AS administracion,
  r.payload->>'procesos_juridicos' AS procesos_juridicos,
  r.payload->>'nombre_orden' AS nombre_orden,
  r.payload->>'categorizacion' AS categorizacion
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('alta / orden', 'maqueta / orden'));

COMMENT ON VIEW agua.general IS 'Agua y Saneamiento — hoja Excel «General»';


DROP VIEW IF EXISTS agua.variables_lider CASCADE;
CREATE VIEW agua.variables_lider AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'administracion' AS administracion,
  r.payload->>'procesos_juridicos' AS procesos_juridicos,
  r.payload->>'nombre_orden' AS nombre_orden,
  r.payload->>'categorizacion' AS categorizacion,
  r.payload->>'responsable_apoyo_a_la_supervision' AS responsable_apoyo_a_la_supervision,
  r.payload->>'tecnico_asignado' AS tecnico_asignado,
  r.payload->>'abogado_asignado_r_tecnica' AS abogado_asignado_r_tecnica,
  r.payload->>'financiero_asignado' AS financiero_asignado,
  r.payload->>'fecha_de_aval' AS fecha_de_aval
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('variables líder', 'variables lider'));

COMMENT ON VIEW agua.variables_lider IS 'Agua y Saneamiento — hoja Excel «Variables líder»';


DROP VIEW IF EXISTS agua.modificaciones CASCADE;
CREATE VIEW agua.modificaciones AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'proveedor' AS proveedor,
  r.payload->>'num_modificacion' AS num_modificacion,
  r.payload->>'tipo_de_modificacion' AS tipo_de_modificacion,
  r.payload->>'modificacion' AS modificacion,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'plazo_de_ejecucion_dias' AS plazo_de_ejecucion_dias,
  r.payload->>'horas_maquina' AS horas_maquina,
  r.payload->>'dias_volqueta' AS dias_volqueta,
  r.payload->>'sin_info' AS sin_info,
  r.payload->>'forma_de_pago' AS forma_de_pago,
  r.payload->>'valor_parcial_1' AS valor_parcial_1,
  r.payload->>'valor_parcial_2' AS valor_parcial_2,
  r.payload->>'valor_parcial_3' AS valor_parcial_3,
  r.payload->>'observaciones' AS observaciones,
  r.payload->>'horas' AS horas,
  r.payload->>'verif' AS verif
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('modificación contractual', 'modificacion contractual', 'modificaciones'));

COMMENT ON VIEW agua.modificaciones IS 'Agua y Saneamiento — hoja Excel «modificaciones»';


DROP VIEW IF EXISTS agua.bitacora CASCADE;
CREATE VIEW agua.bitacora AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'fecha_estado' AS fecha_estado,
  r.payload->>'estado_macro' AS estado_macro,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'proceso' AS proceso,
  r.payload->>'dependencia' AS dependencia,
  r.payload->>'comentario' AS comentario
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('bitácora estado', 'bitacora estado', 'bitácora', 'bitacora'));

COMMENT ON VIEW agua.bitacora IS 'Agua y Saneamiento — hoja Excel «bitacora»';


DROP VIEW IF EXISTS agua.pagos CASCADE;
CREATE VIEW agua.pagos AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'orden_de_proveeduria_x_pago' AS orden_de_proveeduria_x_pago,
  r.payload->>'nit' AS nit,
  r.payload->>'proveedor' AS proveedor,
  r.payload->>'valor_op_parcial' AS valor_op_parcial,
  r.payload->>'ano' AS ano,
  r.payload->>'n_contrato' AS n_contrato,
  r.payload->>'sd_solicitud_de_desembolso' AS sd_solicitud_de_desembolso,
  r.payload->>'comprobante_de_egreso' AS comprobante_de_egreso,
  r.payload->>'voucher' AS voucher,
  r.payload->>'valor_pagado_sin_impuestos' AS valor_pagado_sin_impuestos,
  r.payload->>'valor_pagado_total_con_impuestos' AS valor_pagado_total_con_impuestos,
  r.payload->>'saldo_a_liberar' AS saldo_a_liberar,
  r.payload->>'fecha_de_pago' AS fecha_de_pago,
  r.payload->>'op_paga' AS op_paga,
  r.payload->>'saldo_por_liberar' AS saldo_por_liberar,
  r.payload->>'comentario_depuracion' AS comentario_depuracion,
  r.payload->>'odern_3' AS odern_3
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('pago / desembolso', 'pagos'));

COMMENT ON VIEW agua.pagos IS 'Agua y Saneamiento — hoja Excel «PAGOS»';


DROP VIEW IF EXISTS agua.cdps_y_rc CASCADE;
CREATE VIEW agua.cdps_y_rc AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'proveedor' AS proveedor,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'ano' AS ano,
  r.payload->>'no_cdp' AS no_cdp,
  r.payload->>'n_cdp' AS n_cdp,
  r.payload->>'fecha_cdp' AS fecha_cdp,
  r.payload->>'valor_cdp' AS valor_cdp,
  r.payload->>'no_rc' AS no_rc,
  r.payload->>'n_rc' AS n_rc,
  r.payload->>'fecha_rc' AS fecha_rc,
  r.payload->>'valor_rc' AS valor_rc,
  r.payload->>'valor_pagado' AS valor_pagado,
  r.payload->>'n_ratificacion' AS n_ratificacion,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('cdps y rc'));

COMMENT ON VIEW agua.cdps_y_rc IS 'Agua y Saneamiento — hoja Excel «CDPS Y RC»';


DROP VIEW IF EXISTS agua.bitacora_estructuracion CASCADE;
CREATE VIEW agua.bitacora_estructuracion AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'estado_de_ejecucion' AS estado_de_ejecucion,
  r.payload->>'semana_seguimiento' AS semana_seguimiento,
  r.payload->>'fecha_estado' AS fecha_estado,
  r.payload->>'comentario_semanal' AS comentario_semanal,
  r.payload->>'responsable_apoyo_a_la_supervision' AS responsable_apoyo_a_la_supervision,
  r.payload->>'fecha_de_asignacion' AS fecha_de_asignacion,
  r.payload->>'fecha_inicio_orden' AS fecha_inicio_orden,
  r.payload->>'fecha_fin_orden' AS fecha_fin_orden,
  r.payload->>'ejecucion' AS ejecucion,
  r.payload->>'expediente' AS expediente,
  r.payload->>'fecha_radicacion_expediente' AS fecha_radicacion_expediente
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('bitácora estructuración', 'bitacora estructuracion', 'seguimiento operativo'));

COMMENT ON VIEW agua.bitacora_estructuracion IS 'Agua y Saneamiento — hoja Excel «bitacora estructuracion»';


DROP VIEW IF EXISTS agua.control_y_seguimiento_detalle_m CASCADE;
CREATE VIEW agua.control_y_seguimiento_detalle_m AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '') AS orden_de_proveeduria,
  r.payload->>'tipo_de_orden' AS tipo_de_orden,
  r.payload->>'tipo_maquina' AS tipo_maquina,
  r.payload->>'nombre_orden' AS nombre_orden,
  r.payload->>'cntd_tanques_de_almacenamiento_de_agua_contratados' AS cntd_tanques_de_almacenamiento_de_agua_contratados,
  r.payload->>'capacidad_lts_tanques_contratados' AS capacidad_lts_tanques_contratados,
  r.payload->>'cantidad_carrotanques_contratadas' AS cantidad_carrotanques_contratadas,
  r.payload->>'capacidad_lt_crrt_contratadas' AS capacidad_lt_crrt_contratadas,
  r.payload->>'dias_suministro_crrt_contratada' AS dias_suministro_crrt_contratada,
  r.payload->>'cntd_vactor_contratadas' AS cntd_vactor_contratadas,
  r.payload->>'capacidad_lt_vactor_contratada' AS capacidad_lt_vactor_contratada,
  r.payload->>'dias_suministro_vactor_contratada' AS dias_suministro_vactor_contratada,
  r.payload->>'cantidad_maquinas_m_a_contratadas' AS cantidad_maquinas_m_a_contratadas,
  r.payload->>'horas_maquina_m_a' AS horas_maquina_m_a,
  r.payload->>'dias_volqueta_m_a_contratadas' AS dias_volqueta_m_a_contratadas,
  r.payload->>'cantidad_de_tanques_de_almacenamiento_de_agua_ejecutadas' AS cantidad_de_tanques_de_almacenamiento_de_agua_ejecutadas,
  r.payload->>'capacidad_lt_tanques_ejecutados' AS capacidad_lt_tanques_ejecutados,
  r.payload->>'cantidad_carrotanques_ejecutadas' AS cantidad_carrotanques_ejecutadas,
  r.payload->>'capacidad_lt_2_crrt' AS capacidad_lt_2_crrt,
  r.payload->>'dias_suministro_crrt' AS dias_suministro_crrt,
  r.payload->>'cntd_vactor_ejecutadas' AS cntd_vactor_ejecutadas,
  r.payload->>'capacidad_lt_vactor_ejecutadas' AS capacidad_lt_vactor_ejecutadas,
  r.payload->>'dias_suministro_vactor_ejecutadas' AS dias_suministro_vactor_ejecutadas,
  r.payload->>'cantidad_maquinas_m_a_ejecutadas' AS cantidad_maquinas_m_a_ejecutadas,
  r.payload->>'horas_maquina_m_a_ejecutadas' AS horas_maquina_m_a_ejecutadas,
  r.payload->>'dias_volqueta_m_a_ejecutadas' AS dias_volqueta_m_a_ejecutadas,
  r.payload->>'vigencia' AS vigencia,
  r.payload->>'proveedor' AS proveedor,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('control ejecución física', 'control ejecucion fisica'));

COMMENT ON VIEW agua.control_y_seguimiento_detalle_m IS 'Agua y Saneamiento — hoja Excel «control y seguimiento-detalle m»';
```

---

## 9. DDL canónico — schema `puentes` (extracto 003)

```sql
-- === Puentes → schema puentes ===
CREATE SCHEMA IF NOT EXISTS puentes;

DROP VIEW IF EXISTS puentes.contratos_estructuracion CASCADE;
CREATE VIEW puentes.contratos_estructuracion AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'contrato_convenio', r.payload->>'convenio_o_cto', '')), '') AS contrato_convenio,
  nullif(trim(coalesce(r.payload->>'clave_proceso', r.payload->>'clave_seguimiento', '')), '') AS clave_proceso,
  r.payload->>'tipo_vinculo' AS tipo_vinculo,
  r.payload->>'descripcion_proceso' AS descripcion_proceso,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'vigencia' AS vigencia,
  r.payload->>'tipo_proceso' AS tipo_proceso,
  r.payload->>'grupo' AS grupo,
  r.payload->>'etapa' AS etapa,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'area' AS area,
  r.payload->>'responsable' AS responsable,
  r.payload->>'fecha_inicio_proceso' AS fecha_inicio_proceso,
  r.payload->>'fecha_fin_proceso' AS fecha_fin_proceso,
  r.payload->>'plazo_ejecucion' AS plazo_ejecucion,
  r.payload->>'tiempo_etapa_dias' AS tiempo_etapa_dias,
  r.payload->>'tiempo_acumulado_dias' AS tiempo_acumulado_dias,
  r.payload->>'alerta' AS alerta,
  r.payload->>'comentarios' AS comentarios,
  r.payload->>'reporte' AS reporte,
  nullif(trim(coalesce(r.payload->>'convenio_o_cto', r.payload->>'contrato_convenio', '')), '') AS convenio_o_cto
FROM public.records r
WHERE r.theme_id = 'puentes'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('contrato estructuración', 'contrato estructuracion', 'contratos estructuracion'));

COMMENT ON VIEW puentes.contratos_estructuracion IS 'Puentes — hoja Excel «Contratos Estructuracion»';


DROP VIEW IF EXISTS puentes.base_general_puentes CASCADE;
CREATE VIEW puentes.base_general_puentes AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'id_puente', r.payload->>'id', r.payload->>'clave_seguimiento', '')), '') AS id_puente,
  nullif(trim(coalesce(r.payload->>'codigo_operativo', r.payload->>'id_unico', '')), '') AS codigo_operativo,
  r.payload->>'clase' AS clase,
  r.payload->>'tipo' AS tipo,
  r.payload->>'configuracion' AS configuracion,
  r.payload->>'ano_compra' AS ano_compra,
  r.payload->>'longitud_m' AS longitud_m,
  r.payload->>'capacidad_ton' AS capacidad_ton,
  r.payload->>'clasificacion_propiedad' AS clasificacion_propiedad,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'ubicacion_actual' AS ubicacion_actual,
  r.payload->>'region' AS region,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'personas_beneficiadas' AS personas_beneficiadas,
  r.payload->>'latitud' AS latitud,
  r.payload->>'longitud' AS longitud,
  r.payload->>'entidad_receptora' AS entidad_receptora,
  r.payload->>'estado_puente' AS estado_puente,
  r.payload->>'situacion_prestamo' AS situacion_prestamo,
  r.payload->>'fecha_inicio_estado_actual' AS fecha_inicio_estado_actual,
  r.payload->>'fecha_fin_estado_actual' AS fecha_fin_estado_actual,
  r.payload->>'fecha_desde_ultimo_estado' AS fecha_desde_ultimo_estado,
  r.payload->>'observaciones' AS observaciones,
  nullif(trim(coalesce(r.payload->>'contrato_convenio', r.payload->>'convenio_o_cto', r.payload->>'contrato', '')), '') AS contrato_convenio,
  r.payload->>'contrato' AS contrato,
  nullif(trim(coalesce(r.payload->>'clave_proceso', '')), '') AS clave_proceso,
  r.payload->>'tipo_vinculo' AS tipo_vinculo,
  r.payload->>'descripcion_proceso' AS descripcion_proceso,
  nullif(trim(coalesce(r.payload->>'convenio_o_cto', r.payload->>'contrato_convenio', r.payload->>'contrato', '')), '') AS convenio_o_cto,
  r.payload->>'id_unico' AS id_unico,
  r.payload->>'id' AS id,
  r.payload->>'origen_adquisicion' AS origen_adquisicion,
  r.payload->>'proceso_sigla' AS proceso_sigla,
  r.payload->>'numero_unidad' AS numero_unidad
FROM public.records r
WHERE r.theme_id = 'puentes'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('inventario puente', 'base general puentes'));

COMMENT ON VIEW puentes.base_general_puentes IS 'Puentes — hoja Excel «Base General Puentes»';


DROP VIEW IF EXISTS puentes.bitacora CASCADE;
CREATE VIEW puentes.bitacora AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  nullif(trim(coalesce(r.payload->>'id_puente', r.payload->>'id', r.payload->>'clave_seguimiento', '')), '') AS id_puente,
  nullif(trim(coalesce(r.payload->>'codigo_operativo', r.payload->>'id_unico', '')), '') AS codigo_operativo,
  r.payload->>'tipo' AS tipo,
  r.payload->>'cantidad_viajes' AS cantidad_viajes,
  r.payload->>'ubicacion_actual' AS ubicacion_actual,
  r.payload->>'region' AS region,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'vereda' AS vereda,
  r.payload->>'ente_receptor' AS ente_receptor,
  r.payload->>'situacion_prestamo' AS situacion_prestamo,
  r.payload->>'estado_puente' AS estado_puente,
  r.payload->>'fecha_inicio' AS fecha_inicio,
  r.payload->>'fecha_fin' AS fecha_fin,
  r.payload->>'fecha_corte_reporte' AS fecha_corte_reporte,
  r.payload->>'fundamento' AS fundamento,
  r.payload->>'observaciones' AS observaciones,
  r.payload->>'nombre_hoja_reporte' AS nombre_hoja_reporte,
  nullif(trim(coalesce(r.payload->>'convenio_o_cto', r.payload->>'contrato_convenio', r.payload->>'contrato', '')), '') AS convenio_o_cto,
  nullif(trim(coalesce(r.payload->>'contrato_convenio', r.payload->>'convenio_o_cto', r.payload->>'contrato', '')), '') AS contrato_convenio,
  nullif(trim(coalesce(r.payload->>'clave_proceso', '')), '') AS clave_proceso,
  r.payload->>'tipo_vinculo' AS tipo_vinculo,
  r.payload->>'id_unico' AS id_unico,
  r.payload->>'id' AS id
FROM public.records r
WHERE r.theme_id = 'puentes'
  AND r.deleted_at IS NULL
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('bitácora estado', 'bitacora estado', 'bitácora', 'bitacora'));

COMMENT ON VIEW puentes.bitacora IS 'Puentes — hoja Excel «bitacora»';
```

---

## 10. DDL canónico — aliases `medallion` + `v_connections` + `v_join_map` + grants (cola 003)

Incluye drops de nombres legacy, aliases `v_agua_*` / `v_puentes_*`, catálogos y
`GRANT` a `medallion_reader`.

```sql


-- Alias legacy medallion.v_* → hojas reales

DROP VIEW IF EXISTS medallion.v_agua_general CASCADE;
CREATE VIEW medallion.v_agua_general AS SELECT * FROM agua.general;


DROP VIEW IF EXISTS medallion.v_agua_maqueta CASCADE;
CREATE VIEW medallion.v_agua_maqueta AS SELECT * FROM agua.general;


DROP VIEW IF EXISTS medallion.v_agua_bitacora CASCADE;
CREATE VIEW medallion.v_agua_bitacora AS SELECT * FROM agua.bitacora;


DROP VIEW IF EXISTS medallion.v_agua_modificaciones CASCADE;
CREATE VIEW medallion.v_agua_modificaciones AS SELECT * FROM agua.modificaciones;


DROP VIEW IF EXISTS medallion.v_agua_pagos CASCADE;
CREATE VIEW medallion.v_agua_pagos AS SELECT * FROM agua.pagos;


DROP VIEW IF EXISTS medallion.v_agua_control CASCADE;
CREATE VIEW medallion.v_agua_control AS SELECT * FROM agua.control_y_seguimiento_detalle_m;


DROP VIEW IF EXISTS medallion.v_agua_cdps_rc CASCADE;
CREATE VIEW medallion.v_agua_cdps_rc AS SELECT * FROM agua.cdps_y_rc;


DROP VIEW IF EXISTS medallion.v_agua_variables_lider CASCADE;
CREATE VIEW medallion.v_agua_variables_lider AS SELECT * FROM agua.variables_lider;


DROP VIEW IF EXISTS medallion.v_agua_bitacora_estructuracion CASCADE;
CREATE VIEW medallion.v_agua_bitacora_estructuracion AS SELECT * FROM agua.bitacora_estructuracion;


DROP VIEW IF EXISTS medallion.v_agua_y_saneamiento_alta CASCADE;
CREATE VIEW medallion.v_agua_y_saneamiento_alta AS SELECT * FROM agua.general;


DROP VIEW IF EXISTS medallion.v_agua_y_saneamiento_bitacora CASCADE;
CREATE VIEW medallion.v_agua_y_saneamiento_bitacora AS SELECT * FROM agua.bitacora;


DROP VIEW IF EXISTS medallion.v_puentes_base_general CASCADE;
CREATE VIEW medallion.v_puentes_base_general AS SELECT * FROM puentes.base_general_puentes;


DROP VIEW IF EXISTS medallion.v_puentes_inventario CASCADE;
CREATE VIEW medallion.v_puentes_inventario AS SELECT * FROM puentes.base_general_puentes;


DROP VIEW IF EXISTS medallion.v_puentes_bitacora CASCADE;
CREATE VIEW medallion.v_puentes_bitacora AS SELECT * FROM puentes.bitacora;


DROP VIEW IF EXISTS medallion.v_puentes_estructuracion CASCADE;
CREATE VIEW medallion.v_puentes_estructuracion AS SELECT * FROM puentes.contratos_estructuracion;


DROP VIEW IF EXISTS medallion.v_puentes_contratos_estructuracion CASCADE;
CREATE VIEW medallion.v_puentes_contratos_estructuracion AS SELECT * FROM puentes.contratos_estructuracion;


DROP VIEW IF EXISTS medallion.v_carrotanques_all CASCADE;
CREATE VIEW medallion.v_carrotanques_all AS SELECT * FROM carrotanques.base;


DROP VIEW IF EXISTS medallion.v_obras_emergencia_all CASCADE;
CREATE VIEW medallion.v_obras_emergencia_all AS SELECT * FROM obras_emergencia.base;


DROP VIEW IF EXISTS medallion.v_banco_maquinaria_all CASCADE;
CREATE VIEW medallion.v_banco_maquinaria_all AS SELECT * FROM banco_maquinaria.base;


DROP VIEW IF EXISTS medallion.v_obras_impuestos_all CASCADE;
CREATE VIEW medallion.v_obras_impuestos_all AS SELECT * FROM obras_impuestos.base;


DROP VIEW IF EXISTS medallion.v_declaratoria_all CASCADE;
CREATE VIEW medallion.v_declaratoria_all AS SELECT * FROM declaratoria.base;


DROP VIEW IF EXISTS medallion.v_puentes_all CASCADE;
DROP VIEW IF EXISTS medallion.v_agua_all CASCADE;
DROP VIEW IF EXISTS medallion.v_agua_y_saneamiento_all CASCADE;
DROP VIEW IF EXISTS puentes.general CASCADE;
DROP VIEW IF EXISTS puentes.inventario CASCADE;
DROP VIEW IF EXISTS puentes.estructuracion CASCADE;
DROP VIEW IF EXISTS agua.maqueta CASCADE;
DROP VIEW IF EXISTS agua.control CASCADE;
DROP VIEW IF EXISTS agua.cdps_rc CASCADE;


DROP VIEW IF EXISTS medallion.v_connections CASCADE;
CREATE VIEW medallion.v_connections AS
SELECT * FROM (VALUES
  ('agua.general', 'agua', 'general', 'agua-y-saneamiento', 'General', 'Agua y Saneamiento — General', 'SELECT * FROM agua.general'),
  ('agua.variables_lider', 'agua', 'variables_lider', 'agua-y-saneamiento', 'Variables líder', 'Agua y Saneamiento — Variables líder', 'SELECT * FROM agua.variables_lider'),
  ('agua.modificaciones', 'agua', 'modificaciones', 'agua-y-saneamiento', 'modificaciones', 'Agua y Saneamiento — modificaciones', 'SELECT * FROM agua.modificaciones'),
  ('agua.bitacora', 'agua', 'bitacora', 'agua-y-saneamiento', 'bitacora', 'Agua y Saneamiento — bitacora', 'SELECT * FROM agua.bitacora'),
  ('agua.pagos', 'agua', 'pagos', 'agua-y-saneamiento', 'PAGOS', 'Agua y Saneamiento — PAGOS', 'SELECT * FROM agua.pagos'),
  ('agua.cdps_y_rc', 'agua', 'cdps_y_rc', 'agua-y-saneamiento', 'CDPS Y RC', 'Agua y Saneamiento — CDPS Y RC', 'SELECT * FROM agua.cdps_y_rc'),
  ('agua.bitacora_estructuracion', 'agua', 'bitacora_estructuracion', 'agua-y-saneamiento', 'bitacora estructuracion', 'Agua y Saneamiento — bitacora estructuracion', 'SELECT * FROM agua.bitacora_estructuracion'),
  ('agua.control_y_seguimiento_detalle_m', 'agua', 'control_y_seguimiento_detalle_m', 'agua-y-saneamiento', 'control y seguimiento-detalle m', 'Agua y Saneamiento — control y seguimiento-detalle m', 'SELECT * FROM agua.control_y_seguimiento_detalle_m'),
  ('carrotanques.base', 'carrotanques', 'base', 'carrotanques', 'base', 'Carrotanques — base', 'SELECT * FROM carrotanques.base'),
  ('obras_emergencia.base', 'obras_emergencia', 'base', 'obras-de-emergencia', 'base', 'Obras de Emergencia — base', 'SELECT * FROM obras_emergencia.base'),
  ('puentes.contratos_estructuracion', 'puentes', 'contratos_estructuracion', 'puentes', 'Contratos Estructuracion', 'Puentes — Contratos Estructuracion', 'SELECT * FROM puentes.contratos_estructuracion'),
  ('puentes.base_general_puentes', 'puentes', 'base_general_puentes', 'puentes', 'Base General Puentes', 'Puentes — Base General Puentes', 'SELECT * FROM puentes.base_general_puentes'),
  ('puentes.bitacora', 'puentes', 'bitacora', 'puentes', 'bitacora', 'Puentes — bitacora', 'SELECT * FROM puentes.bitacora'),
  ('banco_maquinaria.base', 'banco_maquinaria', 'base', 'banco-de-maquinaria', 'base', 'Banco de Maquinaria — base', 'SELECT * FROM banco_maquinaria.base'),
  ('obras_impuestos.base', 'obras_impuestos', 'base', 'obras-por-impuestos', 'base', 'Obras por impuestos — base', 'SELECT * FROM obras_impuestos.base'),
  ('asistencia_humanitaria.base', 'asistencia_humanitaria', 'base', 'asistencia-humanitaria', 'base', 'Asistencia Humanitaria — base', 'SELECT * FROM asistencia_humanitaria.base'),
  ('gestion_servicios.base', 'gestion_servicios', 'base', 'gestion-de-servicios', 'base', 'Gestión de Servicios — base', 'SELECT * FROM gestion_servicios.base'),
  ('subsidios_arriendos.base', 'subsidios_arriendos', 'base', 'subsidios-de-arriendos', 'base', 'Subsidios de Arriendos — base', 'SELECT * FROM subsidios_arriendos.base'),
  ('alertas_tempranas.base', 'alertas_tempranas', 'base', 'alertas-tempranas', 'base', 'Alertas tempranas — base', 'SELECT * FROM alertas_tempranas.base'),
  ('asistencia_tecnica.base', 'asistencia_tecnica', 'base', 'asistencia-tecnica', 'base', 'Asistencia técnica — base', 'SELECT * FROM asistencia_tecnica.base'),
  ('equipo_respuesta.base', 'equipo_respuesta', 'base', 'equipo-de-respuesta', 'base', 'Equipo de respuesta — base', 'SELECT * FROM equipo_respuesta.base'),
  ('compra_materiales.base', 'compra_materiales', 'base', 'compra-de-materiales', 'base', 'Compra de materiales — base', 'SELECT * FROM compra_materiales.base'),
  ('fic.base', 'fic', 'base', 'fic', 'base', 'FIC — base', 'SELECT * FROM fic.base'),
  ('convenios.base', 'convenios', 'base', 'convenios', 'base', 'Convenios — base', 'SELECT * FROM convenios.base'),
  ('presupuesto.base', 'presupuesto', 'base', 'presupuesto', 'base', 'Presupuesto — base', 'SELECT * FROM presupuesto.base'),
  ('ejecucion_financiera.base', 'ejecucion_financiera', 'base', 'ejecucion-financiera', 'base', 'Ejecución financiera — base', 'SELECT * FROM ejecucion_financiera.base'),
  ('materiales.base', 'materiales', 'base', 'materiales', 'base', 'Materiales — base', 'SELECT * FROM materiales.base'),
  ('declaratoria.base', 'declaratoria', 'base', 'declaratoria-de-emergencia', 'base', 'Declaratoria de emergencia — base', 'SELECT * FROM declaratoria.base')
) AS t(connection_id, schema_name, table_name, theme_id, sheet, description, sample_sql);

DROP VIEW IF EXISTS medallion.v_source_catalog CASCADE;
CREATE VIEW medallion.v_source_catalog AS
SELECT
  connection_id AS source_id,
  (schema_name || '.' || table_name) AS view_name,
  theme_id,
  sheet AS capa,
  description
FROM medallion.v_connections;

-- Mapa de JOIN intra-schema (solo dentro del mismo tema; no cruzar schemas)
DROP VIEW IF EXISTS medallion.v_join_map CASCADE;
CREATE VIEW medallion.v_join_map AS
SELECT * FROM (VALUES
  ('puentes', 'puentes.bitacora', 'puentes.base_general_puentes', 'id_puente', 'primaria', 'Activo: evento bitácora → puente inventario', 'SELECT b.*, i.clase, i.estado_puente FROM puentes.bitacora b JOIN puentes.base_general_puentes i ON i.id_puente = b.id_puente'),
  ('puentes', 'puentes.bitacora', 'puentes.base_general_puentes', 'codigo_operativo', 'secundaria', 'ID UNICO (alias legible del activo)', 'SELECT b.*, i.* FROM puentes.bitacora b JOIN puentes.base_general_puentes i ON i.codigo_operativo = b.codigo_operativo'),
  ('puentes', 'puentes.bitacora', 'puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Proceso: bitácora → contrato (también convenio_o_cto / contrato_convenio)', 'SELECT b.*, e.etapa, e.estado FROM puentes.bitacora b JOIN puentes.contratos_estructuracion e ON e.clave_proceso = b.clave_proceso'),
  ('puentes', 'puentes.bitacora', 'puentes.contratos_estructuracion', 'convenio_o_cto', 'alternativa', 'Columna Excel bitácora «convenio o cto» = contrato', 'SELECT b.*, e.* FROM puentes.bitacora b JOIN puentes.contratos_estructuracion e ON e.convenio_o_cto = b.convenio_o_cto'),
  ('puentes', 'puentes.base_general_puentes', 'puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Inventario → proceso de estructuración', 'SELECT i.*, e.etapa FROM puentes.base_general_puentes i JOIN puentes.contratos_estructuracion e ON e.clave_proceso = i.clave_proceso'),
  ('agua', 'agua.bitacora', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une bitácora con maqueta/General', 'SELECT b.*, g.proveedor, g.estado_actual FROM agua.bitacora b JOIN agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria'),
  ('agua', 'agua.pagos', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une pagos con General', 'SELECT p.*, g.proveedor FROM agua.pagos p JOIN agua.general g ON g.orden_de_proveeduria = p.orden_de_proveeduria'),
  ('agua', 'agua.cdps_y_rc', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une CDPS/RC con General', 'SELECT c.*, g.objeto FROM agua.cdps_y_rc c JOIN agua.general g ON g.orden_de_proveeduria = c.orden_de_proveeduria'),
  ('agua', 'agua.modificaciones', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une modificaciones con General', 'SELECT m.*, g.proveedor FROM agua.modificaciones m JOIN agua.general g ON g.orden_de_proveeduria = m.orden_de_proveeduria'),
  ('agua', 'agua.bitacora_estructuracion', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une bitácora estructuración con General', 'SELECT be.*, g.municipio FROM agua.bitacora_estructuracion be JOIN agua.general g ON g.orden_de_proveeduria = be.orden_de_proveeduria'),
  ('agua', 'agua.control_y_seguimiento_detalle_m', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une control físico con General', 'SELECT ct.*, g.tipo_de_orden FROM agua.control_y_seguimiento_detalle_m ct JOIN agua.general g ON g.orden_de_proveeduria = ct.orden_de_proveeduria'),
  ('agua', 'agua.variables_lider', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une variables líder con General', 'SELECT v.*, g.objeto FROM agua.variables_lider v JOIN agua.general g ON g.orden_de_proveeduria = v.orden_de_proveeduria'),
  ('agua', 'agua.pagos', 'agua.bitacora', 'orden_de_proveeduria', 'secundaria', 'Misma OP entre satélites (historial distinto)', 'SELECT p.orden_de_proveeduria, count(DISTINCT b.record_id) AS eventos FROM agua.pagos p LEFT JOIN agua.bitacora b ON b.orden_de_proveeduria = p.orden_de_proveeduria GROUP BY 1')
) AS t(schema_name, left_table, right_table, join_key, priority, description, sample_sql);


DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA medallion TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA medallion TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA medallion GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA agua TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA agua TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA agua GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA carrotanques TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA carrotanques TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA carrotanques GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA obras_emergencia TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA obras_emergencia TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA obras_emergencia GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA puentes TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA puentes TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA puentes GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA banco_maquinaria TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA banco_maquinaria TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA banco_maquinaria GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA obras_impuestos TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA obras_impuestos TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA obras_impuestos GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA asistencia_humanitaria TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA asistencia_humanitaria TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA asistencia_humanitaria GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA gestion_servicios TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA gestion_servicios TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA gestion_servicios GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA subsidios_arriendos TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA subsidios_arriendos TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA subsidios_arriendos GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA alertas_tempranas TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA alertas_tempranas TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA alertas_tempranas GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA asistencia_tecnica TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA asistencia_tecnica TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA asistencia_tecnica GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA equipo_respuesta TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA equipo_respuesta TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA equipo_respuesta GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA compra_materiales TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA compra_materiales TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA compra_materiales GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA fic TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA fic TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA fic GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA convenios TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA convenios TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA convenios GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA presupuesto TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA presupuesto TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA presupuesto GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA ejecucion_financiera TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA ejecucion_financiera TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ejecucion_financiera GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA materiales TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA materiales TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA materiales GRANT SELECT ON TABLES TO medallion_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA declaratoria TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA declaratoria TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA declaratoria GRANT SELECT ON TABLES TO medallion_reader';
  END IF;
END $$;
```

---

## 11. Regenerar este paquete

```bash
npm run medallion:generate
# actualizar este doc si cambian columnas / JOIN
# re-aplicar 001 + 003 en prod (SQL Editor o psql admin)
```

Docs hermanos:

- [`MEDALLION-DATA-CONTRACT.md`](./MEDALLION-DATA-CONTRACT.md)
- [`MEDALLION-SOURCE-CATALOG.md`](./MEDALLION-SOURCE-CATALOG.md)

---

## 12. Blurb para pegar al colega

```text
Handoff medallón UNGRD (Puentes + Agua) — solo lectura:

📄 docs/platform/MEDALLION-DDL-HANDOFF.md
📄 docs/platform/MEDALLION-SILVER.md   ← modelo relacional (recomendado Alibaba)

Bronze (vistas tipadas / compat):
  agua.general (+ bitacora, pagos, …) | puentes.base_general_puentes | bitacora | contratos
  medallion.v_bronze_* | v_connections | v_join_map

Silver (tablas físicas PK/FK — usar para JOINs relacionales):
  silver_agua.orden (dim OP) + silver_agua.general + satélites
  silver_puentes.base_general_puentes | bitacora | contratos_estructuracion
  medallion.v_silver_catalog | v_silver_join_map

Conexión: medallion_reader @ pooler Supabase (password aparte / MEDALLION_DATABASE_URL)
Envelope: record_id, theme_id, source, created_at, updated_at [, synced_at en Silver]
JOIN solo intra-schema (OP / id_puente / clave_proceso)

Estado prod (2026-08-06): Bronze 001+003 + Silver 010/011 sincronizados.
Sync: npm run medallion:sync-silver | Test: npm run medallion:test-silver
```
