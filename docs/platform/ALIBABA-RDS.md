# PostgreSQL RDS Alibaba (fuente operativa)

La app y QuickBI leen **la misma instancia**. No hay SSL en este host: `sslmode=disable`.

## Conexión (campos QuickBI / DBeaver / JDBC)

| Campo | Valor |
|-------|--------|
| Motor | PostgreSQL 18 |
| Host | `pgm-7gotc9vw1p903hrzbo.pg.rds-aliyun-america.rds.aliyuncs.com` |
| Puerto | `5432` |
| Base | `d01_p011_aplicativo_temas` |
| Usuario | `d01_p011_aplicativo_temas` |
| SSL | **desactivado** (`sslmode=disable`, `ssl=false`) |
| Password | vault / `.env.local` — **no en git** |

URI (password URL-encoded: `*` → `%2A`):

```
postgresql://d01_p011_aplicativo_temas:<PASSWORD>@pgm-7gotc9vw1p903hrzbo.pg.rds-aliyun-america.rds.aliyuncs.com:5432/d01_p011_aplicativo_temas?sslmode=disable
```

JDBC:

```
jdbc:postgresql://pgm-7gotc9vw1p903hrzbo.pg.rds-aliyun-america.rds.aliyuncs.com:5432/d01_p011_aplicativo_temas?ssl=false
```

## Qué apuntar en QuickBI

Clave de negocio FIC: **`record_id`**, no `no_cdp`.

| Dataset | Relación | Filas (migración 2026-09-15) |
|---------|----------|------------------------------|
| `fic.fic` | Transferencias FIC (plazos/vencidos calculados) | 387 |
| `medallion.v_fic_all` | Alias de `fic.fic` | 387 |
| `public.records` | Todas las filas (incluye borradas lógicas) | 11305 |
| `medallion.v_bronze_records` | Solo `deleted_at IS NULL` | 5216 |
| `agua.general` | Agua hoja General | 214 |
| `silver_agua.*` / `silver_puentes.*` | Tablas físicas Agua/Puentes | igual que origen |

## App

`DATABASE_URL` y `MEDALLION_DATABASE_URL` en `.env.local` apuntan a este RDS.  
Vercel/prod hay que cambiar el secret `DATABASE_URL` a la misma URI.

Supabase queda como respaldo; no se borra.
