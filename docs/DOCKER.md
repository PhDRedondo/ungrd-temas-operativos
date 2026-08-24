# Despliegue Docker (sin Vercel)

Stack **100% open source** empaquetado para Git, desarrollo local, VM o **Alibaba Cloud** (ACK / ECS + contenedor).

## Requisitos

- Docker 24+ y Docker Compose v2
- ~2 GB RAM libre (app + Postgres)

## Arranque rápido

```bash
cp .env.docker.example .env.docker
# Editar AUTH_SECRET en .env.docker (mín. 32 caracteres en prod)

docker compose --profile app up -d --build
```

Abrir **http://localhost:3000**

- Login demo: `admin@ungrd.gov.co` / `UNGRD2026` (o `DEMO_AUTH_*` en `.env.docker`)
- Health: `curl -s http://localhost:3000/api/health`

## Servicios

| Servicio | Perfil | Puerto | Rol |
|----------|--------|--------|-----|
| `postgres` | (base) | 5432 | PostgreSQL app |
| `migrate` | `app` | — | `drizzle-kit push` + seed (one-shot) |
| `app` | `app` | 3000 | Next.js standalone |
| `keycloak` | `keycloak` | 8080 | OIDC opcional |

### Solo Postgres (dev con `npm run dev` en el host)

Compatible con [LOCAL.md](./LOCAL.md):

```bash
docker compose up -d postgres
npm run db:setup
npm run dev
```

### App + Keycloak

```bash
docker compose --profile app --profile keycloak up -d --build
```

Ajustar en `.env.docker`: `AUTH_MODE=keycloak`, `KEYCLOAK_ISSUER=http://localhost:8080/realms/ungrd`, etc.

## Scripts npm

```bash
npm run docker:up      # compose --profile app up -d --build
npm run docker:down    # baja app + migrate (Postgres persiste)
npm run docker:logs    # logs del contenedor app
npm run docker:build   # solo build imagen
```

## Volúmenes persistentes

| Volumen | Contenido |
|---------|-----------|
| `ungrd_pg_data` | Base PostgreSQL |
| `ungrd_uploads` | Excel subidos |
| `ungrd_app_data` | Cuentas demo (`.data/demo-accounts.json`) |
| `ungrd_kc_data` | Keycloak DB |

## Variables importantes

Fuente: [`.env.docker.example`](../.env.docker.example)

| Variable | Notas |
|----------|--------|
| `AUTH_URL` | URL **pública** HTTPS en Alibaba (no localhost) |
| `AUTH_SECRET` | Secreto fuerte; obligatorio en prod |
| `DATABASE_URL` | Compose default: Postgres del stack. **En Alibaba/prod y para alinear QuickBI:** URL Supabase pooler Session `:5432` (misma que local recomendado) |
| `QUICKBI_UPSTREAM_BASE_URL` | Backend SNI para tickets embed |
| `MEDALLION_DATABASE_URL` | Reader medallón (misma instancia Supabase) |
| `ACL_STRICT` | `true` en producción |

> **Alineación Dashboard ↔ QuickBI:** local y despliegue deben usar la misma
> `DATABASE_URL` de Supabase. El Postgres del compose es solo para demos offline.

## Imagen Docker

- Dockerfile: [`docker/Dockerfile`](../docker/Dockerfile)
- Build multi-stage: `deps` → `builder` (Next standalone) → `runner`
- Job `migrator`: schema + seed antes de levantar `app`

Build manual:

```bash
docker build -f docker/Dockerfile --target runner -t ungrd-temas:latest .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://ungrd:ungrd@host.docker.internal:5432/ungrd_temas \
  -e AUTH_URL=http://localhost:3000 \
  -e AUTH_SECRET=dev-secret-min-32-characters-long \
  ungrd-temas:latest
```

## Alibaba Cloud (orientación)

1. **Registry**: push de `ungrd-temas:latest` a ACR (Alibaba Container Registry).
2. **Postgres**: RDS PostgreSQL o contenedor managed; actualizar `DATABASE_URL`.
3. **App**: ACK (Kubernetes) o ECS con compose; `AUTH_URL` = dominio público + TLS (SLB/ALB).
4. **Secretos**: Parameter Store / KMS — no commitear `.env.docker`.
5. **QuickBI**: mantener `QUICKBI_UPSTREAM_BASE_URL` o AccessKey propio.
6. **Persistencia**: montar NAS/OSS para `uploads` si hay varias réplicas.

No se requiere Vercel ni Upstash (rate limit en memoria por instancia).

## Verificación post-deploy

```bash
curl -s https://tu-dominio/api/health
SMOKE_BASE=https://tu-dominio npm run smoke
```

## Relación con Vercel

El despliegue Vercel existente **no se modifica**: `output: "standalone"` en `next.config.ts` es compatible con ambos. Docker es una vía alternativa documentada en [DEPLOY.md](./DEPLOY.md).
