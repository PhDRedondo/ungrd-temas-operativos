# Índice — Plataforma multidependencia

Integración progresiva de workflows, casos, versiones y publicación sobre el monolito existente.

## Fase 1 — Descubrimiento

- [Evaluación sistema existente](./existing-system-assessment.md)
- [Análisis de brechas](./integration-gap-analysis.md)

## Fase 2 — Arquitectura

- [Arquitectura objetivo](./target-architecture.md)
- [Estrategia de integración](./integration-strategy.md)
- [Diagrama](./architecture-diagram.mmd)

## Fase 3–4 — Datos y workflow

- [Modelo de datos](./database-model.md)
- [Motor de workflows](./workflow-engine-design.md)
- [Máquina de estados piloto](./workflow-state-machine.md)

## Fase 5 — APIs

- [Guía de integración API](./api-integration-guide.md)
- [OpenAPI](./openapi.yaml)

## Arranque plataforma

```bash
npm run db:platform      # migración + seed workflow piloto
npm run dev
# /app/casos → crear piloto → enviar
# /app/tareas → aprobar (rol analista/admin)
```
