-- Arregla: permission denied to set role "medallion_reader"
-- Ejecutar en Supabase SQL Editor como postgres.

-- 1) Permitir que postgres (y el SQL Editor) asuman el rol
GRANT medallion_reader TO postgres;

-- 2) Asegurar login + password (pon el MISMO de .env.local)
ALTER ROLE medallion_reader WITH LOGIN PASSWORD 'CAMBIAR_PASSWORD_FUERTE';

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
