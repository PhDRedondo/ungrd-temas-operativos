-- AUTO-GENERADO: npx tsx scripts/generate-medallion-silver.ts
-- Silver físico (Agua + Puentes). Fuente columnas: db.
-- NO modifica public.records ni vistas Bronze agua.*/puentes.*.
-- Aplicar con rol postgres (Session pooler :5432).
-- Sync: npm run medallion:sync-silver

-- === silver_agua ===
CREATE SCHEMA IF NOT EXISTS silver_agua;

COMMENT ON SCHEMA silver_agua IS 'Silver relacional Agua: dim orden + tablas por hoja Excel (PK record_id, FK OP)';

DROP TABLE IF EXISTS silver_agua.orden CASCADE;
CREATE TABLE silver_agua.orden (
  orden_de_proveeduria text NOT NULL,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  source_tables text[] NOT NULL DEFAULT '{}',
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orden_pkey PRIMARY KEY (orden_de_proveeduria)
);
COMMENT ON TABLE silver_agua.orden IS 'Dim OP: unión de todas las OPs presentes en hojas Agua (incluye huérfanas sin fila en general)';
COMMENT ON COLUMN silver_agua.orden.orden_de_proveeduria IS 'Llave de negocio hub Agua (Orden de Proveeduría)';

DROP TABLE IF EXISTS silver_agua.general CASCADE;
CREATE TABLE silver_agua.general (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  orden_de_proveeduria_segmentado text,
  op2 text,
  orden_de_proveeduria_x_pago text,
  nit text,
  proveedor text,
  valor numeric,
  vigencia text,
  tipo_de_orden text,
  orden_relacionada_control_y_seg text,
  proveedor_o_p_par text,
  region text,
  provincia text,
  departamento text,
  municipio text,
  fecha text,
  objeto text,
  decreto text,
  tipo_maquina text,
  n_sigob_de_solicitud text,
  n_sigob_de_respuesta text,
  tipo_de_evento text,
  coordenadas text,
  plazo_de_ejecucion_dias text,
  forma_de_pago text,
  no_cdp text,
  n_cdp text,
  fecha_cdp text,
  valor_cdp text,
  no_rc text,
  n_rc text,
  fecha_rc text,
  valor_rc text,
  expediente text,
  responsable_apoyo_a_la_supervision text,
  fecha_de_asignacion text,
  estado text,
  estado_de_ejecucion text,
  fecha_inicio_orden text,
  fecha_fin_orden text,
  ejecucion text,
  fecha_radicacion_expediente text,
  tecnico_asignado text,
  abogado_asignado_r_tecnica text,
  financiero_asignado text,
  fecha_de_aval text,
  cantidad_reiteraciones text,
  cantidad_observaciones text,
  dias_en_tecnico text,
  dias_en_proveedor text,
  dias_contractual text,
  dias_financiera text,
  dias_subdirector text,
  dias_subdireccion_general text,
  dias_gafc text,
  dias_fiduprevisora text,
  dias_totales_en_la_linea text,
  dias_en_gestion_de_pagos text,
  n_ratificacion text,
  sd text,
  valor_pagado text,
  comprobante_de_egreso text,
  voucher text,
  fecha_de_pago text,
  op_paga text,
  etapa text,
  estado_actual text,
  proceso_actual text,
  dependencia text,
  dias_desde_ult_gestion text,
  fecha_ultimo_seguimiento text,
  comentario_ult_seguimiento_a_supervision text,
  novedades text,
  validaciom text,
  administracion text,
  procesos_juridicos text,
  nombre_orden text,
  categorizacion text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT general_pkey PRIMARY KEY (record_id),
  CONSTRAINT general_orden_uq UNIQUE (orden_de_proveeduria),
  CONSTRAINT general_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.general IS 'Silver — agua hoja Excel «General» (desde agua.general)';
COMMENT ON COLUMN silver_agua.general.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.general.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.general.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_general_op ON silver_agua.general (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_general_synced ON silver_agua.general (synced_at);
CREATE INDEX IF NOT EXISTS idx_general_depto ON silver_agua.general (departamento);
CREATE INDEX IF NOT EXISTS idx_general_muni ON silver_agua.general (municipio);

DROP TABLE IF EXISTS silver_agua.bitacora CASCADE;
CREATE TABLE silver_agua.bitacora (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  fecha_estado text,
  estado_macro text,
  estado text,
  proceso text,
  dependencia text,
  comentario text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bitacora_pkey PRIMARY KEY (record_id),
  CONSTRAINT bitacora_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.bitacora IS 'Silver — agua hoja Excel «bitacora» (desde agua.bitacora)';
COMMENT ON COLUMN silver_agua.bitacora.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.bitacora.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.bitacora.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_bitacora_op ON silver_agua.bitacora (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_bitacora_synced ON silver_agua.bitacora (synced_at);

DROP TABLE IF EXISTS silver_agua.pagos CASCADE;
CREATE TABLE silver_agua.pagos (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  orden_de_proveeduria_x_pago text,
  nit text,
  proveedor text,
  valor_op_parcial text,
  ano text,
  n_contrato text,
  sd_solicitud_de_desembolso text,
  comprobante_de_egreso text,
  voucher text,
  valor_pagado_sin_impuestos text,
  valor_pagado_total_con_impuestos text,
  saldo_a_liberar text,
  fecha_de_pago text,
  op_paga text,
  saldo_por_liberar text,
  comentario_depuracion text,
  odern_3 text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_pkey PRIMARY KEY (record_id),
  CONSTRAINT pagos_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.pagos IS 'Silver — agua hoja Excel «PAGOS» (desde agua.pagos)';
COMMENT ON COLUMN silver_agua.pagos.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.pagos.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.pagos.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_pagos_op ON silver_agua.pagos (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_pagos_synced ON silver_agua.pagos (synced_at);

DROP TABLE IF EXISTS silver_agua.modificaciones CASCADE;
CREATE TABLE silver_agua.modificaciones (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  proveedor text,
  num_modificacion text,
  tipo_de_modificacion text,
  modificacion text,
  fecha text,
  valor numeric,
  plazo_de_ejecucion_dias text,
  horas_maquina text,
  dias_volqueta text,
  sin_info text,
  forma_de_pago text,
  valor_parcial_1 text,
  valor_parcial_2 text,
  valor_parcial_3 text,
  observaciones text,
  horas text,
  verif text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modificaciones_pkey PRIMARY KEY (record_id),
  CONSTRAINT modificaciones_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.modificaciones IS 'Silver — agua hoja Excel «modificaciones» (desde agua.modificaciones)';
COMMENT ON COLUMN silver_agua.modificaciones.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.modificaciones.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.modificaciones.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_modificaciones_op ON silver_agua.modificaciones (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_modificaciones_synced ON silver_agua.modificaciones (synced_at);

DROP TABLE IF EXISTS silver_agua.cdps_y_rc CASCADE;
CREATE TABLE silver_agua.cdps_y_rc (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  proveedor text,
  valor numeric,
  ano text,
  no_cdp text,
  n_cdp text,
  fecha_cdp text,
  valor_cdp text,
  no_rc text,
  n_rc text,
  fecha_rc text,
  valor_rc text,
  valor_pagado text,
  n_ratificacion text,
  observaciones text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cdps_y_rc_pkey PRIMARY KEY (record_id),
  CONSTRAINT cdps_y_rc_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.cdps_y_rc IS 'Silver — agua hoja Excel «CDPS Y RC» (desde agua.cdps_y_rc)';
COMMENT ON COLUMN silver_agua.cdps_y_rc.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.cdps_y_rc.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.cdps_y_rc.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_cdps_y_rc_op ON silver_agua.cdps_y_rc (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_cdps_y_rc_synced ON silver_agua.cdps_y_rc (synced_at);

DROP TABLE IF EXISTS silver_agua.bitacora_estructuracion CASCADE;
CREATE TABLE silver_agua.bitacora_estructuracion (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  estado_de_ejecucion text,
  semana_seguimiento text,
  fecha_estado text,
  comentario_semanal text,
  responsable_apoyo_a_la_supervision text,
  fecha_de_asignacion text,
  fecha_inicio_orden text,
  fecha_fin_orden text,
  ejecucion text,
  expediente text,
  fecha_radicacion_expediente text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bitacora_estructuracion_pkey PRIMARY KEY (record_id),
  CONSTRAINT bitacora_estructuracion_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.bitacora_estructuracion IS 'Silver — agua hoja Excel «bitacora estructuracion» (desde agua.bitacora_estructuracion)';
COMMENT ON COLUMN silver_agua.bitacora_estructuracion.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.bitacora_estructuracion.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.bitacora_estructuracion.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_bitacora_estructuracion_op ON silver_agua.bitacora_estructuracion (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_bitacora_estructuracion_synced ON silver_agua.bitacora_estructuracion (synced_at);

DROP TABLE IF EXISTS silver_agua.control_y_seguimiento_detalle_m CASCADE;
CREATE TABLE silver_agua.control_y_seguimiento_detalle_m (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  tipo_de_orden text,
  tipo_maquina text,
  nombre_orden text,
  cntd_tanques_de_almacenamiento_de_agua_contratados text,
  capacidad_lts_tanques_contratados text,
  cantidad_carrotanques_contratadas text,
  capacidad_lt_crrt_contratadas text,
  dias_suministro_crrt_contratada text,
  cntd_vactor_contratadas text,
  capacidad_lt_vactor_contratada text,
  dias_suministro_vactor_contratada text,
  cantidad_maquinas_m_a_contratadas text,
  horas_maquina_m_a text,
  dias_volqueta_m_a_contratadas text,
  cantidad_de_tanques_de_almacenamiento_de_agua_ejecutadas text,
  capacidad_lt_tanques_ejecutados text,
  cantidad_carrotanques_ejecutadas text,
  capacidad_lt_2_crrt text,
  dias_suministro_crrt text,
  cntd_vactor_ejecutadas text,
  capacidad_lt_vactor_ejecutadas text,
  dias_suministro_vactor_ejecutadas text,
  cantidad_maquinas_m_a_ejecutadas text,
  horas_maquina_m_a_ejecutadas text,
  dias_volqueta_m_a_ejecutadas text,
  vigencia text,
  proveedor text,
  municipio text,
  departamento text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT control_y_seguimiento_detalle_m_pkey PRIMARY KEY (record_id),
  CONSTRAINT control_y_seguimiento_detalle_m_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.control_y_seguimiento_detalle_m IS 'Silver — agua hoja Excel «control y seguimiento-detalle m» (desde agua.control_y_seguimiento_detalle_m)';
COMMENT ON COLUMN silver_agua.control_y_seguimiento_detalle_m.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.control_y_seguimiento_detalle_m.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.control_y_seguimiento_detalle_m.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_control_y_seguimiento_detalle_m_op ON silver_agua.control_y_seguimiento_detalle_m (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_control_y_seguimiento_detalle_m_synced ON silver_agua.control_y_seguimiento_detalle_m (synced_at);
CREATE INDEX IF NOT EXISTS idx_control_y_seguimiento_detalle_m_depto ON silver_agua.control_y_seguimiento_detalle_m (departamento);
CREATE INDEX IF NOT EXISTS idx_control_y_seguimiento_detalle_m_muni ON silver_agua.control_y_seguimiento_detalle_m (municipio);

DROP TABLE IF EXISTS silver_agua.variables_lider CASCADE;
CREATE TABLE silver_agua.variables_lider (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  orden_de_proveeduria text,
  administracion text,
  procesos_juridicos text,
  nombre_orden text,
  categorizacion text,
  responsable_apoyo_a_la_supervision text,
  tecnico_asignado text,
  abogado_asignado_r_tecnica text,
  financiero_asignado text,
  fecha_de_aval text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variables_lider_pkey PRIMARY KEY (record_id),
  CONSTRAINT variables_lider_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_agua.variables_lider IS 'Silver — agua hoja Excel «Variables líder» (desde agua.variables_lider)';
COMMENT ON COLUMN silver_agua.variables_lider.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_agua.variables_lider.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_agua.variables_lider.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';
CREATE INDEX IF NOT EXISTS idx_variables_lider_op ON silver_agua.variables_lider (orden_de_proveeduria);
CREATE INDEX IF NOT EXISTS idx_variables_lider_synced ON silver_agua.variables_lider (synced_at);

-- === silver_puentes ===
CREATE SCHEMA IF NOT EXISTS silver_puentes;

COMMENT ON SCHEMA silver_puentes IS 'Silver relacional Puentes: inventario + contratos + bitácora (FKs id_puente / clave_proceso)';

DROP TABLE IF EXISTS silver_puentes.contratos_estructuracion CASCADE;
CREATE TABLE silver_puentes.contratos_estructuracion (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  contrato_convenio text,
  clave_proceso text,
  tipo_vinculo text,
  descripcion_proceso text,
  valor numeric,
  vigencia text,
  tipo_proceso text,
  grupo text,
  etapa text,
  estado text,
  area text,
  responsable text,
  fecha_inicio_proceso text,
  fecha_fin_proceso text,
  plazo_ejecucion text,
  tiempo_etapa_dias text,
  tiempo_acumulado_dias text,
  alerta text,
  comentarios text,
  reporte text,
  convenio_o_cto text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contratos_estructuracion_pkey PRIMARY KEY (record_id),
  CONSTRAINT contratos_clave_proceso_uq UNIQUE (clave_proceso),
  CONSTRAINT contratos_convenio_uq UNIQUE (convenio_o_cto)
);

COMMENT ON TABLE silver_puentes.contratos_estructuracion IS 'Silver — puentes hoja Excel «Contratos Estructuracion» (desde puentes.contratos_estructuracion)';
COMMENT ON COLUMN silver_puentes.contratos_estructuracion.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_puentes.contratos_estructuracion.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_puentes.contratos_estructuracion.clave_proceso IS 'Llave de proceso (hub contratos); UNIQUE';
COMMENT ON COLUMN silver_puentes.contratos_estructuracion.convenio_o_cto IS 'Texto Excel convenio/cto; UNIQUE en datos actuales';
CREATE INDEX IF NOT EXISTS idx_contratos_clave ON silver_puentes.contratos_estructuracion (clave_proceso);
CREATE INDEX IF NOT EXISTS idx_contratos_convenio ON silver_puentes.contratos_estructuracion (convenio_o_cto);
CREATE INDEX IF NOT EXISTS idx_contratos_synced ON silver_puentes.contratos_estructuracion (synced_at);

DROP TABLE IF EXISTS silver_puentes.base_general_puentes CASCADE;
CREATE TABLE silver_puentes.base_general_puentes (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  id_puente text,
  codigo_operativo text,
  clase text,
  tipo text,
  configuracion text,
  ano_compra text,
  longitud_m text,
  capacidad_ton text,
  clasificacion_propiedad text,
  valor numeric,
  ubicacion_actual text,
  region text,
  departamento text,
  municipio text,
  personas_beneficiadas text,
  latitud text,
  longitud text,
  entidad_receptora text,
  estado text,
  estado_puente text,
  situacion_prestamo text,
  fecha_inicio_estado_actual text,
  fecha_fin_estado_actual text,
  fecha_desde_ultimo_estado text,
  observaciones text,
  contrato_convenio text,
  contrato text,
  clave_proceso text,
  tipo_vinculo text,
  descripcion_proceso text,
  convenio_o_cto text,
  id_unico text,
  id text,
  origen_adquisicion text,
  proceso_sigla text,
  numero_unidad text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT base_general_puentes_pkey PRIMARY KEY (record_id),
  CONSTRAINT base_general_id_puente_uq UNIQUE (id_puente),
  CONSTRAINT base_general_clave_fk FOREIGN KEY (clave_proceso)
    REFERENCES silver_puentes.contratos_estructuracion (clave_proceso)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_puentes.base_general_puentes IS 'Silver — puentes hoja Excel «Base General Puentes» (desde puentes.base_general_puentes)';
COMMENT ON COLUMN silver_puentes.base_general_puentes.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_puentes.base_general_puentes.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_puentes.base_general_puentes.id_puente IS 'Activo; UNIQUE; hub inventario';
COMMENT ON COLUMN silver_puentes.base_general_puentes.clave_proceso IS 'FK nullable → contratos_estructuracion.clave_proceso';
CREATE INDEX IF NOT EXISTS idx_bgp_id_puente ON silver_puentes.base_general_puentes (id_puente);
CREATE INDEX IF NOT EXISTS idx_bgp_clave ON silver_puentes.base_general_puentes (clave_proceso);
CREATE INDEX IF NOT EXISTS idx_bgp_convenio ON silver_puentes.base_general_puentes (convenio_o_cto);
CREATE INDEX IF NOT EXISTS idx_bgp_depto ON silver_puentes.base_general_puentes (departamento);
CREATE INDEX IF NOT EXISTS idx_bgp_muni ON silver_puentes.base_general_puentes (municipio);
CREATE INDEX IF NOT EXISTS idx_bgp_synced ON silver_puentes.base_general_puentes (synced_at);

DROP TABLE IF EXISTS silver_puentes.bitacora CASCADE;
CREATE TABLE silver_puentes.bitacora (
  record_id uuid NOT NULL,
  theme_id text NOT NULL,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  capa text,
  tipo_registro text,
  clave_seguimiento text,
  id_puente text,
  codigo_operativo text,
  tipo text,
  cantidad_viajes text,
  ubicacion_actual text,
  region text,
  departamento text,
  municipio text,
  vereda text,
  ente_receptor text,
  situacion_prestamo text,
  estado_puente text,
  fecha_inicio text,
  fecha_fin text,
  fecha_corte_reporte text,
  fundamento text,
  observaciones text,
  nombre_hoja_reporte text,
  convenio_o_cto text,
  contrato_convenio text,
  clave_proceso text,
  tipo_vinculo text,
  id_unico text,
  id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bitacora_pkey PRIMARY KEY (record_id),
  CONSTRAINT bitacora_id_puente_fk FOREIGN KEY (id_puente)
    REFERENCES silver_puentes.base_general_puentes (id_puente)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT bitacora_clave_fk FOREIGN KEY (clave_proceso)
    REFERENCES silver_puentes.contratos_estructuracion (clave_proceso)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE silver_puentes.bitacora IS 'Silver — puentes hoja Excel «bitacora» (desde puentes.bitacora)';
COMMENT ON COLUMN silver_puentes.bitacora.record_id IS 'PK linaje → public.records.id';
COMMENT ON COLUMN silver_puentes.bitacora.synced_at IS 'Timestamp del último sync Bronze→Silver';
COMMENT ON COLUMN silver_puentes.bitacora.id_puente IS 'FK → base_general_puentes.id_puente';
COMMENT ON COLUMN silver_puentes.bitacora.clave_proceso IS 'FK nullable → contratos_estructuracion.clave_proceso';
CREATE INDEX IF NOT EXISTS idx_pbit_id_puente ON silver_puentes.bitacora (id_puente);
CREATE INDEX IF NOT EXISTS idx_pbit_clave ON silver_puentes.bitacora (clave_proceso);
CREATE INDEX IF NOT EXISTS idx_pbit_convenio ON silver_puentes.bitacora (convenio_o_cto);
CREATE INDEX IF NOT EXISTS idx_pbit_depto ON silver_puentes.bitacora (departamento);
CREATE INDEX IF NOT EXISTS idx_pbit_muni ON silver_puentes.bitacora (municipio);
CREATE INDEX IF NOT EXISTS idx_pbit_synced ON silver_puentes.bitacora (synced_at);


-- === Catálogo Silver en medallion ===
CREATE SCHEMA IF NOT EXISTS medallion;

DROP VIEW IF EXISTS medallion.v_silver_catalog CASCADE;
CREATE VIEW medallion.v_silver_catalog AS
SELECT * FROM (VALUES
  ('silver_agua.orden', 'silver_agua', 'orden', 'agua-y-saneamiento', 'dim', 'Dim OP (unión de llaves)', 'SELECT * FROM silver_agua.orden'),
  ('silver_agua.general', 'silver_agua', 'general', 'agua-y-saneamiento', 'General', 'Hub General 1:1 OP', 'SELECT * FROM silver_agua.general'),
  ('silver_agua.bitacora', 'silver_agua', 'bitacora', 'agua-y-saneamiento', 'bitacora', 'Eventos estado', 'SELECT * FROM silver_agua.bitacora'),
  ('silver_agua.pagos', 'silver_agua', 'pagos', 'agua-y-saneamiento', 'PAGOS', 'Desembolsos', 'SELECT * FROM silver_agua.pagos'),
  ('silver_agua.modificaciones', 'silver_agua', 'modificaciones', 'agua-y-saneamiento', 'modificaciones', 'Modificaciones contractuales', 'SELECT * FROM silver_agua.modificaciones'),
  ('silver_agua.cdps_y_rc', 'silver_agua', 'cdps_y_rc', 'agua-y-saneamiento', 'CDPS Y RC', 'CDP / RC', 'SELECT * FROM silver_agua.cdps_y_rc'),
  ('silver_agua.bitacora_estructuracion', 'silver_agua', 'bitacora_estructuracion', 'agua-y-saneamiento', 'bitacora estructuracion', 'Seguimiento operativo', 'SELECT * FROM silver_agua.bitacora_estructuracion'),
  ('silver_agua.control_y_seguimiento_detalle_m', 'silver_agua', 'control_y_seguimiento_detalle_m', 'agua-y-saneamiento', 'control y seguimiento-detalle m', 'Control físico', 'SELECT * FROM silver_agua.control_y_seguimiento_detalle_m'),
  ('silver_agua.variables_lider', 'silver_agua', 'variables_lider', 'agua-y-saneamiento', 'Variables líder', 'Facetas líder', 'SELECT * FROM silver_agua.variables_lider'),
  ('silver_puentes.contratos_estructuracion', 'silver_puentes', 'contratos_estructuracion', 'puentes', 'Contratos Estructuracion', 'Hub proceso', 'SELECT * FROM silver_puentes.contratos_estructuracion'),
  ('silver_puentes.base_general_puentes', 'silver_puentes', 'base_general_puentes', 'puentes', 'Base General Puentes', 'Inventario / activo', 'SELECT * FROM silver_puentes.base_general_puentes'),
  ('silver_puentes.bitacora', 'silver_puentes', 'bitacora', 'puentes', 'bitacora', 'Eventos de estado', 'SELECT * FROM silver_puentes.bitacora')
) AS t(source_id, schema_name, table_name, theme_id, sheet, description, sample_sql);

DROP VIEW IF EXISTS medallion.v_silver_join_map CASCADE;
CREATE VIEW medallion.v_silver_join_map AS
SELECT * FROM (VALUES
  ('silver_agua', 'silver_agua.bitacora', 'silver_agua.orden', 'orden_de_proveeduria', 'primaria', 'Satélite → dim OP', 'SELECT b.*, o.* FROM silver_agua.bitacora b JOIN silver_agua.orden o ON o.orden_de_proveeduria = b.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.bitacora', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Bitácora → General (vía OP; LEFT si huérfana)', 'SELECT b.*, g.proveedor FROM silver_agua.bitacora b LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.pagos', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Pagos → General', 'SELECT p.*, g.proveedor FROM silver_agua.pagos p LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = p.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.modificaciones', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Modificaciones → General', 'SELECT m.*, g.proveedor FROM silver_agua.modificaciones m LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = m.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.cdps_y_rc', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'CDPS/RC → General', 'SELECT c.*, g.objeto FROM silver_agua.cdps_y_rc c LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = c.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.control_y_seguimiento_detalle_m', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Control → General', 'SELECT ct.*, g.tipo_de_orden FROM silver_agua.control_y_seguimiento_detalle_m ct LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = ct.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.general', 'silver_agua.orden', 'orden_de_proveeduria', 'primaria', 'General 1:1 dim OP', 'SELECT g.* FROM silver_agua.general g JOIN silver_agua.orden o ON o.orden_de_proveeduria = g.orden_de_proveeduria'),
  ('silver_puentes', 'silver_puentes.bitacora', 'silver_puentes.base_general_puentes', 'id_puente', 'primaria', 'Bitácora → inventario (FK)', 'SELECT b.*, i.clase FROM silver_puentes.bitacora b JOIN silver_puentes.base_general_puentes i ON i.id_puente = b.id_puente'),
  ('silver_puentes', 'silver_puentes.bitacora', 'silver_puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Bitácora → contratos (FK nullable)', 'SELECT b.*, e.etapa FROM silver_puentes.bitacora b LEFT JOIN silver_puentes.contratos_estructuracion e ON e.clave_proceso = b.clave_proceso'),
  ('silver_puentes', 'silver_puentes.base_general_puentes', 'silver_puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Inventario → contratos (FK nullable)', 'SELECT i.*, e.etapa FROM silver_puentes.base_general_puentes i LEFT JOIN silver_puentes.contratos_estructuracion e ON e.clave_proceso = i.clave_proceso')
) AS t(schema_name, left_table, right_table, join_key, priority, description, sample_sql);

