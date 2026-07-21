# Máquina de estados — piloto carrotanque

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> UNDER_REVIEW: submit
  CORRECTION_IN_PROGRESS --> UNDER_REVIEW: resubmit
  RETURNED --> CORRECTION_IN_PROGRESS: edit draft
  UNDER_REVIEW --> RETURNED: return + findings
  UNDER_REVIEW --> REJECTED: reject
  UNDER_REVIEW --> STEP_APPROVED: all parallel reviews OK
  STEP_APPROVED --> PUBLISHING: admin approves
  PUBLISHING --> PUBLISHED: publication OK
  PUBLISHED --> CLOSED: close
  REJECTED --> [*]
  CLOSED --> [*]
```

## Reglas paralelas

- Técnica y Jurídica deben completar `approve` antes de crear tarea Dirección.
- Hallazgos `CRITICAL` abiertos bloquean aprobación final.

## Tareas por estado

| Estado caso | Tareas generadas |
|-------------|------------------|
| UNDER_REVIEW | TECH_REVIEW, LEGAL_REVIEW |
| STEP_APPROVED | DIR_APPROVAL |
| RETURNED | (ninguna — corrección en originador) |
