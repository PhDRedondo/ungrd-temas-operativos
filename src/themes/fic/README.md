# Tema: FIC

| | |
|---|---|
| **ID / slug** | `fic` |
| **Ruta** | `/app/temas/fic` |
| **Carpeta** | `src/themes/fic/` |

## Trabajo autónomo

1. Cree una rama: `feat/fic-descripcion`
2. Edite **solo** archivos dentro de esta carpeta (más el registro si es tema nuevo).
3. Abra un PR enfocado a este tema.

## Archivos

- `theme.ts` — configuración del tema (campos de captura, textos, icono).
- `index.ts` — reexporta el módulo.
- `README.md` — esta guía.

## Extensiones futuras (opcional en esta carpeta)

- `demo.ts` — generador de datos demo propio.
- `rules.ts` — validaciones de negocio.
- `components/` — UI específica del tema (si diverge del shell compartido).

## No modificar (núcleo compartido)

- `src/components/*` — shell, captura genérica, analítica.
- `src/themes/shared/*` — tipos y `buildTheme`.
- Otros directorios bajo `src/themes/<otro-tema>/`.
