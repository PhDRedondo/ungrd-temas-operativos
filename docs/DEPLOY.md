# Checklist pre-despliegue

## Antes de publicar (Vercel / Cloud Run)

### 1. Calidad local

```bash
npm run typecheck
npm run build
npm run harness          # requiere npm run dev
npm run harness:security
```

### 2. Base de datos (Supabase)

```bash
npm run db:setup           # schema legacy + seed temas
# migraciones plataforma (si aplica):
node -e "require('dotenv').config({path:'.env.local'}); require('child_process').spawnSync('psql',[process.env.DATABASE_URL,'-f','drizzle/migrations/0001_platform_schemas.sql'],{stdio:'inherit'})"
npm run db:platform-seed
node scripts/generate-theme-fields.cjs
npx tsx scripts/prep-reimport-all.ts   # capas maqueta/bitácora
```

### 3. Variables de entorno en el host

| Variable | Local | Producción |
|----------|-------|------------|
| `DATABASE_URL` | Supabase session :5432 | Mismo o pooler |
| `AUTH_SECRET` | dev | **secreto fuerte nuevo** |
| `AUTH_URL` | http://localhost:3000 | URL pública HTTPS |
| `AUTH_MODE` | demo | `keycloak` (recomendado) |
| `ACL_STRICT` | false | **true** |
| `SECURITY_ENABLED` | true | true |
| `SECURITY_ALLOW_LOCALHOST` | true | **false** |
| `NEXT_PUBLIC_SUPABASE_URL` | opcional | si usas client |
| `SUPABASE_SERVICE_ROLE_KEY` | solo server | solo server, nunca `NEXT_PUBLIC_` |

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
