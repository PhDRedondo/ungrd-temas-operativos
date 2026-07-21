# Motor de workflows — diseño

## Decisión

Motor **propio configurable** (tablas `config.workflow_*` + intérprete TypeScript).  
No BPMN externo en v1 — ver ADR-P2 en [`target-architecture.md`](./target-architecture.md).

## Componentes

| Pieza | Ubicación |
|-------|-----------|
| Definición | `config.workflow_definitions` + `workflow_versions.config` (JSON) |
| Instancia | `workflow.instances` |
| Tareas | `workflow.tasks` |
| Motor | `src/lib/workflow/repository.ts` |
| Tipos | `src/lib/workflow/types.ts` |

## Piloto: WF_ASSET_CARROTANQUE

```text
CAPTURE (Logística, serial)
    ↓ submit
TECH_REVIEW ∥ LEGAL_REVIEW (paralelo)
    ↓ all approved
DIR_APPROVAL (admin)
    ↓ approve
PUBLISH → core.assets
```

## Estados de caso

Ver `CASE_STATUSES` en `src/lib/workflow/types.ts`.

## Transiciones

Configuradas en JSON (`transitions[]`):

```json
{ "from": "DRAFT", "action": "submit", "to": "UNDER_REVIEW", "roles": ["captura"] }
```

El motor valida con `canTransition()` antes de aplicar (extensión pendiente en todos los paths).

## Event outbox

Cada acción crítica inserta en `workflow.event_outbox` (`PENDING`).  
Worker futuro: notificaciones, email, indicadores.

## Diagrama de estados (piloto)

Ver [`workflow-state-machine.md`](./workflow-state-machine.md).

## Extensión

1. Nuevo workflow → insert en `config` + seed
2. Nuevo `case_type` → mapeo en `createCase`
3. Publicación → `src/lib/publication/<tipo>.ts`
