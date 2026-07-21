# Análisis de brechas de integración

Documento Fase 1 · Comparación **sistema actual** vs **plataforma multidependencia objetivo**.

## Matriz de brechas

| Capacidad requerida | Existente | Brecha | Prioridad |
|---------------------|-----------|--------|-----------|
| Portal único + sesión | AppShell + Auth.js | Falta bandeja tareas/casos central | P0 |
| RBAC + ABAC | Rol + ACL tema | Sin dependencia, etapa, campo | P0 |
| Caso / expediente | — | **Crear** `core.cases` | P0 |
| Versiones inmutables | — | **Crear** `staging.case_versions` | P0 |
| Motor workflow | — | **Crear** `workflow.*` + engine | P0 |
| Tareas asignables | — | **Crear** `workflow.tasks` | P0 |
| Hallazgos / devoluciones | — | **Crear** `workflow.review_findings` | P1 |
| Aprobaciones serial/paralelo | — | **Config** en `workflow_definitions` | P1 |
| Formularios configurables | ThemeConfig en código | Evolucionar a `config.form_*` | P2 |
| Import Excel staging | Upload → records directo | **Pipeline** staging → publish | P1 |
| Publicación transaccional | insert records | **Servicio** publish → `core.*` | P0 |
| Inventario activos unificado | records por tema | **core.assets** + instrumentos | P0 |
| Event outbox | audit_log puntual | **workflow.event_outbox** | P2 |
| Notificaciones | — | Worker + centro UI | P2 |
| OpenAPI v1 | — | **openapi.yaml** + rutas `/api/v1` | P1 |
| RLS PostgreSQL | — | Políticas por dependencia | P2 |
| Object storage | disco local | GCS/OSS | P2 |
| Cloud Run / CI | compose local | Dockerfile + pipeline | P2 |

---

## Brechas por capa

### Experiencia de usuario

| Requisito | Gap |
|-----------|-----|
| Una bandeja de tareas | Solo `UploadsInbox` (cargas Excel) |
| Mis casos / correcciones | No existe |
| Notificaciones | No existe |
| Navegación al caso desde tarea | No existe |
| Comparación de versiones | No existe |

**Integración:** nuevas rutas `/app/tareas`, `/app/casos/[id]` dentro del mismo `AppShell`.

### Datos

| Requisito | Gap |
|-----------|-----|
| Fuente única de verdad | `records` mezcla estados de negocio |
| Borrador vs publicado | Todo inserta en misma tabla |
| No tabla por Excel | Parcial — jsonb `payload` por tema ayuda |
| Activos + instrumentos | No hay `core.assets` / `legal_instruments` |

**Integración:** esquemas PostgreSQL separados; `records` legacy convive hasta migración.

### Workflow

| Requisito | Gap |
|-----------|-----|
| 13+ estados de caso | 0 |
| Transiciones configurables | 0 |
| SLA / escalamiento | 0 |
| Paralelo técnica + jurídica | 0 |

**Integración:** motor propio ligero (no BPMN externo en v1) — ver [`workflow-engine-design.md`](./workflow-engine-design.md).

### Seguridad y auditoría

| Requisito | Gap |
|-----------|-----|
| Rate limit / ban IP | **Implementado** |
| Auditoría funcional completa | Parcial (`audit_log`) |
| IP en auditoría | No registrada aún en audit_log |

**Integración:** extender `audit.events` con contexto request.

---

## Qué NO hay que rehacer

1. **19 módulos temáticos** — se convierten en `module_id` / sección del caso.
2. **CapturePanel + Excel** — entrada a `staging`, no a `core`.
3. **Keycloak / Auth.js** — única autenticación.
4. **DIVIPOLA / mapa** — sin cambios.
5. **Drizzle + Postgres** — extender schemas, no cambiar motor.

---

## Orden de cierre de brechas (resumen)

```text
Fase A  Esquemas PG + core.cases + workflow engine mínimo
Fase B  API v1 cases/tasks + bandeja UI
Fase C  Piloto carrotanque (hallazgos + versiones)
Fase D  Publicación → core.assets
Fase E  Import staging + outbox + notificaciones
Fase F  Formularios DB-driven + RLS + Cloud Run
```

Detalle: [`integration-strategy.md`](./integration-strategy.md).

---

## Criterios de aceptación — estado

| # | Criterio | Hoy |
|---|----------|-----|
| 1 | Login existente | Parcial (demo/KC listo) |
| 2 | Permisos en portal | Parcial (temas ACL) |
| 3 | Solo módulos autorizados | Sí (ACL) |
| 4–24 | Ciclo caso completo | **No** — objetivo Fases A–E |

---

## Riesgos de integración

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Romper temas existentes | Media | APIs legacy `/api/themes/*` intactas |
| Schema drift | Media | Migraciones versionadas en `drizzle/migrations/` |
| Scope creep 24 microservicios | Alta | Monolito modular — ver ADR en target-architecture |
| Confundir `records.estado` con workflow | Media | Renombrar en UI; workflow en `core.cases.status` |
