-- AUTO-GENERADO: npx tsx scripts/generate-medallion-theme-views.ts
-- Tablas = hojas Excel (mismos nombres). Ej.:
--   SELECT * FROM puentes.base_general_puentes;
--   SELECT * FROM puentes.bitacora;  -- incluye convenio_o_cto
--   SELECT * FROM agua.general;

CREATE SCHEMA IF NOT EXISTS medallion;


-- Quitar nombres legacy (all / general / inventario inventados)
DROP VIEW IF EXISTS puentes.general CASCADE;
DROP VIEW IF EXISTS puentes.inventario CASCADE;
DROP VIEW IF EXISTS puentes.estructuracion CASCADE;
DROP VIEW IF EXISTS puentes.all CASCADE;
DROP VIEW IF EXISTS agua.maqueta CASCADE;
DROP VIEW IF EXISTS agua.control CASCADE;
DROP VIEW IF EXISTS agua.cdps_rc CASCADE;
DROP VIEW IF EXISTS carrotanques.general CASCADE;
DROP VIEW IF EXISTS obras_emergencia.general CASCADE;
DROP VIEW IF EXISTS banco_maquinaria.general CASCADE;
DROP VIEW IF EXISTS obras_impuestos.general CASCADE;
DROP VIEW IF EXISTS declaratoria.general CASCADE;
DROP VIEW IF EXISTS medallion.v_puentes_all CASCADE;
DROP VIEW IF EXISTS medallion.v_puentes_inventario CASCADE;
DROP VIEW IF EXISTS medallion.v_agua_all CASCADE;
DROP VIEW IF EXISTS medallion.v_agua_y_saneamiento_all CASCADE;

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
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
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
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND ((lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('variables líder', 'variables lider')) OR ((lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('alta / orden', 'maqueta / orden')) AND (nullif(trim(coalesce(r.payload->>'administracion', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'procesos_juridicos', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'categorizacion', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'tecnico_asignado', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'fecha_de_aval', '')), '') IS NOT NULL)));

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
  coalesce(nullif(trim(r.payload->>'modificacion'), ''), nullif(trim(r.payload->>'tipo_de_modificacion'), ''), nullif(trim(r.payload->>'Modificación'), '')) AS modificacion,
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
  coalesce(nullif(trim(r.payload->>'observaciones'), ''), nullif(trim(r.payload->>'obs'), ''), nullif(trim(r.payload->>'Observaciones'), ''), nullif(trim(r.payload->>'comentarios'), ''), nullif(trim(r.payload->>'comentario'), '')) AS observaciones,
  r.payload->>'horas' AS horas,
  r.payload->>'verif' AS verif
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
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
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
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
  coalesce(nullif(trim(r.payload->>'orden_de_proveeduria_x_pago'), ''), nullif(trim(r.payload->>'orden_de_proveeduria'), ''), nullif(trim(r.payload->>'clave_seguimiento'), '')) AS orden_de_proveeduria_x_pago,
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
  coalesce(nullif(trim(r.payload->>'saldo_por_liberar'), ''), nullif(trim(r.payload->>'saldo_a_liberar'), '')) AS saldo_por_liberar,
  r.payload->>'comentario_depuracion' AS comentario_depuracion,
  r.payload->>'odern_3' AS odern_3
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
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
  coalesce(nullif(trim(r.payload->>'observaciones'), ''), nullif(trim(r.payload->>'obs'), ''), nullif(trim(r.payload->>'Observaciones'), '')) AS observaciones
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND ((lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('cdps y rc', 'cdps', 'cdp y rc')) OR ((lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('alta / orden', 'maqueta / orden')) AND (nullif(trim(coalesce(r.payload->>'n_cdp', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'fecha_cdp', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'no_cdp', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'n_rc', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'fecha_rc', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'no_rc', '')), '') IS NOT NULL)));

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
  coalesce(nullif(trim(r.payload->>'estado_de_ejecucion'), ''), nullif(trim(r.payload->>'estado_de_ejecucion_orden'), ''), nullif(trim(r.payload->>'estado'), '')) AS estado_de_ejecucion,
  r.payload->>'semana_seguimiento' AS semana_seguimiento,
  r.payload->>'fecha_estado' AS fecha_estado,
  r.payload->>'comentario_semanal' AS comentario_semanal,
  r.payload->>'responsable_apoyo_a_la_supervision' AS responsable_apoyo_a_la_supervision,
  r.payload->>'fecha_de_asignacion' AS fecha_de_asignacion,
  coalesce(nullif(trim(r.payload->>'fecha_inicio_orden'), ''), nullif(trim(r.payload->>'fecha_inicio'), '')) AS fecha_inicio_orden,
  coalesce(nullif(trim(r.payload->>'fecha_fin_orden'), ''), nullif(trim(r.payload->>'fecha_fin'), '')) AS fecha_fin_orden,
  r.payload->>'ejecucion' AS ejecucion,
  r.payload->>'expediente' AS expediente,
  r.payload->>'fecha_radicacion_expediente' AS fecha_radicacion_expediente
FROM public.records r
WHERE r.theme_id = 'agua-y-saneamiento'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND ((lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('bitácora estructuración', 'bitacora estructuracion', 'seguimiento operativo')) OR ((lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('alta / orden', 'maqueta / orden')) AND (nullif(trim(coalesce(r.payload->>'semana_seguimiento', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'comentario_semanal', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'estado_de_ejecucion', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'fecha_inicio_orden', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'fecha_fin_orden', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'fecha_radicacion_expediente', '')), '') IS NOT NULL OR nullif(trim(coalesce(r.payload->>'expediente', '')), '') IS NOT NULL)));

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
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('control ejecución física', 'control ejecucion fisica', 'control y seguimiento-detalle m', 'control y seguimiento detalle m'));

COMMENT ON VIEW agua.control_y_seguimiento_detalle_m IS 'Agua y Saneamiento — hoja Excel «control y seguimiento-detalle m»';


-- === Carrotanques → schema carrotanques ===
CREATE SCHEMA IF NOT EXISTS carrotanques;

DROP VIEW IF EXISTS carrotanques.alta_maqueta CASCADE;
CREATE VIEW carrotanques.alta_maqueta AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'placa' AS placa,
  r.payload->>'placa_ungrd' AS placa_ungrd,
  r.payload->>'clase' AS clase,
  r.payload->>'marca' AS marca,
  r.payload->>'modelo_ref' AS modelo_ref,
  r.payload->>'serial' AS serial,
  r.payload->>'modelo' AS modelo,
  r.payload->>'ano_compra' AS ano_compra,
  r.payload->>'capacidad_lt' AS capacidad_lt
FROM public.records r
WHERE r.theme_id = 'carrotanques'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('maqueta / inventario'));

COMMENT ON VIEW carrotanques.alta_maqueta IS 'Carrotanques — hoja Excel «alta_maqueta»';


DROP VIEW IF EXISTS carrotanques.actualizar_categorias CASCADE;
CREATE VIEW carrotanques.actualizar_categorias AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'placa' AS placa,
  r.payload->>'otras_categorizaciones' AS otras_categorizaciones,
  r.payload->>'clasificacion_propiedad' AS clasificacion_propiedad
FROM public.records r
WHERE r.theme_id = 'carrotanques'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('maqueta / inventario'));

COMMENT ON VIEW carrotanques.actualizar_categorias IS 'Carrotanques — hoja Excel «actualizar_categorias»';


DROP VIEW IF EXISTS carrotanques.bitacora CASCADE;
CREATE VIEW carrotanques.bitacora AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'placa' AS placa,
  r.payload->>'marca' AS marca,
  r.payload->>'ubicacion_actual' AS ubicacion_actual,
  r.payload->>'region' AS region,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'ente_receptor' AS ente_receptor,
  r.payload->>'situacion_de_prestamo' AS situacion_de_prestamo,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'fecha_inicio_estado_actual' AS fecha_inicio_estado_actual,
  r.payload->>'fech_fin_estado_actual' AS fech_fin_estado_actual,
  r.payload->>'fecha_corte_del_reporte' AS fecha_corte_del_reporte,
  r.payload->>'cantidad_de_viajes' AS cantidad_de_viajes,
  r.payload->>'fundamento' AS fundamento,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'carrotanques'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('bitácora estado', 'bitacora estado', 'bitácora', 'bitacora'));

COMMENT ON VIEW carrotanques.bitacora IS 'Carrotanques — hoja Excel «bitacora»';


DROP VIEW IF EXISTS carrotanques.suministro CASCADE;
CREATE VIEW carrotanques.suministro AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'placa' AS placa,
  r.payload->>'cap_gls' AS cap_gls,
  r.payload->>'cap_lts' AS cap_lts,
  r.payload->>'ente_receptor_sitio_de_suministro' AS ente_receptor_sitio_de_suministro,
  r.payload->>'region' AS region,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'litros_suministrados' AS litros_suministrados,
  r.payload->>'personas_beneficiadas' AS personas_beneficiadas,
  r.payload->>'comunidades_beneficiadas' AS comunidades_beneficiadas,
  r.payload->>'fecha_corte_del_reporte' AS fecha_corte_del_reporte,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'carrotanques'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('suministro / viajes'));

COMMENT ON VIEW carrotanques.suministro IS 'Carrotanques — hoja Excel «suministro»';


-- === Obras de Emergencia → schema obras_emergencia ===
CREATE SCHEMA IF NOT EXISTS obras_emergencia;

DROP VIEW IF EXISTS obras_emergencia.base CASCADE;
CREATE VIEW obras_emergencia.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'capa' AS capa,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'orden_de_proveeduria' AS orden_de_proveeduria,
  r.payload->>'id' AS id,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'contrato_de_obra' AS contrato_de_obra,
  r.payload->>'divipola' AS divipola,
  r.payload->>'lugar' AS lugar,
  r.payload->>'obra_realizada' AS obra_realizada,
  r.payload->>'objeto_del_contrato' AS objeto_del_contrato,
  r.payload->>'latitud' AS latitud,
  r.payload->>'longitud' AS longitud,
  r.payload->>'contratista' AS contratista,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'estado_de_pago' AS estado_de_pago,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'plazo' AS plazo,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  r.payload->>'fecha_finalizacion_uno' AS fecha_finalizacion_uno,
  r.payload->>'no_cdp' AS no_cdp,
  r.payload->>'no_rc' AS no_rc,
  r.payload->>'anticipo' AS anticipo,
  r.payload->>'porcentaje_anticipo' AS porcentaje_anticipo,
  r.payload->>'valor_anticipo' AS valor_anticipo,
  r.payload->>'modificacion_contractual' AS modificacion_contractual,
  r.payload->>'otrosi_uno' AS otrosi_uno,
  r.payload->>'tipo_otrosi_uno' AS tipo_otrosi_uno,
  r.payload->>'tiempo_prorroga_uno' AS tiempo_prorroga_uno,
  r.payload->>'adicion_uno' AS adicion_uno,
  r.payload->>'cdp_prorroga_uno' AS cdp_prorroga_uno,
  r.payload->>'rc_prorroga_uno' AS rc_prorroga_uno,
  r.payload->>'fecha_finalizacion_dos' AS fecha_finalizacion_dos,
  r.payload->>'justificacion_modificacion_contractual_uno' AS justificacion_modificacion_contractual_uno,
  r.payload->>'otrosi_dos' AS otrosi_dos,
  r.payload->>'tipo_otrosi_dos' AS tipo_otrosi_dos,
  r.payload->>'tiempo_prorroga_dos' AS tiempo_prorroga_dos,
  r.payload->>'adicion_dos' AS adicion_dos,
  r.payload->>'cdp_mod_contract' AS cdp_mod_contract,
  r.payload->>'rc_mod_contrac' AS rc_mod_contrac,
  r.payload->>'fecha_finalizacion_tres' AS fecha_finalizacion_tres,
  r.payload->>'justificacion_mod_cont_dos' AS justificacion_mod_cont_dos,
  r.payload->>'otrosi_tres' AS otrosi_tres,
  r.payload->>'tipo_otrosi_tres' AS tipo_otrosi_tres,
  r.payload->>'tiempo_prorroga_tres' AS tiempo_prorroga_tres,
  r.payload->>'adicion_tres' AS adicion_tres,
  r.payload->>'fecha_finalizacion_cuatro' AS fecha_finalizacion_cuatro,
  r.payload->>'justificacion_mod_cont_tres' AS justificacion_mod_cont_tres,
  r.payload->>'avance_fisico_ejecutado' AS avance_fisico_ejecutado,
  r.payload->>'avance_financiero_ejecutado' AS avance_financiero_ejecutado,
  r.payload->>'avance_fisico_programado' AS avance_fisico_programado,
  r.payload->>'cuentas_de_cobro_tramitadas' AS cuentas_de_cobro_tramitadas,
  r.payload->>'observaciones' AS observaciones,
  r.payload->>'contrato_de_interventoria' AS contrato_de_interventoria,
  r.payload->>'objeto_contrato_de_interventoria' AS objeto_contrato_de_interventoria,
  r.payload->>'contratista_cont_interv' AS contratista_cont_interv,
  r.payload->>'supervisor_conti_nterv' AS supervisor_conti_nterv,
  r.payload->>'valor_cont_interv' AS valor_cont_interv,
  r.payload->>'plazo_cont_interv' AS plazo_cont_interv,
  r.payload->>'acta_de_inicio_fecha_inicial' AS acta_de_inicio_fecha_inicial,
  r.payload->>'acta_de_inicio_fecha_final' AS acta_de_inicio_fecha_final,
  r.payload->>'cdp_cont_interv' AS cdp_cont_interv,
  r.payload->>'rc_cont_interv' AS rc_cont_interv,
  r.payload->>'modificacion_contrac_cont_interv' AS modificacion_contrac_cont_interv,
  r.payload->>'otrosi_uno_cont_interv' AS otrosi_uno_cont_interv,
  r.payload->>'tipo_otrosi_cont_inter' AS tipo_otrosi_cont_inter,
  r.payload->>'tiempo_prorroga_cont_interv' AS tiempo_prorroga_cont_interv,
  r.payload->>'adicion_prorroga_cont_interv' AS adicion_prorroga_cont_interv,
  r.payload->>'cdp_prorroga_cont_interv' AS cdp_prorroga_cont_interv,
  r.payload->>'rc_prorroga_cont_interv' AS rc_prorroga_cont_interv,
  r.payload->>'fecha_de_finalizacion_cont_interv' AS fecha_de_finalizacion_cont_interv,
  r.payload->>'justificacion_mod_contractual_cont_int' AS justificacion_mod_contractual_cont_int,
  r.payload->>'otrosi_interv_dos' AS otrosi_interv_dos,
  r.payload->>'tipo_otrosi_interv_dos' AS tipo_otrosi_interv_dos,
  r.payload->>'tiempo_interv_dos' AS tiempo_interv_dos,
  r.payload->>'adicion_interv_dos' AS adicion_interv_dos,
  r.payload->>'cdp_mod_contract_interv' AS cdp_mod_contract_interv,
  r.payload->>'rc_mod_contrac_interv' AS rc_mod_contrac_interv,
  r.payload->>'fecha_finalizacion_interv_tres' AS fecha_finalizacion_interv_tres,
  r.payload->>'justificacion_mod_cont_interv_dos' AS justificacion_mod_cont_interv_dos,
  r.payload->>'avance_fisico_ejecutado_cont_interv' AS avance_fisico_ejecutado_cont_interv,
  r.payload->>'avance_financiero_ejecutado_cont_interv' AS avance_financiero_ejecutado_cont_interv,
  r.payload->>'avance_fisico_programado_cont_interv' AS avance_fisico_programado_cont_interv,
  r.payload->>'cuenta_de_cobro_tramitadas_cont_interv' AS cuenta_de_cobro_tramitadas_cont_interv,
  r.payload->>'minuta_y_obs_cont_interv' AS minuta_y_obs_cont_interv,
  r.payload->>'tipo_de_contrato' AS tipo_de_contrato,
  r.payload->>'horas_maquina' AS horas_maquina,
  r.payload->>'dias_volqueta' AS dias_volqueta,
  r.payload->>'proveedor' AS proveedor,
  r.payload->>'nit' AS nit,
  r.payload->>'representante_legal' AS representante_legal,
  r.payload->>'cc_representante_legal' AS cc_representante_legal,
  r.payload->>'telefono_contratista' AS telefono_contratista,
  r.payload->>'correo_contratista' AS correo_contratista,
  r.payload->>'fecha_orden' AS fecha_orden,
  r.payload->>'fecha_aceptacion' AS fecha_aceptacion,
  r.payload->>'fecha_de_activacion' AS fecha_de_activacion,
  r.payload->>'fecha_finalizacion' AS fecha_finalizacion,
  r.payload->>'alcance_uno' AS alcance_uno,
  r.payload->>'tipo_alcance_uno' AS tipo_alcance_uno,
  r.payload->>'alcance_dos' AS alcance_dos,
  r.payload->>'tipo_alcance_dos' AS tipo_alcance_dos,
  r.payload->>'tiempo_de_prorroga_dos' AS tiempo_de_prorroga_dos,
  r.payload->>'cdp_prorroga_dos' AS cdp_prorroga_dos,
  r.payload->>'rc_prorroga_dos' AS rc_prorroga_dos,
  r.payload->>'justificacion_modificacion_contractual_dos' AS justificacion_modificacion_contractual_dos,
  r.payload->>'alcance_tres' AS alcance_tres,
  r.payload->>'tipo_alcance_tres' AS tipo_alcance_tres,
  r.payload->>'tiempo_de_prorroga_tres' AS tiempo_de_prorroga_tres,
  r.payload->>'cdp_prorroga_tres' AS cdp_prorroga_tres,
  r.payload->>'rc_prorroga_tres' AS rc_prorroga_tres,
  r.payload->>'justificacion_modificacion_contractual_tres' AS justificacion_modificacion_contractual_tres,
  r.payload->>'alcance_cuatro' AS alcance_cuatro,
  r.payload->>'tipo_alcance_cuatro' AS tipo_alcance_cuatro,
  r.payload->>'tiempo_de_prorroga_cuatro' AS tiempo_de_prorroga_cuatro,
  r.payload->>'adicion_cuatro' AS adicion_cuatro,
  r.payload->>'cdp_prorroga_cuatro' AS cdp_prorroga_cuatro,
  r.payload->>'rc_prorroga_cuatro' AS rc_prorroga_cuatro,
  r.payload->>'fecha_finalizacion_cinco' AS fecha_finalizacion_cinco,
  r.payload->>'porcentaje_avance_financiero_ejecutado' AS porcentaje_avance_financiero_ejecutado,
  r.payload->>'porcentaje_avance_fisico_ejecutado' AS porcentaje_avance_fisico_ejecutado,
  r.payload->>'porcentaje_avance_fisico_programado' AS porcentaje_avance_fisico_programado
FROM public.records r
WHERE r.theme_id = 'obras-de-emergencia'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW obras_emergencia.base IS 'Obras de Emergencia — base';


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
  coalesce(nullif(trim(r.payload->>'contrato_convenio'), ''), nullif(trim(r.payload->>'convenio_o_cto'), '')) AS contrato_convenio,
  coalesce(nullif(trim(r.payload->>'clave_proceso'), ''), nullif(trim(r.payload->>'clave_seguimiento'), '')) AS clave_proceso,
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
  coalesce(nullif(trim(r.payload->>'convenio_o_cto'), ''), nullif(trim(r.payload->>'contrato_convenio'), '')) AS convenio_o_cto
FROM public.records r
WHERE r.theme_id = 'puentes'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
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
  coalesce(nullif(trim(r.payload->>'id_puente'), ''), nullif(trim(r.payload->>'id'), ''), nullif(trim(r.payload->>'clave_seguimiento'), '')) AS id_puente,
  coalesce(nullif(trim(r.payload->>'codigo_operativo'), ''), nullif(trim(r.payload->>'id_unico'), '')) AS codigo_operativo,
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
  coalesce(nullif(trim(r.payload->>'estado'), ''), nullif(trim(r.payload->>'Estado'), '')) AS estado,
  r.payload->>'estado_puente' AS estado_puente,
  r.payload->>'situacion_prestamo' AS situacion_prestamo,
  r.payload->>'fecha_inicio_estado_actual' AS fecha_inicio_estado_actual,
  r.payload->>'fecha_fin_estado_actual' AS fecha_fin_estado_actual,
  r.payload->>'fecha_desde_ultimo_estado' AS fecha_desde_ultimo_estado,
  r.payload->>'observaciones' AS observaciones,
  coalesce(nullif(trim(r.payload->>'contrato_convenio'), ''), nullif(trim(r.payload->>'convenio_o_cto'), ''), nullif(trim(r.payload->>'contrato'), '')) AS contrato_convenio,
  r.payload->>'contrato' AS contrato,
  coalesce(nullif(trim(r.payload->>'clave_proceso'), '')) AS clave_proceso,
  r.payload->>'tipo_vinculo' AS tipo_vinculo,
  r.payload->>'descripcion_proceso' AS descripcion_proceso,
  coalesce(nullif(trim(r.payload->>'convenio_o_cto'), ''), nullif(trim(r.payload->>'contrato_convenio'), ''), nullif(trim(r.payload->>'contrato'), '')) AS convenio_o_cto,
  r.payload->>'id_unico' AS id_unico,
  r.payload->>'id' AS id,
  r.payload->>'origen_adquisicion' AS origen_adquisicion,
  r.payload->>'proceso_sigla' AS proceso_sigla,
  r.payload->>'numero_unidad' AS numero_unidad
FROM public.records r
WHERE r.theme_id = 'puentes'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
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
  coalesce(nullif(trim(r.payload->>'id_puente'), ''), nullif(trim(r.payload->>'id'), ''), nullif(trim(r.payload->>'clave_seguimiento'), '')) AS id_puente,
  coalesce(nullif(trim(r.payload->>'codigo_operativo'), ''), nullif(trim(r.payload->>'id_unico'), '')) AS codigo_operativo,
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
  coalesce(nullif(trim(r.payload->>'fecha_inicio'), ''), nullif(trim(r.payload->>'fecha_inicio_proceso'), '')) AS fecha_inicio,
  coalesce(nullif(trim(r.payload->>'fecha_fin'), ''), nullif(trim(r.payload->>'fecha_fin_proceso'), '')) AS fecha_fin,
  r.payload->>'fecha_corte_reporte' AS fecha_corte_reporte,
  r.payload->>'fundamento' AS fundamento,
  coalesce(nullif(trim(r.payload->>'observaciones'), ''), nullif(trim(r.payload->>'fundamento'), ''), nullif(trim(r.payload->>'comentarios'), '')) AS observaciones,
  r.payload->>'nombre_hoja_reporte' AS nombre_hoja_reporte,
  coalesce(nullif(trim(r.payload->>'convenio_o_cto'), ''), nullif(trim(r.payload->>'contrato_convenio'), ''), nullif(trim(r.payload->>'contrato'), '')) AS convenio_o_cto,
  coalesce(nullif(trim(r.payload->>'contrato_convenio'), ''), nullif(trim(r.payload->>'convenio_o_cto'), ''), nullif(trim(r.payload->>'contrato'), '')) AS contrato_convenio,
  coalesce(nullif(trim(r.payload->>'clave_proceso'), '')) AS clave_proceso,
  r.payload->>'tipo_vinculo' AS tipo_vinculo,
  r.payload->>'id_unico' AS id_unico,
  r.payload->>'id' AS id
FROM public.records r
WHERE r.theme_id = 'puentes'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('bitácora estado', 'bitacora estado', 'bitácora', 'bitacora'));

COMMENT ON VIEW puentes.bitacora IS 'Puentes — hoja Excel «bitacora»';


-- === Banco de Maquinaria → schema banco_maquinaria ===
CREATE SCHEMA IF NOT EXISTS banco_maquinaria;

DROP VIEW IF EXISTS banco_maquinaria.alta_convenio CASCADE;
CREATE VIEW banco_maquinaria.alta_convenio AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'no_convenio' AS no_convenio,
  r.payload->>'objeto' AS objeto,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'entidad_receptora' AS entidad_receptora,
  coalesce(nullif(trim(r.payload->>'cantidad_maquinaria_expectativa'), ''), nullif(trim(r.payload->>'cantidad_maquinaria_espectativa'), '')) AS cantidad_maquinaria_expectativa,
  r.payload->>'cantidad_maquinaria_entregada' AS cantidad_maquinaria_entregada,
  r.payload->>'tiempo_de_ejecucion' AS tiempo_de_ejecucion,
  r.payload->>'fecha_acta_de_inicio' AS fecha_acta_de_inicio,
  r.payload->>'no_cdp' AS no_cdp,
  r.payload->>'fecha_cdp' AS fecha_cdp,
  r.payload->>'no_rc' AS no_rc,
  r.payload->>'fecha_de_rc' AS fecha_de_rc,
  coalesce(nullif(trim(r.payload->>'valor_total'), ''), nullif(trim(r.payload->>'valor_sin_iva'), '')) AS valor_total,
  r.payload->>'valor_aporte_municipio' AS valor_aporte_municipio,
  coalesce(nullif(trim(r.payload->>'valor_aporte_gobernacion'), '')) AS valor_aporte_gobernacion,
  r.payload->>'valor_aporte_ungrd' AS valor_aporte_ungrd,
  r.payload->>'responsable_juridico' AS responsable_juridico,
  r.payload->>'responsable_financiero' AS responsable_financiero,
  r.payload->>'responsable_tecnico' AS responsable_tecnico,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'banco-de-maquinaria'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('convenio o proceso'));

COMMENT ON VIEW banco_maquinaria.alta_convenio IS 'Banco de Maquinaria — hoja Excel «alta_convenio»';


DROP VIEW IF EXISTS banco_maquinaria.alta_detalle CASCADE;
CREATE VIEW banco_maquinaria.alta_detalle AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'no_maquina' AS no_maquina,
  r.payload->>'referencia' AS referencia,
  r.payload->>'nit' AS nit,
  r.payload->>'empresa' AS empresa,
  r.payload->>'entidad_receptora' AS entidad_receptora,
  r.payload->>'tipo_maquinaria' AS tipo_maquinaria,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'serial' AS serial,
  r.payload->>'n_motor' AS n_motor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  r.payload->>'fecha_entrega_o_recibo' AS fecha_entrega_o_recibo,
  r.payload->>'ano_modelo' AS ano_modelo,
  r.payload->>'placa' AS placa,
  r.payload->>'chasis_camabaja' AS chasis_camabaja,
  r.payload->>'placa_camabaja' AS placa_camabaja,
  r.payload->>'linea' AS linea,
  r.payload->>'modelo_y_o_referencia' AS modelo_y_o_referencia,
  r.payload->>'modalidad' AS modalidad,
  r.payload->>'no_orden_de_compra' AS no_orden_de_compra,
  r.payload->>'encargado' AS encargado,
  r.payload->>'cargo_encargad' AS cargo_encargad,
  coalesce(nullif(trim(r.payload->>'estado_maquina'), ''), nullif(trim(r.payload->>'estado'), '')) AS estado_maquina,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'banco-de-maquinaria'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('maqueta / inventario'));

COMMENT ON VIEW banco_maquinaria.alta_detalle IS 'Banco de Maquinaria — hoja Excel «alta_detalle»';


DROP VIEW IF EXISTS banco_maquinaria.bitacora_convenio CASCADE;
CREATE VIEW banco_maquinaria.bitacora_convenio AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'no_convenio' AS no_convenio,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  coalesce(nullif(trim(r.payload->>'fecha_de_estado'), ''), nullif(trim(r.payload->>'fecha'), '')) AS fecha_de_estado,
  r.payload->>'comentario' AS comentario
FROM public.records r
WHERE r.theme_id = 'banco-de-maquinaria'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('bitácora convenio'));

COMMENT ON VIEW banco_maquinaria.bitacora_convenio IS 'Banco de Maquinaria — hoja Excel «bitacora_convenio»';


-- === Obras por impuestos → schema obras_impuestos ===
CREATE SCHEMA IF NOT EXISTS obras_impuestos;

DROP VIEW IF EXISTS obras_impuestos.base CASCADE;
CREATE VIEW obras_impuestos.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'capa' AS capa,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'no_convenio' AS no_convenio,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  r.payload->>'id' AS id,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'divipola' AS divipola,
  r.payload->>'lugar' AS lugar,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  r.payload->>'objeto_del_convenio' AS objeto_del_convenio,
  r.payload->>'latitud' AS latitud,
  r.payload->>'longitud' AS longitud,
  r.payload->>'contribuyente' AS contribuyente,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'fecha_de_inicio_del_convenio' AS fecha_de_inicio_del_convenio,
  r.payload->>'fecha_de_terminacion_del_convenio' AS fecha_de_terminacion_del_convenio,
  r.payload->>'fecha_de_activacion' AS fecha_de_activacion,
  r.payload->>'fecha_finalizacion' AS fecha_finalizacion,
  r.payload->>'convenio_de_interventoria_no' AS convenio_de_interventoria_no,
  r.payload->>'objeto_del_convenio_de_interventoria' AS objeto_del_convenio_de_interventoria,
  r.payload->>'contratista' AS contratista,
  r.payload->>'estado_del_convenio_de_interventoria' AS estado_del_convenio_de_interventoria,
  r.payload->>'valor_convenio_de_interventoria' AS valor_convenio_de_interventoria,
  r.payload->>'plazo_convenio_de_interventoria' AS plazo_convenio_de_interventoria,
  r.payload->>'fecha_inicio_de_convenio_interventoria' AS fecha_inicio_de_convenio_interventoria,
  r.payload->>'fecha_terminacion_de_convenio_de_interventoria' AS fecha_terminacion_de_convenio_de_interventoria,
  r.payload->>'entidad_de_iconos' AS entidad_de_iconos,
  r.payload->>'municipios_apoyados_por_convenio' AS municipios_apoyados_por_convenio,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'obras-por-impuestos'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW obras_impuestos.base IS 'Obras por impuestos — base';


-- === Asistencia Humanitaria → schema asistencia_humanitaria ===
CREATE SCHEMA IF NOT EXISTS asistencia_humanitaria;

DROP VIEW IF EXISTS asistencia_humanitaria.base CASCADE;
CREATE VIEW asistencia_humanitaria.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'tipo_ayuda' AS tipo_ayuda,
  r.payload->>'cantidad' AS cantidad,
  r.payload->>'familias' AS familias,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'asistencia-humanitaria'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW asistencia_humanitaria.base IS 'Asistencia Humanitaria — base';


-- === Gestión de Servicios → schema gestion_servicios ===
CREATE SCHEMA IF NOT EXISTS gestion_servicios;

DROP VIEW IF EXISTS gestion_servicios.base CASCADE;
CREATE VIEW gestion_servicios.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'servicio' AS servicio,
  r.payload->>'solicitante' AS solicitante,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'gestion-de-servicios'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW gestion_servicios.base IS 'Gestión de Servicios — base';


-- === Subsidios de Arriendos → schema subsidios_arriendos ===
CREATE SCHEMA IF NOT EXISTS subsidios_arriendos;

DROP VIEW IF EXISTS subsidios_arriendos.consolidado CASCADE;
CREATE VIEW subsidios_arriendos.consolidado AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'capa' AS capa,
  r.payload->>'tipo_registro' AS tipo_registro,
  coalesce(nullif(trim(r.payload->>'clave_seguimiento'), ''), nullif(trim(r.payload->>'uuid'), '')) AS clave_seguimiento,
  r.payload->>'numero_envio' AS numero_envio,
  r.payload->>'n_orden' AS n_orden,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'cod_dane' AS cod_dane,
  r.payload->>'lugar_giro' AS lugar_giro,
  r.payload->>'cod_oficina' AS cod_oficina,
  r.payload->>'doc_identidad_arrendador' AS doc_identidad_arrendador,
  r.payload->>'apellidos_arrendador' AS apellidos_arrendador,
  r.payload->>'nombres_arrendador' AS nombres_arrendador,
  r.payload->>'rud_arrendador' AS rud_arrendador,
  r.payload->>'doc_identidad_arrendatario' AS doc_identidad_arrendatario,
  r.payload->>'apellidos_arrendatario' AS apellidos_arrendatario,
  r.payload->>'nombres_arrendatario' AS nombres_arrendatario,
  r.payload->>'rud_arrendatario' AS rud_arrendatario,
  r.payload->>'id_vivienda' AS id_vivienda,
  r.payload->>'tenencia' AS tenencia,
  r.payload->>'no_contrato' AS no_contrato,
  r.payload->>'duracion' AS duracion,
  r.payload->>'fecha_inicio' AS fecha_inicio,
  r.payload->>'fecha_final' AS fecha_final,
  r.payload->>'fecha_entrega_vivienda' AS fecha_entrega_vivienda,
  r.payload->>'valor_total_pagado' AS valor_total_pagado,
  r.payload->>'_archivo_fuente' AS _archivo_fuente
FROM public.records r
WHERE r.theme_id = 'subsidios-de-arriendos'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')
  AND (lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN ('consolidado / envío'));

COMMENT ON VIEW subsidios_arriendos.consolidado IS 'Subsidios de Arriendos — hoja Excel «consolidado»';


-- === Alertas tempranas → schema alertas_tempranas ===
CREATE SCHEMA IF NOT EXISTS alertas_tempranas;

DROP VIEW IF EXISTS alertas_tempranas.base CASCADE;
CREATE VIEW alertas_tempranas.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'nivel' AS nivel,
  r.payload->>'amenaza' AS amenaza,
  r.payload->>'poblacion_expuesta' AS poblacion_expuesta,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'alertas-tempranas'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW alertas_tempranas.base IS 'Alertas tempranas — base';


-- === Asistencia técnica → schema asistencia_tecnica ===
CREATE SCHEMA IF NOT EXISTS asistencia_tecnica;

DROP VIEW IF EXISTS asistencia_tecnica.base CASCADE;
CREATE VIEW asistencia_tecnica.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'entidad' AS entidad,
  r.payload->>'tema_asistencia' AS tema_asistencia,
  r.payload->>'horas' AS horas,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'asistencia-tecnica'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW asistencia_tecnica.base IS 'Asistencia técnica — base';


-- === Equipo de respuesta → schema equipo_respuesta ===
CREATE SCHEMA IF NOT EXISTS equipo_respuesta;

DROP VIEW IF EXISTS equipo_respuesta.base CASCADE;
CREATE VIEW equipo_respuesta.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'equipo' AS equipo,
  r.payload->>'personas' AS personas,
  r.payload->>'dias' AS dias,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'equipo-de-respuesta'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW equipo_respuesta.base IS 'Equipo de respuesta — base';


-- === Compra de materiales → schema compra_materiales ===
CREATE SCHEMA IF NOT EXISTS compra_materiales;

DROP VIEW IF EXISTS compra_materiales.base CASCADE;
CREATE VIEW compra_materiales.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'material' AS material,
  r.payload->>'cantidad' AS cantidad,
  r.payload->>'proveedor' AS proveedor,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'compra-de-materiales'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW compra_materiales.base IS 'Compra de materiales — base';


-- === FIC → schema fic ===
CREATE SCHEMA IF NOT EXISTS fic;

DROP VIEW IF EXISTS fic.base CASCADE;
CREATE VIEW fic.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'capa' AS capa,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'no_cdp' AS no_cdp,
  r.payload->>'vigencia' AS vigencia,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'tipo_de_evento' AS tipo_de_evento,
  r.payload->>'fecha_formato_de_aprobacion_de_la_atencion' AS fecha_formato_de_aprobacion_de_la_atencion,
  r.payload->>'acto_administrativo_otorgamiento_del_recurso' AS acto_administrativo_otorgamiento_del_recurso,
  r.payload->>'fecha_acto_administrativo_resolucion' AS fecha_acto_administrativo_resolucion,
  r.payload->>'clasificacion' AS clasificacion,
  r.payload->>'no_rc' AS no_rc,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  r.payload->>'comunicacion_de_notificacion_ente_territorial' AS comunicacion_de_notificacion_ente_territorial,
  r.payload->>'fecha_de_radicacion_comunicacion_ente_territorial' AS fecha_de_radicacion_comunicacion_ente_territorial,
  r.payload->>'nombre_del_supervisor_administrativo' AS nombre_del_supervisor_administrativo,
  r.payload->>'fecha_inicial_para_legalizacion' AS fecha_inicial_para_legalizacion,
  r.payload->>'responsabilidades_de_la_supervision_descripcion_de_las_acciones_' AS responsabilidades_de_la_supervision_descripcion_de_las_acciones_,
  r.payload->>'fecha_de_legalizacion_por_prorroga' AS fecha_de_legalizacion_por_prorroga,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'valor_por_legalizar' AS valor_por_legalizar,
  r.payload->>'porcentaje_de_avance_en_el_ejericicio_de_legalizacion' AS porcentaje_de_avance_en_el_ejericicio_de_legalizacion,
  r.payload->>'se_realizaron_visitas_de_seguimiento' AS se_realizaron_visitas_de_seguimiento,
  r.payload->>'describa_el_resultado_de_las_visitas_realizadas' AS describa_el_resultado_de_las_visitas_realizadas,
  r.payload->>'observaciones' AS observaciones,
  r.payload->>'fecha_de_radicacion_en_gafc' AS fecha_de_radicacion_en_gafc,
  r.payload->>'objeto_transferencia' AS objeto_transferencia,
  r.payload->>'plazo_ejecucion_dias' AS plazo_ejecucion_dias,
  r.payload->>'acto_administrativo_prorroga' AS acto_administrativo_prorroga,
  r.payload->>'plazo_adicion_dias' AS plazo_adicion_dias,
  r.payload->>'valor_legalizado' AS valor_legalizado
FROM public.records r
WHERE r.theme_id = 'fic'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW fic.base IS 'FIC — base';


-- === Convenios → schema convenios ===
CREATE SCHEMA IF NOT EXISTS convenios;

DROP VIEW IF EXISTS convenios.base CASCADE;
CREATE VIEW convenios.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'numero' AS numero,
  r.payload->>'contraparte' AS contraparte,
  r.payload->>'objeto' AS objeto,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'convenios'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW convenios.base IS 'Convenios — base';


-- === Presupuesto → schema presupuesto ===
CREATE SCHEMA IF NOT EXISTS presupuesto;

DROP VIEW IF EXISTS presupuesto.base CASCADE;
CREATE VIEW presupuesto.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'rubro' AS rubro,
  r.payload->>'vigencia' AS vigencia,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'presupuesto'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW presupuesto.base IS 'Presupuesto — base';


-- === Ejecución financiera → schema ejecucion_financiera ===
CREATE SCHEMA IF NOT EXISTS ejecucion_financiera;

DROP VIEW IF EXISTS ejecucion_financiera.base CASCADE;
CREATE VIEW ejecucion_financiera.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'rubro' AS rubro,
  r.payload->>'comprometido' AS comprometido,
  r.payload->>'pagado' AS pagado,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'ejecucion-financiera'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW ejecucion_financiera.base IS 'Ejecución financiera — base';


-- === Materiales → schema materiales ===
CREATE SCHEMA IF NOT EXISTS materiales;

DROP VIEW IF EXISTS materiales.base CASCADE;
CREATE VIEW materiales.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'item' AS item,
  r.payload->>'cantidad' AS cantidad,
  r.payload->>'bodega' AS bodega,
  r.payload->>'movimiento' AS movimiento,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'materiales'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW materiales.base IS 'Materiales — base';


-- === Declaratoria de emergencia → schema declaratoria ===
CREATE SCHEMA IF NOT EXISTS declaratoria;

DROP VIEW IF EXISTS declaratoria.base CASCADE;
CREATE VIEW declaratoria.base AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  r.payload->>'tipo_registro' AS tipo_registro,
  r.payload->>'capa' AS capa,
  r.payload->>'clave_seguimiento' AS clave_seguimiento,
  r.payload->>'no_declaratoria' AS no_declaratoria,
  COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS valor,
  nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS estado,
  r.payload->>'id' AS id,
  nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS departamento,
  nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS municipio,
  r.payload->>'evento' AS evento,
  r.payload->>'divipola' AS divipola,
  coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS fecha,
  r.payload->>'fecha_de_terminacion' AS fecha_de_terminacion,
  r.payload->>'vigencia' AS vigencia,
  r.payload->>'latitud' AS latitud,
  r.payload->>'longitud' AS longitud,
  r.payload->>'acta' AS acta,
  r.payload->>'pae' AS pae,
  r.payload->>'edan' AS edan,
  r.payload->>'solicitud' AS solicitud,
  r.payload->>'otros' AS otros,
  r.payload->>'prorroga' AS prorroga,
  r.payload->>'fecha_inicio_prorroga' AS fecha_inicio_prorroga,
  r.payload->>'fecha_de_terminacion_prorroga' AS fecha_de_terminacion_prorroga,
  r.payload->>'vigencia_prorroga' AS vigencia_prorroga,
  r.payload->>'evento_prorroga' AS evento_prorroga,
  r.payload->>'no_declaratoria_prorroga' AS no_declaratoria_prorroga,
  r.payload->>'retorno_normalidad' AS retorno_normalidad,
  r.payload->>'fecha_inicio_retorno' AS fecha_inicio_retorno,
  r.payload->>'evento_retorno' AS evento_retorno,
  r.payload->>'no_declaratoria_retorno' AS no_declaratoria_retorno,
  r.payload->>'modificacion_terminacion_otros' AS modificacion_terminacion_otros,
  r.payload->>'fecha_de_inicio_modificacion' AS fecha_de_inicio_modificacion,
  r.payload->>'fecha_de_terminacion_modificacion' AS fecha_de_terminacion_modificacion,
  r.payload->>'vigencia_modificacion' AS vigencia_modificacion,
  r.payload->>'evento_modificacion' AS evento_modificacion,
  r.payload->>'no_declaratoria_modificacion' AS no_declaratoria_modificacion,
  r.payload->>'observaciones' AS observaciones
FROM public.records r
WHERE r.theme_id = 'declaratoria-de-emergencia'
  AND r.deleted_at IS NULL
  AND lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test');

COMMENT ON VIEW declaratoria.base IS 'Declaratoria de emergencia — base';


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


DROP VIEW IF EXISTS medallion.v_subsidios_arriendos_all CASCADE;
CREATE VIEW medallion.v_subsidios_arriendos_all AS SELECT * FROM subsidios_arriendos.consolidado;


DROP VIEW IF EXISTS medallion.v_subsidios_arriendos_consolidado CASCADE;
CREATE VIEW medallion.v_subsidios_arriendos_consolidado AS SELECT * FROM subsidios_arriendos.consolidado;


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
  ('carrotanques.alta_maqueta', 'carrotanques', 'alta_maqueta', 'carrotanques', 'alta_maqueta', 'Carrotanques — alta_maqueta', 'SELECT * FROM carrotanques.alta_maqueta'),
  ('carrotanques.actualizar_categorias', 'carrotanques', 'actualizar_categorias', 'carrotanques', 'actualizar_categorias', 'Carrotanques — actualizar_categorias', 'SELECT * FROM carrotanques.actualizar_categorias'),
  ('carrotanques.bitacora', 'carrotanques', 'bitacora', 'carrotanques', 'bitacora', 'Carrotanques — bitacora', 'SELECT * FROM carrotanques.bitacora'),
  ('carrotanques.suministro', 'carrotanques', 'suministro', 'carrotanques', 'suministro', 'Carrotanques — suministro', 'SELECT * FROM carrotanques.suministro'),
  ('obras_emergencia.base', 'obras_emergencia', 'base', 'obras-de-emergencia', 'base', 'Obras de Emergencia — base', 'SELECT * FROM obras_emergencia.base'),
  ('puentes.contratos_estructuracion', 'puentes', 'contratos_estructuracion', 'puentes', 'Contratos Estructuracion', 'Puentes — Contratos Estructuracion', 'SELECT * FROM puentes.contratos_estructuracion'),
  ('puentes.base_general_puentes', 'puentes', 'base_general_puentes', 'puentes', 'Base General Puentes', 'Puentes — Base General Puentes', 'SELECT * FROM puentes.base_general_puentes'),
  ('puentes.bitacora', 'puentes', 'bitacora', 'puentes', 'bitacora', 'Puentes — bitacora', 'SELECT * FROM puentes.bitacora'),
  ('banco_maquinaria.alta_convenio', 'banco_maquinaria', 'alta_convenio', 'banco-de-maquinaria', 'alta_convenio', 'Banco de Maquinaria — alta_convenio', 'SELECT * FROM banco_maquinaria.alta_convenio'),
  ('banco_maquinaria.alta_detalle', 'banco_maquinaria', 'alta_detalle', 'banco-de-maquinaria', 'alta_detalle', 'Banco de Maquinaria — alta_detalle', 'SELECT * FROM banco_maquinaria.alta_detalle'),
  ('banco_maquinaria.bitacora_convenio', 'banco_maquinaria', 'bitacora_convenio', 'banco-de-maquinaria', 'bitacora_convenio', 'Banco de Maquinaria — bitacora_convenio', 'SELECT * FROM banco_maquinaria.bitacora_convenio'),
  ('obras_impuestos.base', 'obras_impuestos', 'base', 'obras-por-impuestos', 'base', 'Obras por impuestos — base', 'SELECT * FROM obras_impuestos.base'),
  ('asistencia_humanitaria.base', 'asistencia_humanitaria', 'base', 'asistencia-humanitaria', 'base', 'Asistencia Humanitaria — base', 'SELECT * FROM asistencia_humanitaria.base'),
  ('gestion_servicios.base', 'gestion_servicios', 'base', 'gestion-de-servicios', 'base', 'Gestión de Servicios — base', 'SELECT * FROM gestion_servicios.base'),
  ('subsidios_arriendos.consolidado', 'subsidios_arriendos', 'consolidado', 'subsidios-de-arriendos', 'consolidado', 'Subsidios de Arriendos — consolidado', 'SELECT * FROM subsidios_arriendos.consolidado'),
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
  ('agua', 'agua.pagos', 'agua.bitacora', 'orden_de_proveeduria', 'secundaria', 'Misma OP entre satélites (historial distinto)', 'SELECT p.orden_de_proveeduria, count(DISTINCT b.record_id) AS eventos FROM agua.pagos p LEFT JOIN agua.bitacora b ON b.orden_de_proveeduria = p.orden_de_proveeduria GROUP BY 1'),
  ('subsidios_arriendos', 'subsidios_arriendos.consolidado', 'subsidios_arriendos.consolidado', 'uuid', 'primaria', 'Identidad del registro (UUID). Capas futuras de seguimiento se unen por uuid', 'SELECT c.uuid, c.numero_envio, c.n_orden, c.municipio FROM subsidios_arriendos.consolidado c')
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
