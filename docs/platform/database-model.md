# Modelo de datos — plataforma multidependencia

SQL canónico: [`../../drizzle/migrations/0001_platform_schemas.sql`](../../drizzle/migrations/0001_platform_schemas.sql)  
Drizzle: [`../../src/db/platform-schema.ts`](../../src/db/platform-schema.ts)

## Esquemas PostgreSQL

| Schema | Propósito |
|--------|-----------|
| `public` | Legacy: themes, records, uploads, users, audit_log |
| `iam` | Dependencias, permisos, user_dependencies |
| `config` | workflow_definitions, workflow_versions |
| `staging` | case_versions (inmutables al enviar) |
| `workflow` | instances, tasks, review_findings, event_outbox |
| `core` | cases, assets, legal_instruments, locations |
| `audit` | events (auditoría funcional extendida) |
| `analytics` | agregados (placeholder) |

## Entidad central: `core.cases`

```text
case_code     CAS-2026-00001
case_type     ASSET_REGISTRATION
module_id     carrotanques
status        DRAFT | UNDER_REVIEW | RETURNED | PUBLISHED | …
current_version
workflow_instance_id → workflow.instances
```

## Separación de responsabilidades

| Concepto | Tabla |
|----------|-------|
| Expediente | `core.cases` |
| Versión enviada | `staging.case_versions` (FROZEN) |
| Proceso | `workflow.instances` |
| Bandeja | `workflow.tasks` |
| Devolución | `workflow.review_findings` |
| Inventario oficial | `core.assets` + `core.legal_instruments` |
| Dato operativo legacy | `public.records` |

## Piloto carrotanque

Publicación (`publishCarrotanqueCase`) escribe en transacción:

1. `core.locations`
2. `core.legal_instruments`
3. `core.assets`

## Migración

```bash
npm run db:platform-migrate
npm run db:platform-seed
```

## RLS (fase F)

Políticas pendientes en `core.cases` y `workflow.tasks` por `dependency_id`.
