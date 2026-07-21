# Estrategia de integración progresiva

## Fases y entregables

| Fase | Entregable | Estado |
|------|------------|--------|
| 1 Descubrimiento | `existing-system-assessment.md`, `integration-gap-analysis.md` | Hecho |
| 2 Arquitectura | `target-architecture.md`, `architecture-diagram.mmd`, este doc | Hecho |
| 3 Modelo datos | `database-model.md`, `drizzle/migrations/0001_platform.sql`, `platform-schema.ts` | En curso |
| 4 Workflow | `workflow-engine-design.md`, seed piloto carrotanque | En curso |
| 5 APIs | `openapi.yaml`, `/api/v1/cases`, `/api/v1/me/tasks` | En curso |
| 6 Frontend | `/app/tareas`, `/app/casos/[id]`, TasksInbox | En curso |
| 7 Publicación | `publication-service`, outbox | Pendiente |
| 8 Pruebas | harness workflow + casos piloto | Pendiente |

---

## Reglas de integración

1. **Ningún breaking change** en `/api/themes/*` ni en temas existentes.
2. **Nuevas tablas** en esquemas dedicados (`iam`, `core`, `workflow`, …).
3. **Casos nuevos** usan `/api/v1`; temas legacy pueden adoptar caso opcionalmente.
4. **Excel** de temas: fase 7 redirige a `staging.import_*` antes de `core`.
5. **Auth única** — sin segundo login.

---

## Mapeo módulos existentes → plataforma

| Tema actual (`theme_id`) | `case_type` piloto | Notas |
|--------------------------|------------------|-------|
| `carrotanques` | `ASSET_REGISTRATION` | **Piloto workflow** |
| `materiales` | `MATERIAL_LOT` | Fase posterior |
| `puentes` | `WORK_ASSET` | Fase posterior |
| `convenios` | `LEGAL_INSTRUMENT` | Fase posterior |
| Resto (16) | `THEME_OPERATIONAL` | Captura directa legacy hasta migrar |

---

## Plan de archivos (creados / modificados)

### Nuevos

```text
docs/platform/*
drizzle/migrations/0001_platform_schemas.sql
src/db/platform-schema.ts
src/db/seed-platform.ts
src/lib/workflow/*
src/lib/cases/*
src/lib/publication/*
src/app/api/v1/cases/*
src/app/api/v1/me/tasks/*
src/components/TasksInbox.tsx
src/app/app/tareas/page.tsx
src/app/app/casos/[id]/page.tsx
```

### Modificados

```text
drizzle.config.ts          → incluir platform-schema
src/middleware.ts            → auth /api/v1
src/components/AppShell.tsx  → nav Tareas / Casos
docs/README.md               → enlace platform/
package.json                 → db:platform seed script
```

---

## Verificación por fase

### Fase 3–6 (actual)

```bash
psql $DATABASE_URL -f drizzle/migrations/0001_platform_schemas.sql
npm run db:platform-seed
npm run dev
# Crear caso piloto, enviar, ver tarea en /app/tareas
curl -b cookies.txt http://localhost:3000/api/v1/me/tasks
```

### Fase 7+

Publicación atómica + prueba rollback + harness extendido.

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Duplicar activos | `core.assets` + dedup por código; publication idempotente |
| Workflow hardcoded | Definiciones en DB; engine interpreta |
| Equipo confundido | Docs platform + piloto único antes de 19 temas |

---

## Integración con microservicio institucional de permisos

Cuando exista el servicio externo de usuarios/roles:

```text
Keycloak token
  → sync iam.users (existente)
  → adapter llama microservicio institucional
  → upsert iam.user_scopes + cache TTL
```

No bloquea Fase 3–6: se usan dependencias seed + roles actuales.
