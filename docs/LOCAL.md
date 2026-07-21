# Desarrollo local

## Prerrequisitos

| Herramienta | Notas |
|-------------|--------|
| Node.js 20+ | Recomendado LTS |
| npm 10+ | Viene con Node |
| PostgreSQL 14/16 | Homebrew o Docker |
| Docker (opcional) | Solo para Keycloak + compose completo |

## Setup

```bash
git clone <repo>
cd ungrd-temas-operativos
cp .env.example .env.local
npm install
```

Asegurar Postgres escuchando y que `DATABASE_URL` en `.env.local` coincida:

```env
DATABASE_URL=postgresql://ungrd:ungrd@127.0.0.1:5432/ungrd_temas
AUTH_MODE=demo
NEXT_PUBLIC_AUTH_MODE=demo
AUTH_SECRET=ungrd-dev-secret-change-me-in-prod
ACL_STRICT=false
```

Schema + seed:

```bash
npm run db:setup
```

App:

```bash
npm run dev
```

Abrir http://localhost:3000 — login demo: cualquier email + password ≥ 4 caracteres; rol `captura` para escribir.

## Postgres vía Docker (sin Keycloak)

```bash
docker compose up -d postgres
npm run db:setup
npm run dev
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
