# Tema: Agua y Saneamiento

| | |
|---|---|
| **ID / slug** | `agua-y-saneamiento` |
| **Ruta** | `/app/temas/agua-y-saneamiento` |
| **Clave** | `orden_de_proveeduria` |
| **schemaVersion** | 7 |

## Tablas actualizables (append → alimentan Maqueta)

Estas hojas/formularios **sí se actualizan** con el tiempo; cada registro nuevo entra al historial:

| Formulario | Capa | Fuente Excel |
|------------|------|--------------|
| **Modificaciones** | `Modificación contractual` | hoja `modificaciones` (incluye plazo / forma de pago) |
| **Bitácora** | `Bitácora estado` | hoja `bitacora` (`Bitacora Agua y Saneamiento def (1).xlsx`) |
| **Pagos** | `Pago / desembolso` | hoja `PAGOS` |
| **CDPS y RC** | `CDPS y RC` | hoja `CDPS Y RC` |
| **Bitácora estructuración** | `Bitácora estructuración` | hoja `bitacora estructuracion` |

## Otras capas

| Formulario | Modo | Notas |
|------------|------|-------|
| Alta / registro inicial | create-once | Estática (A–S, V–X). Geo = depto/municipio DIVIPOLA (sin coordenadas de punto) |
| Variables del líder | upsert | Y, Z, AA, AB + asignaciones |
| Control ejecución física | upsert | hoja control |

> **Nota:** Antes existía un formulario aparte «Modificación plazo / forma de pago». Quedó unificado en **Modificaciones**, igual que la única pestaña del Excel.
>
> Listas (hoja Excel `LISTAS`):
> - **Tipo de modificación** → `ALCANCE` · `ADICION` · `MODIFICACION` · `PRORROGA`
> - **Modificación** (qué cambia) → `Valor OP` · `Horas Maquina` · `Dias Volqueta` · `Plazo Ejecucion` · `Forma de Pago` · `Aclaratorio`
> - **Forma de Pago** → `Único Pago` · `2 Pagos` · `3 Pagos`
>
> Listas (hoja Excel `CDPS Y RC` · columnas de estado, no el N°):
> - **CDP** (`no_cdp`) → `Con CDP` · `Sin CDP` · `CDP Anulado`
> - **RC** (`no_rc`) → `Con RC` · `Sin RC` · `sin info`

> **Maqueta vigente:** cada vez que se agrega un evento en Bitácora / Pagos / Modificaciones / Estructuración, la fila **Alta / orden** se actualiza con el **último** dato (estado actual, proceso, dependencia, fechas, pago, etc.). El historial completo queda en la capa append y en Base Excel.

### Días en Maqueta (calculados, no se digitan)

Alimentan columnas AY–BH y BT vía `maqueta-dias.ts` (llamado desde `maqueta-sync.ts`):

| Campo | Fórmula (días hábiles lun–vie, tipo Excel `NETWORKDAYS`) |
|-------|----------------------------------------------------------|
| `dias_en_tecnico`, `dias_en_proveedor`, `dias_contractual`, `dias_financiera`, `dias_subdirector`, `dias_subdireccion_general`, `dias_gafc`, `dias_fiduprevisora` | Por cada evento de Bitácora (ordenado por `fecha_estado`): días hasta el siguiente evento de la misma OP (o hasta hoy en el último). Se suman por `dependencia`. |
| `dias_totales_en_la_linea` | `NETWORKDAYS(fecha_de_asignacion, fecha_de_pago \| hoy)` |
| `dias_en_gestion_de_pagos` | Desde la primera `fecha_estado` con estado «Tramite de Solicitud de Pago» hasta `fecha_de_pago` o hoy |
| `dias_desde_ult_gestion` | `NETWORKDAYS(última fecha_estado, hoy)` |

Definición: `capture-forms.ts` · campos: `fields-from-source.ts` · listas: `select-options.ts` · sync: `maqueta-sync.ts` · días: `maqueta-dias.ts`.

## Edición con trazabilidad (Variables líder, control, etc.)

1. En captura → formulario upsert (p. ej. Variables del líder).
2. Busque la OP del alta (`GS-…`): si ya hay datos de esa capa, **se precargan**.
3. Edite y guarde → se crea **versión** (historial).
4. En pestaña **Base Excel**: badge `vN`, celdas con ✨ y panel **Historial** (icono) para ver/restaurar cambios.

