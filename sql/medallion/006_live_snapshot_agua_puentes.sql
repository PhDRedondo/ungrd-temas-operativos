-- SNAPSHOT LIVE (2026-08-06) — solo referencia / handoff
-- Extraído con pg_get_viewdef desde el rol medallion_reader.
-- NO es el generador canónico. El canónico (más reciente, no aplicado aún) es:
--   sql/medallion/003_theme_capa_views.sql  (npm run medallion:generate)
-- Diferencias vs 003:
--   - agua.maqueta (live) vs agua.general (003)
--   - agua.control (live) vs agua.control_y_seguimiento_detalle_m (003)
--   - puentes.* live sin columnas de JOIN (clave_proceso / convenio_o_cto en bitácora e inventario)
--   - medallion.v_join_map no existe aún en live

-- LIVE DDL extracted via pg_get_viewdef (2026-08-06)
-- Schemas: agua, puentes

DROP VIEW IF EXISTS agua.bitacora CASCADE;
CREATE VIEW agua.bitacora AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'fecha_estado'::text AS fecha_estado,
    payload ->> 'estado_macro'::text AS estado_macro,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'estado'::text, estado, ''::text)), ''::text) AS estado,
    payload ->> 'proceso'::text AS proceso,
    payload ->> 'dependencia'::text AS dependencia,
    payload ->> 'comentario'::text AS comentario
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['bitácora estado'::text, 'bitacora estado'::text, 'bitácora'::text, 'bitacora'::text]));


DROP VIEW IF EXISTS agua.bitacora_estructuracion CASCADE;
CREATE VIEW agua.bitacora_estructuracion AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'estado_de_ejecucion'::text AS estado_de_ejecucion,
    payload ->> 'semana_seguimiento'::text AS semana_seguimiento,
    payload ->> 'fecha_estado'::text AS fecha_estado,
    payload ->> 'comentario_semanal'::text AS comentario_semanal,
    payload ->> 'responsable_apoyo_a_la_supervision'::text AS responsable_apoyo_a_la_supervision,
    payload ->> 'fecha_de_asignacion'::text AS fecha_de_asignacion,
    payload ->> 'fecha_inicio_orden'::text AS fecha_inicio_orden,
    payload ->> 'fecha_fin_orden'::text AS fecha_fin_orden,
    payload ->> 'ejecucion'::text AS ejecucion,
    payload ->> 'expediente'::text AS expediente,
    payload ->> 'fecha_radicacion_expediente'::text AS fecha_radicacion_expediente
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['bitácora estructuración'::text, 'bitacora estructuracion'::text, 'seguimiento operativo'::text]));


DROP VIEW IF EXISTS agua.cdps_y_rc CASCADE;
CREATE VIEW agua.cdps_y_rc AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'proveedor'::text AS proveedor,
    COALESCE(
        CASE
            WHEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text) ~ '^-?[0-9]+(\.[0-9]+)?$'::text THEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text)::numeric
            ELSE NULL::numeric
        END, valor) AS valor,
    payload ->> 'ano'::text AS ano,
    payload ->> 'no_cdp'::text AS no_cdp,
    payload ->> 'n_cdp'::text AS n_cdp,
    payload ->> 'fecha_cdp'::text AS fecha_cdp,
    payload ->> 'valor_cdp'::text AS valor_cdp,
    payload ->> 'no_rc'::text AS no_rc,
    payload ->> 'n_rc'::text AS n_rc,
    payload ->> 'fecha_rc'::text AS fecha_rc,
    payload ->> 'valor_rc'::text AS valor_rc,
    payload ->> 'valor_pagado'::text AS valor_pagado,
    payload ->> 'n_ratificacion'::text AS n_ratificacion,
    payload ->> 'observaciones'::text AS observaciones
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = 'cdps y rc'::text;


DROP VIEW IF EXISTS agua.control CASCADE;
CREATE VIEW agua.control AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'tipo_de_orden'::text AS tipo_de_orden,
    payload ->> 'tipo_maquina'::text AS tipo_maquina,
    payload ->> 'nombre_orden'::text AS nombre_orden,
    payload ->> 'cntd_tanques_de_almacenamiento_de_agua_contratados'::text AS cntd_tanques_de_almacenamiento_de_agua_contratados,
    payload ->> 'capacidad_lts_tanques_contratados'::text AS capacidad_lts_tanques_contratados,
    payload ->> 'cantidad_carrotanques_contratadas'::text AS cantidad_carrotanques_contratadas,
    payload ->> 'capacidad_lt_crrt_contratadas'::text AS capacidad_lt_crrt_contratadas,
    payload ->> 'dias_suministro_crrt_contratada'::text AS dias_suministro_crrt_contratada,
    payload ->> 'cntd_vactor_contratadas'::text AS cntd_vactor_contratadas,
    payload ->> 'capacidad_lt_vactor_contratada'::text AS capacidad_lt_vactor_contratada,
    payload ->> 'dias_suministro_vactor_contratada'::text AS dias_suministro_vactor_contratada,
    payload ->> 'cantidad_maquinas_m_a_contratadas'::text AS cantidad_maquinas_m_a_contratadas,
    payload ->> 'horas_maquina_m_a'::text AS horas_maquina_m_a,
    payload ->> 'dias_volqueta_m_a_contratadas'::text AS dias_volqueta_m_a_contratadas,
    payload ->> 'cantidad_de_tanques_de_almacenamiento_de_agua_ejecutadas'::text AS cantidad_de_tanques_de_almacenamiento_de_agua_ejecutadas,
    payload ->> 'capacidad_lt_tanques_ejecutados'::text AS capacidad_lt_tanques_ejecutados,
    payload ->> 'cantidad_carrotanques_ejecutadas'::text AS cantidad_carrotanques_ejecutadas,
    payload ->> 'capacidad_lt_2_crrt'::text AS capacidad_lt_2_crrt,
    payload ->> 'dias_suministro_crrt'::text AS dias_suministro_crrt,
    payload ->> 'cntd_vactor_ejecutadas'::text AS cntd_vactor_ejecutadas,
    payload ->> 'capacidad_lt_vactor_ejecutadas'::text AS capacidad_lt_vactor_ejecutadas,
    payload ->> 'dias_suministro_vactor_ejecutadas'::text AS dias_suministro_vactor_ejecutadas,
    payload ->> 'cantidad_maquinas_m_a_ejecutadas'::text AS cantidad_maquinas_m_a_ejecutadas,
    payload ->> 'horas_maquina_m_a_ejecutadas'::text AS horas_maquina_m_a_ejecutadas,
    payload ->> 'dias_volqueta_m_a_ejecutadas'::text AS dias_volqueta_m_a_ejecutadas
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['control ejecución física'::text, 'control ejecucion fisica'::text]));


DROP VIEW IF EXISTS agua.maqueta CASCADE;
CREATE VIEW agua.maqueta AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'orden_de_proveeduria_segmentado'::text AS orden_de_proveeduria_segmentado,
    payload ->> 'op2'::text AS op2,
    payload ->> 'orden_de_proveeduria_x_pago'::text AS orden_de_proveeduria_x_pago,
    payload ->> 'nit'::text AS nit,
    payload ->> 'proveedor'::text AS proveedor,
    COALESCE(
        CASE
            WHEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text) ~ '^-?[0-9]+(\.[0-9]+)?$'::text THEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text)::numeric
            ELSE NULL::numeric
        END, valor) AS valor,
    payload ->> 'vigencia'::text AS vigencia,
    payload ->> 'tipo_de_orden'::text AS tipo_de_orden,
    payload ->> 'orden_relacionada_control_y_seg'::text AS orden_relacionada_control_y_seg,
    payload ->> 'proveedor_o_p_par'::text AS proveedor_o_p_par,
    payload ->> 'region'::text AS region,
    payload ->> 'provincia'::text AS provincia,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'departamento'::text, departamento, ''::text)), ''::text) AS departamento,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'municipio'::text, municipio, ''::text)), ''::text) AS municipio,
    COALESCE(NULLIF(TRIM(BOTH FROM payload ->> 'fecha'::text), ''::text), fecha::text) AS fecha,
    payload ->> 'objeto'::text AS objeto,
    payload ->> 'decreto'::text AS decreto,
    payload ->> 'tipo_maquina'::text AS tipo_maquina,
    payload ->> 'n_sigob_de_solicitud'::text AS n_sigob_de_solicitud,
    payload ->> 'n_sigob_de_respuesta'::text AS n_sigob_de_respuesta,
    payload ->> 'tipo_de_evento'::text AS tipo_de_evento
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['alta / orden'::text, 'maqueta / orden'::text]));


DROP VIEW IF EXISTS agua.modificaciones CASCADE;
CREATE VIEW agua.modificaciones AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'proveedor'::text AS proveedor,
    payload ->> 'num_modificacion'::text AS num_modificacion,
    payload ->> 'tipo_de_modificacion'::text AS tipo_de_modificacion,
    payload ->> 'modificacion'::text AS modificacion,
    COALESCE(NULLIF(TRIM(BOTH FROM payload ->> 'fecha'::text), ''::text), fecha::text) AS fecha,
    COALESCE(
        CASE
            WHEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text) ~ '^-?[0-9]+(\.[0-9]+)?$'::text THEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text)::numeric
            ELSE NULL::numeric
        END, valor) AS valor,
    payload ->> 'plazo_de_ejecucion_dias'::text AS plazo_de_ejecucion_dias,
    payload ->> 'horas_maquina'::text AS horas_maquina,
    payload ->> 'dias_volqueta'::text AS dias_volqueta,
    payload ->> 'forma_de_pago'::text AS forma_de_pago,
    payload ->> 'valor_parcial_1'::text AS valor_parcial_1,
    payload ->> 'valor_parcial_2'::text AS valor_parcial_2,
    payload ->> 'valor_parcial_3'::text AS valor_parcial_3,
    payload ->> 'observaciones'::text AS observaciones,
    payload ->> 'verif'::text AS verif
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['modificación contractual'::text, 'modificacion contractual'::text, 'modificaciones'::text]));


DROP VIEW IF EXISTS agua.pagos CASCADE;
CREATE VIEW agua.pagos AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'orden_de_proveeduria_x_pago'::text AS orden_de_proveeduria_x_pago,
    payload ->> 'nit'::text AS nit,
    payload ->> 'proveedor'::text AS proveedor,
    payload ->> 'valor_op_parcial'::text AS valor_op_parcial,
    payload ->> 'ano'::text AS ano,
    payload ->> 'n_contrato'::text AS n_contrato,
    payload ->> 'sd_solicitud_de_desembolso'::text AS sd_solicitud_de_desembolso,
    payload ->> 'comprobante_de_egreso'::text AS comprobante_de_egreso,
    payload ->> 'voucher'::text AS voucher,
    payload ->> 'valor_pagado_sin_impuestos'::text AS valor_pagado_sin_impuestos,
    payload ->> 'valor_pagado_total_con_impuestos'::text AS valor_pagado_total_con_impuestos,
    payload ->> 'saldo_a_liberar'::text AS saldo_a_liberar,
    payload ->> 'fecha_de_pago'::text AS fecha_de_pago,
    payload ->> 'op_paga'::text AS op_paga,
    payload ->> 'comentario_depuracion'::text AS comentario_depuracion
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['pago / desembolso'::text, 'pagos'::text]));


DROP VIEW IF EXISTS agua.variables_lider CASCADE;
CREATE VIEW agua.variables_lider AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'orden_de_proveeduria'::text AS orden_de_proveeduria,
    payload ->> 'administracion'::text AS administracion,
    payload ->> 'procesos_juridicos'::text AS procesos_juridicos,
    payload ->> 'nombre_orden'::text AS nombre_orden,
    payload ->> 'categorizacion'::text AS categorizacion,
    payload ->> 'responsable_apoyo_a_la_supervision'::text AS responsable_apoyo_a_la_supervision,
    payload ->> 'tecnico_asignado'::text AS tecnico_asignado,
    payload ->> 'abogado_asignado_r_tecnica'::text AS abogado_asignado_r_tecnica,
    payload ->> 'financiero_asignado'::text AS financiero_asignado,
    payload ->> 'fecha_de_aval'::text AS fecha_de_aval
   FROM records r
  WHERE theme_id = 'agua-y-saneamiento'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['variables líder'::text, 'variables lider'::text]));


DROP VIEW IF EXISTS puentes.base_general_puentes CASCADE;
CREATE VIEW puentes.base_general_puentes AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'id_puente'::text AS id_puente,
    payload ->> 'codigo_operativo'::text AS codigo_operativo,
    payload ->> 'clase'::text AS clase,
    payload ->> 'tipo'::text AS tipo,
    payload ->> 'configuracion'::text AS configuracion,
    payload ->> 'ano_compra'::text AS ano_compra,
    payload ->> 'longitud_m'::text AS longitud_m,
    payload ->> 'capacidad_ton'::text AS capacidad_ton,
    payload ->> 'clasificacion_propiedad'::text AS clasificacion_propiedad,
    COALESCE(
        CASE
            WHEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text) ~ '^-?[0-9]+(\.[0-9]+)?$'::text THEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text)::numeric
            ELSE NULL::numeric
        END, valor) AS valor,
    payload ->> 'ubicacion_actual'::text AS ubicacion_actual,
    payload ->> 'region'::text AS region,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'departamento'::text, departamento, ''::text)), ''::text) AS departamento,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'municipio'::text, municipio, ''::text)), ''::text) AS municipio,
    payload ->> 'personas_beneficiadas'::text AS personas_beneficiadas,
    payload ->> 'latitud'::text AS latitud,
    payload ->> 'longitud'::text AS longitud,
    payload ->> 'entidad_receptora'::text AS entidad_receptora,
    payload ->> 'estado_puente'::text AS estado_puente,
    payload ->> 'situacion_prestamo'::text AS situacion_prestamo,
    payload ->> 'fecha_inicio_estado_actual'::text AS fecha_inicio_estado_actual,
    payload ->> 'fecha_fin_estado_actual'::text AS fecha_fin_estado_actual,
    payload ->> 'fecha_desde_ultimo_estado'::text AS fecha_desde_ultimo_estado,
    payload ->> 'observaciones'::text AS observaciones
   FROM records r
  WHERE theme_id = 'puentes'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['inventario puente'::text, 'base general puentes'::text]));


DROP VIEW IF EXISTS puentes.bitacora CASCADE;
CREATE VIEW puentes.bitacora AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'id_puente'::text AS id_puente,
    payload ->> 'codigo_operativo'::text AS codigo_operativo,
    payload ->> 'tipo'::text AS tipo,
    payload ->> 'cantidad_viajes'::text AS cantidad_viajes,
    payload ->> 'ubicacion_actual'::text AS ubicacion_actual,
    payload ->> 'region'::text AS region,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'departamento'::text, departamento, ''::text)), ''::text) AS departamento,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'municipio'::text, municipio, ''::text)), ''::text) AS municipio,
    payload ->> 'vereda'::text AS vereda,
    payload ->> 'ente_receptor'::text AS ente_receptor,
    payload ->> 'situacion_prestamo'::text AS situacion_prestamo,
    payload ->> 'estado_puente'::text AS estado_puente,
    payload ->> 'fecha_inicio'::text AS fecha_inicio,
    payload ->> 'fecha_fin'::text AS fecha_fin,
    payload ->> 'fecha_corte_reporte'::text AS fecha_corte_reporte,
    payload ->> 'fundamento'::text AS fundamento,
    payload ->> 'observaciones'::text AS observaciones,
    payload ->> 'nombre_hoja_reporte'::text AS nombre_hoja_reporte
   FROM records r
  WHERE theme_id = 'puentes'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['bitácora estado'::text, 'bitacora estado'::text, 'bitácora'::text, 'bitacora'::text]));


DROP VIEW IF EXISTS puentes.contratos_estructuracion CASCADE;
CREATE VIEW puentes.contratos_estructuracion AS
 SELECT id AS record_id,
    theme_id,
    source,
    created_at,
    updated_at,
    payload ->> 'capa'::text AS capa,
    payload ->> 'tipo_registro'::text AS tipo_registro,
    payload ->> 'clave_seguimiento'::text AS clave_seguimiento,
    payload ->> 'contrato_convenio'::text AS contrato_convenio,
    payload ->> 'clave_proceso'::text AS clave_proceso,
    payload ->> 'tipo_vinculo'::text AS tipo_vinculo,
    payload ->> 'descripcion_proceso'::text AS descripcion_proceso,
    COALESCE(
        CASE
            WHEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text) ~ '^-?[0-9]+(\.[0-9]+)?$'::text THEN NULLIF(TRIM(BOTH FROM payload ->> 'valor'::text), ''::text)::numeric
            ELSE NULL::numeric
        END, valor) AS valor,
    payload ->> 'vigencia'::text AS vigencia,
    payload ->> 'tipo_proceso'::text AS tipo_proceso,
    payload ->> 'grupo'::text AS grupo,
    payload ->> 'etapa'::text AS etapa,
    NULLIF(TRIM(BOTH FROM COALESCE(payload ->> 'estado'::text, estado, ''::text)), ''::text) AS estado,
    payload ->> 'area'::text AS area,
    payload ->> 'responsable'::text AS responsable,
    payload ->> 'fecha_inicio_proceso'::text AS fecha_inicio_proceso,
    payload ->> 'fecha_fin_proceso'::text AS fecha_fin_proceso,
    payload ->> 'plazo_ejecucion'::text AS plazo_ejecucion,
    payload ->> 'tiempo_etapa_dias'::text AS tiempo_etapa_dias,
    payload ->> 'tiempo_acumulado_dias'::text AS tiempo_acumulado_dias,
    payload ->> 'alerta'::text AS alerta,
    payload ->> 'comentarios'::text AS comentarios,
    payload ->> 'reporte'::text AS reporte
   FROM records r
  WHERE theme_id = 'puentes'::text AND deleted_at IS NULL AND (lower(TRIM(BOTH FROM COALESCE(payload ->> 'capa'::text, payload ->> 'tipo_registro'::text, ''::text))) = ANY (ARRAY['contrato estructuración'::text, 'contrato estructuracion'::text, 'contratos estructuracion'::text]));

