# Checklist pre-despliegue

## Docker (sin Vercel — recomendado para Alibaba)

Ver guía completa: [DOCKER.md](./DOCKER.md)

```bash
cp .env.docker.example .env.docker
docker compose --profile app up -d --build
curl -s http://localhost:3000/api/health
```

## Antes de publicar (Vercel / Cloud Run / Alibaba)

### 1. Calidad local

```bash
npm run typecheck
npm run build
npm run harness          # requiere npm run dev
npm run harness:security
```

### 2. Base de datos (RDS Alibaba)

La base operativa es PostgreSQL 18 en RDS de Alibaba Cloud. La app y QuickBI usan la misma instancia, con `sslmode=disable`. Guía: [platform/ALIBABA-RDS.md](./platform/ALIBABA-RDS.md).

El schema y los datos ya están en ese RDS. `npm run db:setup` solo hace falta en una base vacía (Docker offline). No correr el seed demo contra el RDS.

### 3. Variables de entorno en el host

| Variable | Local | Producción (Vercel) |
|----------|-------|---------------------|
| `DATABASE_URL` | RDS Alibaba, `sslmode=disable` | La misma instancia |
| `MEDALLION_DATABASE_URL` | La misma instancia | La misma instancia |
| `AUTH_SECRET` | dev | **secreto fuerte nuevo** |
| `AUTH_URL` | http://localhost:3000 | `https://ungrd-manejo-phi.vercel.app` |
| `AUTH_MODE` | demo | `keycloak` (recomendado) |
| `ACL_STRICT` | false | **true** |
| `SECURITY_ENABLED` | true | true |
| `SECURITY_ALLOW_LOCALHOST` | true | **false** |

### 4. Seguridad

Ver [SECURITY.md](./SECURITY.md) checklist.

Rotar password DB y service role si se expusieron en chat/correo.

### 5. Smoke post-deploy

```bash
SMOKE_BASE=https://tu-dominio npm run smoke
curl -s https://tu-dominio/api/health
```

Health debe responder `db:"up"`.

### 6. Datos

- Formularios schemaVersion **3** (capas + `clave_seguimiento`).
- Documentación: [platform/DATA-MODEL-ANALYSIS.md](./platform/DATA-MODEL-ANALYSIS.md).
