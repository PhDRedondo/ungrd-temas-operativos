-- Ejecutar en Supabase → SQL Editor (como postgres).
-- Host: db.vbxvqctdemtnmkifrxeo.supabase.co
--
-- Orden recomendado:
--   1) Este archivo (crea schema + rol lector)
--   2) sql/medallion/001_bronze_views.sql
--   3) sql/medallion/003_theme_capa_views.sql
--
-- Cambia 'CAMBIAR_PASSWORD_FUERTE' antes de ejecutar.

BEGIN;

-- Schema de lectura (por si aún no corrieron 001)
CREATE SCHEMA IF NOT EXISTS medallion;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
    CREATE ROLE medallion_reader LOGIN PASSWORD 'CAMBIAR_PASSWORD_FUERTE';
  ELSE
    ALTER ROLE medallion_reader WITH LOGIN PASSWORD 'CAMBIAR_PASSWORD_FUERTE';
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
