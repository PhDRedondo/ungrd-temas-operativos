# Evaluación del sistema existente

Documento Fase 1 · Base: análisis del repo `ungrd-temas-operativos` (jul 2026).

## 1. Resumen ejecutivo

| Dimensión | Estado actual |
|-----------|---------------|
| **Tipo de sistema** | Monolito modular Next.js 16 (BFF + UI) |
| **Módulos temáticos** | 19 temas autónomos en `src/themes/<slug>/` |
| **Persistencia** | PostgreSQL — 6 tablas en schema `public` |
| **Auth** | Auth.js — demo local o Keycloak OIDC |
| **Autorización** | RBAC (4 roles) + ACL por tema (`user_theme_access`) |
| **Captura** | Formulario + Excel tipado (DIVIPOLA, Zod) |
| **Analítica** | Cliente + agregaciones SQL + mapa MGN |
| **Workflow** | **No existe** — `estado` en records es dato de negocio, no máquina de estados |
| **Despliegue** | Docker Compose (Postgres + Keycloak); app en host / preparada para Cloud Run |

**Conclusión:** la plataforma actual es una **capa sólida de captura, validación y analítica temática**. No cubre casos multidependencia, tareas, versiones inmutables, hallazgos ni publicación transaccional a inventario oficial.

---

## 2. Arquitectura actual

```text
Usuario → Portal /app (AppShell)
       → Auth (demo | Keycloak)
       → Menú dinámico por ACL (/api/me/access)
       → ThemeWorkspace (captura | analítica | cargas Excel)
       → API /api/themes/:slug/*
       → PostgreSQL (records, uploads, audit_log)
```

### 2.1 Frontend reutilizable

| Componente | Ruta | Reutilización para plataforma |
|------------|------|------------------------------|
| `AppShell` | `src/components/AppShell.tsx` | Portal único — extender nav (Mis tareas, Mis casos) |
| `ThemeWorkspace` | `src/components/ThemeWorkspace.tsx` | Módulo por tema — envolver en caso/expediente |
| `CapturePanel` | `src/components/CapturePanel.tsx` | Borrador de sección — vincular a `case_versions` |
| `UploadsInbox` | `src/components/UploadsInbox.tsx` | Patrón bandeja — replicar para tareas |
| `AnalyticsPanel` | `src/components/AnalyticsPanel.tsx` | Post-publicación / dashboards |

### 2.2 Backend reutilizable

| Módulo | Ruta | Capacidad |
|--------|------|-----------|
| Validación schema-driven | `src/lib/validation/record-schema.ts` | Base para formularios configurables |
| Excel pipeline | `src/lib/excel/template.ts` | Staging import — no publicar directo a CORE |
| Repositorio records | `src/lib/records/repository.ts` | Destino post-publicación (hoy = dato operativo) |
| ACL | `src/lib/auth/acl.ts` | Extender a permisos por caso/etapa |
| Seguridad edge | `src/lib/security/*` | Rate limit, ban IP, headers — listo para prod |
| Auditoría básica | `audit_log` | Ampliar a `audit.*` funcional |

### 2.3 APIs existentes (16 operaciones)

| Área | Endpoints |
|------|-----------|
| Salud | `GET /api/health` |
| Auth | `/api/auth/*` |
| Sesión | `GET /api/me/access` |
| Admin | ACL, seguridad |
| Temas | records, analytics, template, uploads |
| Cargas | listado, detalle, CSV errores |

**No hay** `/api/v1/cases`, `/api/v1/tasks`, ni OpenAPI versionado.

---

## 3. Modelo de datos actual (`public`)

| Tabla | Filas típicas | Rol |
|-------|---------------|-----|
| `themes` | 19 | Catálogo + `field_schema` jsonb |
| `users` | bajo demanda | Mapeo Keycloak/demo → rol |
| `user_theme_access` | opcional | ACL lectura/escritura por tema |
| `records` | N por tema | Dato operativo (depto, muni, payload) |
| `uploads` | por carga Excel | Meta + errores |
| `audit_log` | append-only | Acciones puntuales |

### Limitaciones respecto al objetivo

- **Una fila `records` ≠ un caso/expediente** — no hay ciclo de vida institucional.
- **`content_hash`** deduplica filas, no versiona envíos.
- **`estado`** en records (`Programado`, `En ejecución`…) no es workflow transversal.
- **Sin dependencia organizacional** — solo rol global + tema.
- **Sin separación staging / core oficial** — Excel inserta (tras validación) en `records`.

---

## 4. Temas como módulos (19)

Cada tema define `ThemeConfig` (`src/themes/shared/types.ts`):

- Campos geo (DIVIPOLA) + fecha + estado + observaciones + `extraFields`
- Ejemplo piloto workflow: **`carrotanques`** — placa, volumen, destino, costo

Los temas **no comparten un caso** hoy; cada uno es un silo de `records` filtrados por `theme_id`.

---

## 5. Autenticación y autorización

### Autenticación (reutilizar)

- Keycloak realm en `infra/keycloak/realm-ungrd.json`
- Auth.js con JWT en cookie
- **No crear segundo login**

### Autorización (extender)

| Hoy | Objetivo |
|-----|----------|
| Rol: captura, analista, admin, auditor | + permisos granulares (`case.submit`, `task.approve`, …) |
| ACL por tema | + dependencia, etapa, sección de formulario |
| Sin RLS | RLS en tablas sensibles (`core.*`, `workflow.tasks`) |

---

## 6. Infraestructura y despliegue

| Pieza | Estado |
|-------|--------|
| PostgreSQL | Local / Compose — listo |
| Keycloak | Compose — opcional en dev |
| Object Storage | **Pendiente** — uploads en disco `uploads/` |
| Cloud Run | No configurado en repo — compatible (contenedor Next) |
| Secret Manager | Env vars — documentado en `.env.example` |
| CI/CD | Harness + smoke local — sin pipeline cloud aún |

---

## 7. Deuda técnica y riesgos

| Riesgo | Impacto | Mitigación en integración |
|--------|---------|---------------------------|
| Records mezclan borrador y “oficial” | Publicación incorrecta | Nuevos esquemas `staging` + `core`; records como vista operativa legacy |
| Sin dependencias IAM | Permisos incompletos | Tabla `iam.dependencies` + scopes |
| Uploads en filesystem | No serverless-safe | Fase 7: GCS/OSS + `staging.import_files` |
| Rate limit en memoria | Multi-instancia | Redis/Upstash cuando escale |
| 19 temas sin caso padre | UX fragmentada | `core.cases` + enlace `module_id` |

---

## 8. Componentes a conservar sin cambios (Fase 1)

- Contrato `ThemeConfig` y carpetas autónomas
- Pipeline Excel + DIVIPOLA
- `AnalyticsPanel` + `ColombiaMap`
- Auth.js + Keycloak
- Protocolo seguridad middleware
- Harness / smoke

---

## 9. Supuestos documentados

1. El “servicio de usuarios/roles” externo se modela inicialmente como **Keycloak + tablas IAM locales**; integración REST al microservicio institucional es un adaptador futuro (`iam.external_sync`).
2. Los **6 dominios / puertas de entrada** del prompt se mapean a **rutas `/app` + casos por `case_type`** sin micro-frontends separados en v1.
3. **`records` existentes** siguen válidos como capa operativa/analítica hasta migración gradual a `core.assets` vía servicio de publicación.
4. Workflow piloto: **registro de activo carrotanque** (`carrotanques`).

---

## 10. Verificación del estado actual

```bash
npm run db:setup
npm run dev
npm run harness
npm run smoke
```

Ver [`../LOCAL.md`](../LOCAL.md) · [`../HARNESS.md`](../HARNESS.md).
