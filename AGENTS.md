# AGENTS.md — instrucciones para agentes de IA

## Contexto del producto

MVP **UNGRD Temas Operativos**: captura + Excel DIVIPOLA + analítica/mapa sobre PostgreSQL.  
Stack open source (Auth.js / Keycloak — **no Clerk**).

## Leer antes de editar

1. [`docs/MEMORY.md`](docs/MEMORY.md) — decisiones y estado  
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — capas  
3. [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — alcance  
4. Este archivo + reglas en `.cursor/rules/`

## Next.js

Esta versión (16) puede diferir del conocimiento entrenado. Revisar `node_modules/next/dist/docs/` ante dudas de APIs.

## Límites

- **No inventar** municipios / geo: solo DIVIPOLA / MGN.
- **No** reintroducir persistencia solo-cliente para datos de negocio.
- Temas: editar solo `src/themes/<slug>/` salvo que pidan cambio de núcleo.
- No hacer push/deploy ni commits destructivos sin petición explícita.
- No implementar capa agéntica externa salvo que el usuario lo pida (otro proyecto).

## Dónde vive cada cosa

| Necesidad | Ruta |
|-----------|------|
| Schema tema | `src/themes/<slug>/theme.ts` |
| API | `src/app/api/**` |
| Validación / Excel | `src/lib/validation`, `src/lib/excel` |
| Geo | `src/lib/geo.ts`, `data/divipola.json`, `public/geo/` |
| DB | `src/db/schema.ts` |
| Verificación | `scripts/harness/**`, `scripts/smoke-local.ts` |
| Docs | `docs/**` |

## Tras cambios importantes

- Actualizar docs afectados (`API`, `ARCHITECTURE`, `MEMORY`).
- Correr `npm run harness` y/o `npm run smoke` con `npm run dev` activo.
