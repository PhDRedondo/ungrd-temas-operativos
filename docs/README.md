# Documentación — índice

## Lectura rápida (también en la raíz del repo)

| Doc | Dónde |
|-----|--------|
| Arranque | [`../README.md`](../README.md) |
| Mapa del Finder | [`../STRUCTURE.md`](../STRUCTURE.md) |
| Requisitos | [`../REQUIREMENTS.md`](../REQUIREMENTS.md) → detalle aquí abajo |
| Memoria | [`../MEMORY.md`](../MEMORY.md) → detalle aquí abajo |

## Producto

1. [REQUIREMENTS.md](./REQUIREMENTS.md) — qué debe cumplir  
2. [MEMORY.md](./MEMORY.md) — antes→ahora, decisiones  
3. [ROADMAP.md](./ROADMAP.md) — siguientes fases  

## Ingeniería

4. [ARCHITECTURE.md](./ARCHITECTURE.md)  
5. [FRONTEND.md](./FRONTEND.md) · [BACKEND.md](./BACKEND.md) · [API.md](./API.md)  
6. [SECURITY.md](./SECURITY.md) — rate limit, ban IP, headers  
7. [SISTEMA-MAPA.md](./SISTEMA-MAPA.md)  

## Operación

8. [LOCAL.md](./LOCAL.md) — setup máquina  
9. [HARNESS.md](./HARNESS.md) · [SMOKE.md](./SMOKE.md)  
10. [DEPLOY.md](./DEPLOY.md) — checklist pre-despliegue  
11. [ai/README.md](./ai/README.md) — agentes  

## Plataforma multidependencia (workflows + casos)

12. [platform/README.md](./platform/README.md) — índice Fase 1–5  
    - [DATA-MODEL-ANALYSIS.md](./platform/DATA-MODEL-ANALYSIS.md) — maqueta/bitácora/cruces  
    - Arranque: `npm run db:platform` → `/app/casos` · `/app/tareas`  
    - Reimport capas: `npm run db:reimport`

## Convenciones

- Documentación en **español**.
- Cambio de arquitectura → `ARCHITECTURE.md` + entrada en `MEMORY.md`.
- Nuevo endpoint → `API.md` + harness/smoke si es crítico.
- Geo solo oficial (DIVIPOLA / MGN).
