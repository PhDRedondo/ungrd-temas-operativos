# Guía de integración API v1

Base: `/api/v1` · Auth: cookie sesión Auth.js (misma que legacy).

## Casos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/cases` | Listar casos del usuario |
| POST | `/api/v1/cases` | Crear caso `{ caseType, title, moduleId?, payload? }` |
| GET | `/api/v1/cases/:id` | Detalle + versiones + hallazgos |
| PATCH | `/api/v1/cases/:id/draft` | Actualizar borrador `{ payload }` |
| POST | `/api/v1/cases/:id/submit` | Enviar → versión FROZEN + tareas revisión |

## Tareas (bandeja)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/me/tasks` | Tareas pendientes para el rol |
| POST | `/api/v1/tasks/:id/complete` | `{ action: approve\|return\|reject, findings? }` |

## Compatibilidad legacy

Los endpoints `/api/themes/*` **no cambian**. Los temas siguen en `/app/temas/[slug]`.

Los casos nuevos enlazan `module_id` al tema cuando aplica.

## Piloto

```bash
# 1. Crear caso
curl -X POST http://localhost:3000/api/v1/cases \
  -H "Content-Type: application/json" \
  -b "session_cookie=..." \
  -d '{"caseType":"ASSET_REGISTRATION","moduleId":"carrotanques","title":"CT piloto","payload":{"placa":"ABC123"}}'

# 2. Enviar
curl -X POST http://localhost:3000/api/v1/cases/{id}/submit -b "..."

# 3. Tareas
curl http://localhost:3000/api/v1/me/tasks -b "..."
```

## Errores

Mismos códigos que [`../API.md`](../API.md) + validación de estado de caso.
