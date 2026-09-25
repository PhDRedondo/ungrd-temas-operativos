-- Todo Manejo: OP Center es la base.
-- Los formularios y las líneas ya desarrolladas alimentan filas nuevas.
-- Si la clave ya está en OP Center, no se duplica.
-- Quick BI: SELECT * FROM medallion.v_manejo_consolidado;

CREATE SCHEMA IF NOT EXISTS medallion;

DROP VIEW IF EXISTS medallion.v_manejo_consolidado;
CREATE VIEW medallion.v_manejo_consolidado AS
WITH candidatos AS (
  SELECT
    r.id,
    r.theme_id,
    r.departamento,
    r.municipio,
    r.estado,
    r.valor,
    r.fecha,
    r.payload,
    CASE
      WHEN r.payload->>'_kind' = 'op-center' THEN 'OP Center'
      WHEN r.payload->>'_kind' IN ('seguimiento-hoja', 'manejo-mqa')
        OR lower(coalesce(r.payload->>'clave_seguimiento', '')) LIKE 'seguimiento:%'
        THEN 'Formulario seguimiento'
      ELSE 'Formulario de la línea'
    END AS origen,
    CASE
      WHEN r.theme_id = 'ejecucion-financiera' THEN coalesce(nullif(r.payload->>'modalidad', ''), 'sin modalidad')
      WHEN r.theme_id = 'banco-de-maquinaria' AND r.payload->>'capa' = 'Convenio o proceso' THEN 'convenio'
      WHEN r.theme_id = 'banco-de-maquinaria' THEN 'orden de proveeduría'
      WHEN r.theme_id = 'asistencia-humanitaria' THEN 'orden de proveeduría'
      WHEN r.theme_id = 'convenios' THEN 'convenio'
      WHEN r.theme_id = 'fic' THEN 'transferencia'
      WHEN r.theme_id IN ('obras-de-emergencia', 'obras-por-impuestos', 'puentes') THEN 'contrato'
      WHEN r.theme_id = 'subsidios-de-arriendos' THEN 'subsidio'
      WHEN r.theme_id IN ('agua-y-saneamiento', 'carrotanques') THEN 'agua'
      ELSE 'otra'
    END AS modalidad,
    CASE
      WHEN r.theme_id = 'banco-de-maquinaria' AND coalesce(r.payload->>'linea', '') = '' THEN 'Banco de maquinaria'
      ELSE coalesce(nullif(r.payload->>'linea', ''), nullif(r.payload->>'tipo_registro', ''), '')
    END AS linea,
    upper(trim(coalesce(
      nullif(r.payload->>'serial', ''),
      nullif(r.payload->>'orden_de_proveeduria', ''),
      nullif(r.payload->>'no_orden_de_compra', ''),
      nullif(r.payload->>'clave_seguimiento', ''),
      nullif(r.payload->>'no_convenio', ''),
      nullif(r.payload->>'no_cdp', ''),
      r.id::text
    ))) AS clave_norm,
    coalesce(
      nullif(r.payload->>'serial', ''),
      nullif(r.payload->>'orden_de_proveeduria', ''),
      nullif(r.payload->>'no_orden_de_compra', ''),
      nullif(r.payload->>'clave_seguimiento', ''),
      nullif(r.payload->>'no_convenio', ''),
      nullif(r.payload->>'no_cdp', ''),
      r.id::text
    ) AS clave,
    coalesce(
      nullif(r.payload->>'detalle', ''),
      nullif(r.payload->>'objeto', ''),
      nullif(r.payload->>'descripcion', ''),
      ''
    ) AS detalle,
    coalesce(nullif(r.payload->>'resolucion', ''), nullif(r.payload->>'resolucion_hoja', ''), '') AS resolucion,
    coalesce(r.payload->>'pestana', '') AS pestana
  FROM public.records r
  WHERE r.deleted_at IS NULL
    AND (
      r.theme_id IN (
        'banco-de-maquinaria',
        'asistencia-humanitaria',
        'convenios',
        'fic',
        'obras-de-emergencia',
        'obras-por-impuestos',
        'puentes',
        'subsidios-de-arriendos',
        'agua-y-saneamiento',
        'carrotanques'
      )
      OR (
        r.theme_id = 'ejecucion-financiera'
        AND (
          r.payload->>'_kind' IN ('seguimiento-hoja', 'manejo-mqa', 'op-center')
          OR lower(coalesce(r.payload->>'clave_seguimiento', '')) LIKE 'seguimiento:%'
        )
      )
    )
),
ranked AS (
  SELECT
    c.*,
    row_number() OVER (
      PARTITION BY c.clave_norm
      ORDER BY
        CASE WHEN c.origen = 'OP Center' THEN 0 ELSE 1 END,
        CASE WHEN c.payload->>'capa' = 'Bitácora convenio' THEN 1 ELSE 0 END,
        c.fecha DESC NULLS LAST,
        c.id
    ) AS rn
  FROM candidatos c
)
SELECT
  id,
  theme_id,
  origen,
  modalidad,
  linea,
  clave,
  detalle,
  departamento,
  municipio,
  estado,
  valor,
  fecha,
  resolucion,
  pestana
FROM ranked
WHERE rn = 1;

COMMENT ON VIEW medallion.v_manejo_consolidado IS
  'OP Center más lo nuevo de formularios y líneas, una fila por clave. Quick BI: SELECT * FROM medallion.v_manejo_consolidado;';
