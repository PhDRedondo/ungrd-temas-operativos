# Capa Silver — modelo relacional (Agua + Puentes)

Plantilla operativa para el lake / Alibaba: **tablas físicas** con PK/FK sobre
las vistas Bronze tipadas. La captura y `public.records` **no cambian**.

| Meta | Valor |
|------|--------|
| Fecha | 2026-08-06 |
| Schemas | `silver_agua`, `silver_puentes` |
| Bronze (compat) | `agua.*`, `puentes.*`, `medallion.v_*` (vistas; intactas) |
| Sync | `npm run medallion:sync-silver` |
| DDL | `sql/medallion/010_silver_tables.sql` + `011_silver_grants.sql` |
| Generador | `scripts/generate-medallion-silver.ts` |
| Test reader | `npm run medallion:test-silver` |
| Password | **Nunca en este doc** |

---

## 1. Arquitectura

```text
OLTP (untouched)     public.records
        │
        ▼
Bronze / compat      agua.* / puentes.* / medallion.v_*   (vistas tipadas)
        │  sync truncate+reload
        ▼
Silver (físico)      silver_agua.* / silver_puentes.*     (PK/FK/índices)
        │
        ▼
Reader               medallion_reader → GRANT SELECT
```

**Reglas:**

1. No modificar captura, upload ni escritura a `public.records`.
2. No romper vistas Bronze (`agua.*` / `puentes.*`).
3. JOINs **solo intra-schema** (`silver_agua` ↔ `silver_agua`, nunca Agua↔Puentes).
4. `record_id` = linaje a `public.records.id` (PK en todas las tablas de hechos).
5. `synced_at` = marca del último sync.
6. **Solo datos operativos reales:** Silver se alimenta de Bronze, que ya filtra
   `deleted_at IS NULL` y excluye `source ∈ {seed, demo, harness, smoke, test}`.
   La captura legítima (`form` / `excel`) no se ve afectada.

---

## 2. Modelo Agua (`silver_agua`)

Datos reales (prod 2026-08-06, post-filtro seed): `general` tiene **1 fila por OP**
(**107** excel; 0 seed). Dim `orden` = **112** (OPs huérfanas en satélites).

```text
                 ┌── general (1:1 OP, UNIQUE orden_de_proveeduria)
                 ├── bitacora (1:N)
silver_agua.orden ──├── pagos
   (dim PK OP)     ├── modificaciones
                 ├── cdps_y_rc
                 ├── bitacora_estructuracion
                 ├── control_y_seguimiento_detalle_m
                 └── variables_lider
```

| Tabla | Rol | PK | Unicidad / FK |
|-------|-----|----|---------------|
| `orden` | Dim hub | `orden_de_proveeduria` | Unión de OPs de todas las hojas |
| `general` | Hub Excel | `record_id` | `UNIQUE(orden_de_proveeduria)` + FK → `orden` |
| satélites | Hechos | `record_id` | FK → `orden` (permite huérfanas vs General) |

JOIN analítico típico (LEFT si puede faltar General):

```sql
SELECT b.*, g.proveedor, g.municipio
FROM silver_agua.bitacora b
LEFT JOIN silver_agua.general g
  ON g.orden_de_proveeduria = b.orden_de_proveeduria;
```

Catálogo / mapa:

```sql
SELECT * FROM medallion.v_silver_catalog WHERE schema_name = 'silver_agua';
SELECT * FROM medallion.v_silver_join_map WHERE schema_name = 'silver_agua';
```

---

## 3. Modelo Puentes (`silver_puentes`)

Verificado en prod: `id_puente` único en inventario; `clave_proceso` y
`convenio_o_cto` únicos en contratos; bitácora sin huérfanos de `id_puente`.

```text
contratos_estructuracion ──clave_proceso──► base_general_puentes ──id_puente──► bitacora
         UNIQUE(clave_proceso)                 UNIQUE(id_puente)                 FK
         UNIQUE(convenio_o_cto)                FK clave_proceso (nullable)       FK clave (nullable)
```

| Tabla | PK | Unicidad / FK |
|-------|----|---------------|
| `contratos_estructuracion` | `record_id` | `UNIQUE(clave_proceso)`, `UNIQUE(convenio_o_cto)` |
| `base_general_puentes` | `record_id` | `UNIQUE(id_puente)`; FK `clave_proceso` → contratos |
| `bitacora` | `record_id` | FK `id_puente` → inventario; FK `clave_proceso` → contratos |

```sql
SELECT b.*, i.clase, e.etapa
FROM silver_puentes.bitacora b
JOIN silver_puentes.base_general_puentes i ON i.id_puente = b.id_puente
LEFT JOIN silver_puentes.contratos_estructuracion e
  ON e.clave_proceso = b.clave_proceso;
```

---

## 4. Operación (sync)

```bash
# 1) Regenerar DDL desde vistas Bronze live (o parse 003)
npm run medallion:generate-silver

# 2) Aplicar DDL (admin postgres Session :5432)
npm run medallion:silver-ddl
# equivalente: npx tsx scripts/sync-medallion-silver.ts --ddl-only

# 3) Truncate + reload (idempotente)
npm run medallion:sync-silver
# o DDL+sync: npx tsx scripts/sync-medallion-silver.ts --apply-ddl

# 4) Verificar reader
npm run medallion:test-silver
npm run medallion:test-reader   # Bronze sigue OK
```

**Credenciales:**

- Escritura: `DATABASE_URL` de prod pooler **o** admin derivado de
  `MEDALLION_DATABASE_URL` (user `postgres.<project-ref>`, mismo password,
  host pooler Session **5432**). Local `127.0.0.1` no es prod.
- Lectura: `MEDALLION_DATABASE_URL` (`medallion_reader`).

**Estrategia de sync:** transacción con `SET CONSTRAINTS ALL DEFERRED` +
`TRUNCATE … CASCADE` (Agua desde `orden`) / truncate explícito (Puentes) +
`INSERT … SELECT` desde vistas Bronze. Conteos Silver ≈ Bronze; dim
`silver_agua.orden` puede ser **mayor** que `general` (OPs huérfanas).

---

## 5. Checklist — nuevo tema Silver

1. Tener vistas Bronze tipadas en `sql/medallion/003` (`npm run medallion:generate`).
2. Extender `scripts/generate-medallion-silver.ts`:
   - `SCHEMA` nuevo (`silver_<tema>`).
   - Lista de hojas / tablas.
   - Dim hub si hay llave de negocio con huérfanos (patrón `orden`).
   - UNIQUE en hub si 1 fila por llave (verificar con SQL antes).
   - FKs DEFERRABLE; índices en llaves de JOIN y geo.
3. `npm run medallion:generate-silver` → revisar `010` / `011` / manifest.
4. Aplicar en prod: `--apply-ddl` + sync + `medallion:test-silver`.
5. Documentar en este archivo + handoff + catálogo (sin passwords).
6. **No** tocar `src/app`, forms ni write-path a `records`.

---

## 6. Qué usar en Alibaba / BI

| Necesidad | Usar |
|-----------|------|
| Modelo relacional con FKs | **`silver_agua.*` / `silver_puentes.*`** |
| Compat / vistas tipadas | `agua.*` / `puentes.*` (Bronze) |
| JSONB crudo | `medallion.v_bronze_records` |
| Mapa JOIN Silver | `medallion.v_silver_join_map` |
| Mapa JOIN Bronze | `medallion.v_join_map` |

---

## 7. Archivos

| Archivo | Rol |
|---------|-----|
| `scripts/generate-medallion-silver.ts` | Genera 010/011 + manifest |
| `scripts/sync-medallion-silver.ts` | DDL apply + sync |
| `scripts/test-medallion-silver.ts` | Reader + FKs + JOINs |
| `scripts/lib/medallion-db-url.ts` | Mask + admin URL desde reader |
| `scripts/generated/silver-sync-manifest.json` | Columnas por tabla (sync) |
| `sql/medallion/010_silver_tables.sql` | DDL tablas/FK/índices/catálogo |
| `sql/medallion/011_silver_grants.sql` | Grants reader |
