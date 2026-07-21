/**
 * Campos generados desde fuentes reales (maqueta / bitácora / ArcGIS).
 * NO editar a mano — regenerar: node scripts/generate-theme-fields.cjs
 * Fuente: MAQUETA+Bitacora+SUMINISTRO DEF
 * schemaVersion 3: capas + clave_seguimiento para cruces y seguimiento.
 */
import type { FormField } from "../shared";

export const SOURCE_FIELDS: FormField[] = [
  { name: "tipo_registro", label: "Tipo de registro", type: "select", required: true, options: ["Maqueta / inventario","Bitácora estado","Suministro / viajes"], excelWidth: 24 },
  { name: "capa", label: "Capa (Maqueta / Bitácora / …)", type: "select", required: true, options: ["Maqueta / inventario","Bitácora estado","Suministro / viajes"], excelWidth: 22 },
  { name: "clave_seguimiento", label: "Clave de seguimiento (Placa)", type: "text", excelWidth: 28 },
  { name: "placa", label: "Placa", type: "text", excelWidth: 22 },
  { name: "valor", label: "Valor (COP)", type: "number", excelWidth: 16 },
  { name: "fecha", label: "Fecha", type: "date", excelWidth: 16 },
  { name: "no", label: "No.", type: "text", excelWidth: 18 },
  { name: "placa_ungrd", label: "Placa UNGRD", type: "text", excelWidth: 18 },
  { name: "clase", label: "Clase", type: "text", excelWidth: 18 },
  { name: "marca", label: "Marca", type: "text", excelWidth: 18 },
  { name: "modelo_ref", label: "Modelo-REF", type: "text", excelWidth: 18 },
  { name: "serial", label: "Serial", type: "text", excelWidth: 18 },
  { name: "modelo", label: "Modelo", type: "text", excelWidth: 18 },
  { name: "ano_compra", label: "Año compra", type: "number", excelWidth: 18 },
  { name: "capacidad_lt", label: "Capacidad LT", type: "number", excelWidth: 18 },
  { name: "otras_categorizaciones", label: "Otras Categorizaciones", type: "text", excelWidth: 18 },
  { name: "clasificacion_propiedad", label: "Clasificacion Propiedad", type: "text", excelWidth: 18 },
  { name: "ubicacion_actual", label: "Ubicacion Actual", type: "text", excelWidth: 18 },
  { name: "departamento", label: "Departamento", type: "text", excelWidth: 18 },
  { name: "municipio", label: "Municipio", type: "text", excelWidth: 18 },
  { name: "region", label: "Region", type: "text", excelWidth: 18 },
  { name: "lt_suministrados", label: "Lt Suministrados", type: "number", excelWidth: 18 },
  { name: "per_benef", label: "Per/Benef", type: "number", excelWidth: 18 },
  { name: "com_benef", label: "Com/ Benef", type: "number", excelWidth: 18 },
  { name: "fecha_inicio_estado_actual", label: "Fecha Inicio Estado Actual", type: "date", excelWidth: 28 },
  { name: "fech_fin_estado_actual", label: "Fech Fin Estado Actual", type: "date", excelWidth: 18 },
  { name: "fecha_desde_ultm_estado", label: "Fecha desde Ultm Estado", type: "date", excelWidth: 18 },
  { name: "entidad_receptora", label: "Entidad Receptora", type: "text", excelWidth: 18 },
  { name: "estado", label: "Estado CARROTANQUE", type: "text", excelWidth: 18 },
  { name: "situacion_de_prestamo", label: "Situación DE PRESTAMO", type: "text", excelWidth: 18 },
  { name: "observaciones", label: "OBSERVACIONES", type: "textarea", excelWidth: 18 },
  { name: "cantidad_de_viajes", label: "Cantidad de viajes", type: "number", excelWidth: 18 },
  { name: "ente_receptor", label: "Ente receptor", type: "text", excelWidth: 18 },
  { name: "fecha_fin", label: "Fecha Fin", type: "date", excelWidth: 18 },
  { name: "fecha_corte_del_reporte", label: "FECHA CORTE DEL REPORTE", type: "date", excelWidth: 18 },
  { name: "fundamento", label: "Fundamento", type: "text", excelWidth: 18 },
  { name: "nombre_hoja_reporte", label: "Nombre hoja reporte", type: "text", excelWidth: 18 },
  { name: "cap_gls", label: "Cap-Gls", type: "text", excelWidth: 18 },
  { name: "cap_lts", label: "Cap-Lts", type: "text", excelWidth: 18 },
  { name: "ente_receptor_sitio_de_suministro", label: "Ente receptor-Sitio de suministro", type: "text", excelWidth: 28 },
  { name: "litros_suministrados", label: "Litros Suministrados", type: "number", excelWidth: 18 },
  { name: "personas_beneficiadas", label: "Personas Beneficiadas", type: "text", excelWidth: 18 },
  { name: "comunidades_beneficiadas", label: "Comunidades Beneficiadas", type: "text", excelWidth: 18 },
];

export const SCHEMA_VERSION = 3;
