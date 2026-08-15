# Tema: Subsidios de Arriendos

| | |
|---|---|
| **ID / slug** | `subsidios-de-arriendos` |
| **Ruta** | `/app/temas/subsidios-de-arriendos` |
| **Carpeta** | `src/themes/subsidios-de-arriendos/` |
| **Schema medallón** | `subsidios_arriendos.consolidado` |
| **Schema versión** | 3 |

## Cómo entra la información

La línea recibe un Excel por **envío**. El nombre del archivo trae el número de envío, municipio y departamento. Ese Excel se firma y va al gestor documental: es parte del proceso, no un formulario interno.

A partir de esos envíos se arma un **consolidado** (Bronze) con las columnas del archivo:

`numero_envio`, `n_orden`, `estado`, documentos y nombres de arrendador/arrendatario, `id_vivienda`, `tenencia`, `no_contrato`, `duracion`, fechas, `valor_total_pagado`, `lugar_giro`, `cod_oficina`, `cod_dane`, `municipio`, `departamento`, `_archivo_fuente`.

`uuid` existe en el Excel de consolidado para cruce; **no se pide en el formulario**. Si el alta es puntual, se genera al guardar.

**Ingesta en la app:** cargar ese consolidado (o el Excel de envío con las mismas columnas). El formulario de captura es opcional, para un alta puntual; no reemplaza el Excel.

## Llaves

| Campo | Uso |
|-------|-----|
| `numero_envio` + `n_orden` | Posición en el envío |
| `departamento` + `municipio` | Solo DIVIPOLA |
| `uuid` | Columna del Excel / identidad interna; no es campo de captura |

## Archivos

- `theme.ts` — contrato del tema
- `fields-from-source.ts` — columnas del consolidado
- `capture-forms.ts` — formulario opcional (misma capa)
- `select-options.ts` — estado / tenencia / tipo inmueble
- `index.ts` — reexporta el módulo

## Medallón

`SELECT * FROM subsidios_arriendos.consolidado;`  
JOIN futuro intra-schema por `uuid`.

## No modificar (núcleo)

- `src/components/*`, `src/themes/shared/*`, otros temas.
