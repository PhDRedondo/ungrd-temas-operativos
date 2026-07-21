# Prueba oficial con Supabase

## Qué necesitamos

1. **Connection string directa** (puerto **5432**, no pooler 6543 para migraciones DDL):
   ```text
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   O desde el dashboard: **Project Settings → Database → Connection string → URI → Direct connection**.

2. Opcional: **Project URL** y **anon key** (solo si más adelante usamos Supabase Auth/Storage; hoy la app usa Auth.js demo).

## Configuración local

En `.env.local`:

```env
DATABASE_URL=postgresql://postgres.xxxx:TU_PASSWORD@db.xxxx.supabase.co:5432/postgres
AUTH_MODE=demo
NEXT_PUBLIC_AUTH_MODE=demo
AUTH_SECRET=<genera-un-secreto-largo>
ACL_STRICT=false
```

> No commitear `.env.local`. No pegar la contraseña en el chat si es producción.

## Setup en la base remota

```bash
npm run db:official-setup
```

Esto ejecuta en orden:

1. `drizzle-kit push` — tablas legacy (`public`: users, themes, records…)
2. `seed.ts` — 19 temas + registros demo + DIVIPOLA vía app
3. `0001_platform_schemas.sql` — esquemas `iam`, `config`, `workflow`, `core`, etc.
4. `seed-platform.ts` — dependencias + workflow piloto carrotanque

## Verificación

```bash
npm run dev
npm run harness          # incluye platform
npm run harness:platform # solo API v1
```

Health: `GET /api/health` debe responder `db: "up"`.

## Supabase: extensiones

La migración usa `gen_random_uuid()`. En Supabase suele estar habilitado `pgcrypto` por defecto. Si falla:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Seguridad

- Usar proyecto **dedicado a pruebas** o branch de desarrollo.
- RLS de Supabase: las tablas nuevas están en esquemas propios; la app conecta con el rol `postgres` del connection string (bypass RLS). RLS fino es fase posterior.
- Rotar contraseña después de compartirla en canales no seguros.

## Si la base ya tiene datos

`CREATE SCHEMA IF NOT EXISTS` y `CREATE TABLE IF NOT EXISTS` hacen el script mayormente idempotente.  
Los seeds usan `onConflictDoNothing` donde aplica. No borra datos existentes.
