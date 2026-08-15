# Contrato de datos — Medallón UNGRD Temas Operativos

Guía para el equipo de datos: cómo **leer** la base operativa hoy, mapearla a
arquitectura medallón (bronze → silver → gold) y qué cambia (casi nada) cuando
migremos de Supabase a otro PostgreSQL.

---

## 1. Qué entregarles hoy (checklist)

| Entregable | Ubicación | Para qué |
|------------|-----------|----------|
| Este contrato | `docs/platform/MEDALLION-DATA-CONTRACT.md` | Modelo mental + llaves + capas |
| Catálogo de fuentes | `docs/platform/MEDALLION-SOURCE-CATALOG.md` | Qué vista usar por “base” |
| Vistas bronze (SQL) | `sql/medallion/001_bronze_views.sql` | Crudo: columnas de `records` + `payload` |
| Vistas por tema/capa | `sql/medallion/003_theme_capa_views.sql` | **Columnas = campos reales del tema** |
| Silver físico | `sql/medallion/010_silver_tables.sql` + [`MEDALLION-SILVER.md`](./MEDALLION-SILVER.md) | PK/FK Agua+Puentes |
| Generador 003 | `scripts/generate-medallion-theme-views.ts` | Regenera 003 desde `theme.ts` |
| Generador / sync Silver | `medallion:generate-silver` · `medallion:sync-silver` | Truncate+reload |
| Script de export | `scripts/export-medallion-bronze.ts` | Snapshot JSON/CSV + catálogo de campos |
| Modelo de tablas | `src/db/schema.ts` + este doc | DDL canónico (no depende del vendor) |
| Análisis por tema | `docs/platform/DATA-MODEL-ANALYSIS.md` | Capas Excel ↔ capas app |

**Para tableros / lake tipado por tema:** usar tablas por hoja Excel
(`agua.general`, `puentes.bitacora`, `puentes.base_general_puentes`, …) o
aliases `medallion.v_*` (archivo 003). Cada vista incluye **todas** las
columnas de la hoja/formulario.  
**No** usar el bronze viejo con columnas cruzadas; `v_bronze_records` solo
lleva columnas fijas + `payload` jsonb.

**Solo datos operativos reales:** las vistas Bronze (y por tanto Silver) excluyen
soft-deleted y fuentes de prueba (`seed` / `demo` / `harness` / `smoke` / `test`).
Captura real = `source` `form` o `excel`.

**No necesitan** acceso al código de captura ni a Vercel. Solo:

1. Cadena de conexión **solo-lectura** a Postgres (`DATABASE_URL` read replica o rol `SELECT`).
2. Este paquete (vistas + contrato + export de muestra).

Cuando migren el host: **misma DDL, mismo `theme_id`, mismo JSONB**. Solo cambia el endpoint/credencial.

---

## 2. Principio de portabilidad

```text
App Next.js  ──►  PostgreSQL (Supabase hoy / RDS / Cloud SQL mañana)
                      │
                      ├── public.themes / records / …   (fuente de verdad operativa)
                      └── medallion.v_bronze_*          (contrato de lectura)
                                 │
                                 ▼
                      Lake / Warehouse (bronze → silver → gold)
```

| Cambia al migrar | No cambia |
|------------------|-----------|
| Host, puerto, usuario, password, SSL | Nombres de tablas/columnas |
| Connection string / secret del orquestador | `theme_id`, capas, llaves de negocio |
| Pooler vs direct | Forma del `payload` JSONB |

La app ya usa solo `DATABASE_URL`. El medallón debe hacer lo mismo.

---

## 3. Mapa medallón propuesto

### Bronze — copia fiel (append / snapshot)

Fuente: vistas `medallion.v_bronze_*` o export del script.

| Objeto bronze | Origen | Notas |
|---------------|--------|-------|
| `bronze_themes` | `themes` | Catálogo + `field_schema` (definición de columnas lógicas) |
| `bronze_records` | `records` activos | 1 fila = 1 captura / evento |
| `bronze_records_deleted` | `records` con `deleted_at` | Soft-delete; no mezclar en silver “vigente” |
| `bronze_record_versions` | `record_versions` | Historial de ediciones |
| `bronze_uploads` | `uploads` | Metadatos de cargas Excel |
| `bronze_audit_log` | `audit_log` | Auditoría app (opcional) |

**Regla bronze:** no transformar el JSONB. Guardar `payload` completo + columnas fijas.

Ingesta sugerida: incremental por `updated_at` / `created_at` (CDC o poll cada N min).

### Silver — tipado relacional (físico, con PK/FK)

**Live en prod (2026-08-06):** schemas `silver_agua` y `silver_puentes` —
tablas físicas sincronizadas desde las vistas Bronze tipadas. Guía completa:
[`MEDALLION-SILVER.md`](./MEDALLION-SILVER.md).

| Schema | Hub / dim | Hechos (hoja Excel) | Llave JOIN |
|--------|-----------|---------------------|------------|
| `silver_agua` | `orden` (dim OP) + `general` | bitacora, pagos, modificaciones, … | `orden_de_proveeduria` |
| `silver_puentes` | `contratos_estructuracion`, `base_general_puentes` | bitacora | `id_puente` / `clave_proceso` |

- PK hechos: `record_id` (linaje a `public.records`).
- Bronze tipado (`agua.*` / `puentes.*`) **sigue vigente** como capa compat.
- Sync: `npm run medallion:sync-silver` · test: `npm run medallion:test-silver`.
- Catálogo: `medallion.v_silver_catalog` · JOIN: `medallion.v_silver_join_map`.

Para Alibaba / analítica relacional preferir **Silver**; para lectura tipada
sin FKs físicas, Bronze sigue OK.

### Gold — indicadores y cruces

Agregados territoriales (DIVIPOLA), seguimiento por clave, cruces entre temas
(Agua ↔ Obras emergencia por OP/contrato). Aquí vive el “tablero”.

---

## 3.1 Mapa de JOIN **intra-schema** (obligatorio)

Las tablas tipadas viven en schemas cortos (`puentes`, `agua`, …).
**Solo se unen tablas del mismo schema.** No hay JOIN `puentes.*` ↔ `agua.*`.

Catálogo vivo en DB: `SELECT * FROM medallion.v_join_map;`

### Schema `puentes`

```text
contratos_estructuracion ──clave_proceso──► base_general_puentes ──id_puente──► bitacora
         │                         │                              │
         └──── convenio_o_cto ─────┴──── contrato_convenio ───────┘
              (texto Excel «convenio o cto» / Contrato)
```

| Relación | Llave primaria | Alternativa |
|----------|----------------|-------------|
| `bitacora` ↔ `base_general_puentes` | `id_puente` | `codigo_operativo` (ID UNICO) |
| `bitacora` ↔ `contratos_estructuracion` | `clave_proceso` | `convenio_o_cto` |
| `base_general_puentes` ↔ `contratos_estructuracion` | `clave_proceso` | `contrato_convenio` / `convenio_o_cto` |

`puentes.bitacora` **siempre** expone `convenio_o_cto`, `contrato_convenio` y
`clave_proceso` (heredadas del puente / Excel). Sin esas columnas el JOIN de
proceso no cierra.

### Schema `agua`

```text
agua.general (OP) ──orden_de_proveeduria──► bitacora | pagos | cdps_y_rc |
                                            modificaciones | bitacora_estructuracion |
                                            control_y_seguimiento_detalle_m | variables_lider
```

| Relación | Llave |
|----------|-------|
| Cualquier satélite ↔ `agua.general` | `orden_de_proveeduria` |
| Satélite ↔ satélite | `orden_de_proveeduria` |

Detalle y SQL de ejemplo: [`MEDALLION-SOURCE-CATALOG.md`](./MEDALLION-SOURCE-CATALOG.md).

---

## 4. Esquema operativo canónico (`public`)

### 4.1 `themes`

| Columna | Tipo | Significado |
|---------|------|-------------|
| `id` | text PK | Slug estable (`puentes`, `agua-y-saneamiento`, …) |
| `name` | text | Nombre UI |
| `schema_version` | int | Versión del formulario |
| `field_schema` | jsonb | Array de campos `{ name, label, type, … }` |
| `updated_at` | timestamptz | |

### 4.2 `records` — tabla central

| Columna | Tipo | Significado |
|---------|------|-------------|
| `id` | uuid PK | ID técnico inmutable |
| `theme_id` | text FK → themes | Tema |
| `departamento` | text | DIVIPOLA (canónico app) |
| `municipio` | text | DIVIPOLA |
| `fecha` | date | Fecha “ancla” del registro |
| `estado` | text | Estado resumido (columna fija) |
| `valor` | numeric(18,2) | Valor monetario / métrica fija |
| `payload` | jsonb | **Todos** los campos del tema (capa, llaves, detalle) |
| `source` | text | `form` \| `excel` \| … |
| `content_hash` | text | Dedup por tema |
| `upload_id` | uuid? | Carga masiva origen |
| `created_by` | uuid? | Usuario |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz? | Soft-delete (`NULL` = vigente) |

Índices útiles para ingesta: `(theme_id, updated_at)`, `(theme_id, fecha)`.

### 4.3 Campos críticos **dentro** de `payload`

Comunes a casi todos los temas:

| Clave JSON | Uso |
|------------|-----|
| `capa` / `tipo_registro` | Capa operativa (inventario, bitácora, …) |
| `clave_seguimiento` | Llave canónica de seguimiento del activo/OP |
| `departamento` / `municipio` | Espejo geo (puede repetir columnas fijas) |

**Puentes** (prioridad actual):

| Clave | Nivel | Notas |
|-------|-------|-------|
| `clave_proceso` / `contrato_convenio` | Proceso (1 : N) | Nace en Estructuración |
| `id_puente` | Activo (# interno) | Columna Excel `ID UNICO` |
| `codigo_operativo` | Activo (ID único legible) | Excel 2.º `ID UNICO` — ej. `…-ACROW-18` |
| `convenio_o_cto` | Etiqueta filtro Excel | **No** es llave única del puente |
| `origen_adquisicion` / `proceso_sigla` | Derivadas | Facetas |

**Agua:**

| Clave | Nivel |
|-------|-------|
| `orden_de_proveeduria` | OP (activo de seguimiento) |
| capas: Alta/Maqueta, Bitácora, Control, Pagos, … | |

### 4.4 Otras tablas

- `record_versions` — cada PATCH versionado
- `uploads` — archivos Excel procesados
- `users` / `user_theme_access` — IAM app (normalmente **fuera** del lake de negocio)
- Esquemas `iam` / `workflow` / `core` — plataforma de casos (opcional; ver `database-model.md`)

---

## 5. Cómo jalar hoy

### Opción A — Rol solo-lectura + vistas (recomendado)

```bash
# 1. Aplicar vistas (una vez, con privilegio admin DB)
psql "$DATABASE_URL" -f sql/medallion/001_bronze_views.sql

# 2. Crear rol lector (ejemplo — password aparte)
psql "$DATABASE_URL" -f sql/medallion/002_reader_role.example.sql
```

El ETL se conecta con ese rol y hace:

```sql
SELECT * FROM medallion.v_bronze_records
WHERE updated_at > :watermark
ORDER BY updated_at;
```

### Opción B — Export snapshot (sin acceso permanente)

```bash
# Desde el repo, con DATABASE_URL apuntando a la DB (local o prod read)
DATABASE_URL=postgresql://... npx tsx scripts/export-medallion-bronze.ts
# → exports/medallion/<timestamp>/
```

Salida típica:

```text
exports/medallion/2026-08-06T13-00-00Z/
  manifest.json          # conteos, temas, watermark
  themes.json            # catálogo + field_schema
  schema_columns.json    # information_schema
  records/
    puentes.jsonl
    agua-y-saneamiento.jsonl
    …
```

### Opción C — API app (menos ideal para lake)

`GET /api/themes/:slug/records` requiere sesión y no está pensada para CDC.
Usar solo si no hay red a Postgres.

---

## 6. Contrato de estabilidad (SLA de schema)

Compromisos para el equipo de datos:

1. **No renombrar** `theme_id` existentes (`puentes`, `agua-y-saneamiento`, …).
2. **No quitar** columnas fijas de `records` sin aviso + migración versionada.
3. Campos nuevos van en `payload` + `themes.field_schema` (schemaVersion ↑).
4. Soft-delete: filas vigentes = `deleted_at IS NULL`.
5. Vistas `medallion.v_bronze_*` se versionan en `sql/medallion/`; si hay breaking change, nuevo archivo `002_…`.

Al cambiar de proveedor Postgres: recrear vistas con el mismo SQL; re-apuntar el secret `DATABASE_URL`.

---

## 7. Seguridad

- Rol lector: `SELECT` únicamente; sin `INSERT/UPDATE/DELETE`.
- No exportar `users.password` (no hay; auth es Auth.js/Keycloak).
- `audit_log` y ACL: incluir solo si el lake tiene control de acceso equivalente.
- Credenciales de prod: vault / secret manager; nunca en el repo.

---

## 8. Primeros pasos sugeridos (equipo medallón)

1. Aplicar `001_bronze_views.sql` en el entorno de lectura.
2. Correr `export-medallion-bronze.ts` una vez y validar conteos vs UI.
3. Definir tablas bronze en el lake espejo de las vistas.
4. Silver Puentes: 3 tablas por capa + dim proceso / dim activo.
5. Silver Agua: por capa usando `orden_de_proveeduria`.
6. Gold: KPIs territoriales + línea de tiempo por `clave_seguimiento`.

---

## 9. Referencias

- DDL Drizzle: [`src/db/schema.ts`](../../src/db/schema.ts)
- Capas / llaves por tema: [`DATA-MODEL-ANALYSIS.md`](./DATA-MODEL-ANALYSIS.md)
- Plataforma casos: [`database-model.md`](./database-model.md)
- Tema Puentes: [`src/themes/puentes/README.md`](../../src/themes/puentes/README.md)
