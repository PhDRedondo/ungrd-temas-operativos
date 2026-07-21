# Mapa del repositorio

Abre esto si la raíz se ve “llena”. En proyectos Next.js **muchas configs deben vivir en la raíz** (Next, TypeScript, ESLint, npm). Lo importante es saber **qué leer primero**.

## Qué mirar (humano / socio)

| Archivo / carpeta | Para qué |
|-------------------|----------|
| [`README.md`](./README.md) | Arranque en 30 segundos |
| [`REQUIREMENTS.md`](./REQUIREMENTS.md) | Requisitos del producto |
| [`MEMORY.md`](./MEMORY.md) | Memoria: antes→ahora y decisiones |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Cómo aportar (temas autónomos) |
| [`docs/`](./docs/) | Documentación técnica completa |
| [`Makefile`](./Makefile) | Atajos: `make harness`, `make smoke` |

## Carpetas de producto

| Carpeta | Contenido |
|---------|-----------|
| `src/` | Código app (UI + API + dominio + temas) |
| `scripts/` | Arnés back/front/security + smoke |
| `docs/` | Specs, arquitectura, seguridad, ops |
| `data/` | DIVIPOLA y geo fuente (oficial) |
| `public/` | Estáticos web (branding, geo mapa) |
| `infra/` | Keycloak realm |
| `uploads/` | Excel locales (gitignore, no versionar) |

## Archivos de tooling (normal que estén en la raíz)

No los muevas: Next/npm los buscan aquí.

| Archivo | Herramienta |
|---------|-------------|
| `package.json` / `package-lock.json` | npm |
| `next.config.ts` / `next-env.d.ts` | Next.js |
| `tsconfig.json` | TypeScript |
| `eslint.config.mjs` | ESLint |
| `postcss.config.mjs` | Tailwind/PostCSS |
| `drizzle.config.ts` | ORM / DB |
| `docker-compose.yml` | Postgres + Keycloak |

## Agentes de IA

| Archivo | Nota |
|---------|------|
| `AGENTS.md` | Reglas para Cursor / agentes |
| `CLAUDE.md` | Puntero corto → AGENTS |

Detalle: [`docs/ai/`](./docs/ai/).

## Orden de lectura recomendado

1. `README.md`  
2. `REQUIREMENTS.md`  
3. `MEMORY.md`  
4. `docs/ARCHITECTURE.md`  
5. `docs/LOCAL.md` → levantar  
6. `docs/HARNESS.md` / `docs/SECURITY.md`  

```bash
make help
npm run harness
npm run smoke
```
