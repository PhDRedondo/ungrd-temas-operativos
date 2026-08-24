# Desarrollo local

## Prerrequisitos

| Herramienta | Notas |
|-------------|--------|
| Node.js 20+ | Recomendado LTS |
| npm 10+ | Viene con Node |
| Supabase (recomendado) | Misma `DATABASE_URL` que prod / QuickBI medallón |
| PostgreSQL Docker | Solo si necesitas offline aislado |
| Docker (opcional) | App completa / Keycloak — ver [DOCKER.md](./DOCKER.md) |

## Setup (recomendado: Supabase = local = despliegue)

Así el **Dashboard Operativo** y **QuickBI** miran la misma fuente.

```bash
git clone <repo>
cd ungrd-temas-operativos
cp .env.example .env.local
npm install
```

En `.env.local`:

1. Define `MEDALLION_DATABASE_URL` (reader).
2. Genera la URL de app (escritura, pooler Session `:5432`):

```bash
npx tsx scripts/print-vercel-database-url.ts
# Copia la línea postgresql://postgres.<ref>:… en DATABASE_URL
```

```env
DATABASE_URL=postgresql://postgres.<ref>:…@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require
MEDALLION_DATABASE_URL=postgresql://medallion_reader.<ref>:…@…:5432/postgres?sslmode=require
AUTH_MODE=demo
AUTH_URL=http://localhost:3000
AUTH_SECRET=ungrd-dev-secret-change-me-in-prod
ACL_STRICT=false
QUICKBI_UPSTREAM_BASE_URL=https://apisni.soft180.co
```

**No** hace falta `npm run db:setup` contra Supabase (el schema ya está en prod).

```bash
npm run dev
```

Abrir http://localhost:3000 — demo: `admin@ungrd.gov.co` / `UNGRD2026`.  
Health debe mostrar host pooler Supabase (`db:"up"`).

## Postgres vía Docker (offline / aislado)

Solo si no puedes usar Supabase. **Los números no coincidirán con QuickBI.**

```bash
docker compose up -d postgres
# DATABASE_URL=postgresql://ungrd:ungrd@127.0.0.1:5432/ungrd_temas
npm run db:setup
npm run dev
```

## App completa en Docker (sin Vercel)

```bash
cp .env.docker.example .env.docker
npm run docker:up
# http://localhost:3000 — ver docs/DOCKER.md
```

## Stack completo (Keycloak)

```bash
npm run stack:up
# http://localhost:8080  admin/admin
```

Ajustar `.env.local` a `AUTH_MODE=keycloak` (ver [BACKEND.md](./BACKEND.md)).

## Verificación

```bash
npm run harness:env
npm run harness:back     # requiere dev o start
npm run harness:front
npm run harness          # todo
npm run smoke
```

## Estructura útil al debuggear

| Síntoma | Revisar |
|---------|---------|
| DB down | `DATABASE_URL`, `pg_isready`, `npm run db:setup` |
| Mapa vacío / error | `public/geo/departamentos-mgn2024.json` · Network `/geo/...` |
| Upload 500 | Logs terminal · Zod en `record-schema.ts` |
| Sin temas | `/api/me/access` · `ACL_STRICT` · seed |
| Sesión | `/api/auth/session` · cookies |

## Variables de entorno

Fuente de verdad: [`.env.example`](../.env.example). Nunca commitear `.env.local`.
