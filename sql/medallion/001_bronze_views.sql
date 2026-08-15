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
-- Solo datos operativos reales: excluye seed/demo/harness (captura usa form|excel).
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
WHERE r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW medallion.v_bronze_records IS
  'Crudo operativo real (sin seed/demo/harness). payload = campos del tema.';

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
