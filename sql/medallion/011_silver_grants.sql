-- AUTO-GENERADO: npx tsx scripts/generate-medallion-silver.ts
-- Grants SELECT Silver → medallion_reader (+ default privileges)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA silver_agua TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA silver_agua TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA silver_agua GRANT SELECT ON TABLES TO medallion_reader';

    EXECUTE 'GRANT USAGE ON SCHEMA silver_puentes TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA silver_puentes TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA silver_puentes GRANT SELECT ON TABLES TO medallion_reader';

    EXECUTE 'GRANT USAGE ON SCHEMA medallion TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA medallion TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA medallion GRANT SELECT ON TABLES TO medallion_reader';
  END IF;
END $$;
