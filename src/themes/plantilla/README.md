# Tema: Plantilla (línea base — no modificar)

| | |
|---|---|
| **ID / slug** | `plantilla` |
| **Ruta** | `/app/temas/plantilla` |
| **Carpeta** | `src/themes/plantilla/` |
| **Estado** | **Referencia congelada** |

## Propósito

Este tema es la **plantilla canónica** de la plataforma. Sirve para:

1. **Comparar** un tema operativo que se haya degradado o perdido contra la línea base.
2. **Copiar** la estructura al crear un tema nuevo (`theme.ts` + `index.ts` + este README).
3. **Restaurar** campos y contrato mínimo (`valor`, geo, fechas, estado) si hace falta.

## Regla del equipo

> **No editar** `src/themes/plantilla/` en el trabajo diario de los temas operativos.
> Solo arquitectura puede actualizar la línea base, con PR dedicado y aviso al equipo.

Para trabajar un tema real, abra **su** carpeta (`src/themes/<slug>/`), no esta.

## Cómo usar la plantilla

```bash
# Crear tema nuevo a partir de la plantilla
cp -R src/themes/plantilla src/themes/mi-nuevo-tema
# Luego edite id, name, extraFields en mi-nuevo-tema/theme.ts
# y registre el módulo en src/themes/index.ts
```

```bash
# Diff de un tema dañado vs la plantilla
git diff --no-index src/themes/plantilla/theme.ts src/themes/<slug>/theme.ts
```

## Archivos

- `theme.ts` — configuración canónica (`buildTheme` + `extraFields` de ejemplo).
- `index.ts` — reexporta el módulo.
- `README.md` — esta guía.

## Contrato mínimo que ilustra

Además de geo + fecha/estado (vía `buildTheme`), la plantilla incluye:

| Campo | Tipo | Rol |
|---|---|---|
| `tipo_registro` | select | Categoría de ejemplo |
| `valor` | number | Inversión / monto (requerido por analítica) |
| `cantidad` | number | Métrica de unidad del tema |
| `responsable` | text | Texto libre de ejemplo |

## No modificar (núcleo compartido)

- `src/components/*`
- `src/themes/shared/*`
- Otros directorios bajo `src/themes/<otro-tema>/`
