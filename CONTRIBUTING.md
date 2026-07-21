# Guía de contribución

## Principio

1. **Temas autónomos** — cada tema misional vive en `src/themes/<slug>/`.
2. **Núcleo compartido** — `src/components`, `src/lib`, `src/db`, `src/app` solo en PRs de arquitectura.
3. **Docs vivos** — si cambia el comportamiento, actualizar `docs/` y una línea en `docs/MEMORY.md`.

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:setup
npm run dev
```

Verificación antes de PR:

```bash
npm run typecheck
npm run lint
# con la app arriba:
npm run harness
npm run smoke
```

## Flujo por desarrollador de tema

```bash
git checkout -b feat/<slug>-mi-cambio
# Editar únicamente src/themes/<slug>/**
git add src/themes/<slug>
git commit -m "feat(<slug>): descripción"
git push -u origin HEAD
```

Abrir Pull Request. Conventional commits: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.

## Qué sí / qué no

| Sí (carpeta del tema) | No (sin acuerdo de núcleo) |
|---|---|
| `extraFields`, textos, icono | Cambiar `src/components/*` |
| README del tema | Tocar otros `src/themes/<otro>/` |
| Reglas locales del módulo | Cambiar schema Drizzle / auth / ACL |
| | Quitar el tema del registro sin PR de arquitectura |

## Crear un tema nuevo

1. Copie **`src/themes/plantilla`** (línea base congelada; no la edite).
2. Renombre la carpeta y ajuste `theme.ts` (`id`, textos, `extraFields`).
3. Registre el módulo en `src/themes/index.ts`.
4. Actualice `.github/CODEOWNERS` con el owner del tema.
5. PR de arquitectura + tema.
6. Documente en `docs/MEMORY.md` si afecta contratos.

> `plantilla` se conserva intacta para comparar o restaurar temas. Solo arquitectura la actualiza.

Documentación detallada: [`src/themes/README.md`](src/themes/README.md).

## Cambios de backend / API

- Actualizar [`docs/API.md`](docs/API.md)
- Extender `scripts/harness` o `smoke-local.ts` si el camino es crítico
- No romper DIVIPOLA (geo oficial)

## Reglas de Cursor / agentes

- `.cursor/rules/theme-autonomy.mdc` — no tocar núcleo ni otros temas sin pedirlo
- `.cursor/rules/theme-module.mdc` — al editar un slug, permanecer en su carpeta
- Leer [`AGENTS.md`](AGENTS.md) y [`docs/MEMORY.md`](docs/MEMORY.md)
