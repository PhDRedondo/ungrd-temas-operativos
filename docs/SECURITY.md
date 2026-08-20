# Seguridad — protocolo avanzado v1

## Resumen

El middleware aplica un **protocolo de seguridad** antes de auth:

1. Denylist / allowlist de IPs  
2. Ban temporal progresivo (reintentos / abuso)  
3. Rate limiting por clase de ruta (auth, API, upload, health)  
4. Inspección de path (path traversal, sondas WP, extensiones peligrosas)  
5. Límite de tamaño de body / Excel  
6. Headers HTTP de endurecimiento (CSP, XFO, nosniff, HSTS en prod)  
7. Registro de fallos de login demo → strikes → ban  

Código: `src/lib/security/**` · entrada: `src/middleware.ts`

## Flujo

```text
Request
  → IP (CF / X-Forwarded-For / X-Real-IP)
  → ¿denylist o ban activo? → 403
  → ¿path sospechoso? → 400 + strike (± ban)
  → ¿Content-Length > máx? → 413
  → rate limit por clase → 429 + strike (± ban)
  → Auth.js JWT (rutas protegidas)
  → Response + security headers
```

## Límites por defecto

| Clase | Prod (req/min) | Dev (req/min) |
|-------|----------------|--------------|
| API | 90 | 180 |
| Auth / login | 12 | 40 |
| Upload Excel | 8 | 20 |
| Health | 30 | 30 |

- Tras `SECURITY_BAN_THRESHOLD` strikes → ban `SECURITY_BAN_MS` (backoff ×2 hasta `BAN_MAX`)  
- Localhost en allowlist automática en desarrollo (`SECURITY_ALLOW_LOCALHOST=true`)

## Variables de entorno

```env
SECURITY_ENABLED=true
SECURITY_TRUST_PROXY=true
SECURITY_ALLOW_LOCALHOST=true   # solo útil en no-prod
SECURITY_API_RPM=90
SECURITY_AUTH_RPM=12
SECURITY_UPLOAD_RPM=8
SECURITY_HEALTH_RPM=30
SECURITY_WINDOW_MS=60000
SECURITY_BAN_THRESHOLD=8
SECURITY_BAN_MS=900000
SECURITY_BAN_BACKOFF=2
SECURITY_BAN_MAX_MS=86400000
SECURITY_MAX_BODY_MB=12
SECURITY_IP_ALLOWLIST=          # csv
SECURITY_IP_DENYLIST=           # csv
```

## Admin

```http
GET  /api/admin/security          # stats + bans (rol admin)
POST /api/admin/security
{ "action": "ban", "ip": "1.2.3.4", "minutes": 60, "reason": "abuso" }
{ "action": "unban", "ip": "1.2.3.4" }
```

## Auth

| Modo | Uso | Riesgo |
|------|-----|--------|
| `demo` | Solo desarrollo | No usar en internet pública |
| `keycloak` | Staging / prod | Obligatorio en deploy |

## Multi-instancia / serverless

El almacén de bans/strikes es **en memoria por proceso**.  
El **rate limit** usa **Upstash Redis** automáticamente si están:

```env
UPSTASH_REDIS_REST_URL=…
UPSTASH_REDIS_REST_TOKEN=…
```

Si no están definidas, cae a memoria (mitiga abuso por instancia). Si Redis falla, también cae a memoria sin tumbar la app.

## Checklist de endurecimiento (2026-08)

- [x] `/api/accounts/sync` exige sesión/admin; GET no devuelve passwords  
- [x] Completar invitación vía `/api/accounts/complete-invite` (token)  
- [x] Contraseñas hasheadas con bcrypt (compatibilidad con texto plano legado)  
- [x] `AUTH_SECRET` obligatorio en producción  
- [x] Validación magic-number en uploads Excel  
- [x] Export Excel de UI con `exceljs` (sin `xlsx` en runtime de app)  
- [ ] Rotar credenciales DB/Medallion si alguna vez se filtraron  
- [ ] `AUTH_MODE=keycloak` en producción pública  
- [ ] Configurar Upstash en Vercel para rate limit global  

## Checklist pre-deploy

- [ ] `AUTH_MODE=keycloak`  
- [ ] `ACL_STRICT=true`  
- [ ] `SECURITY_ENABLED=true`  
- [ ] `SECURITY_ALLOW_LOCALHOST=false` (o no definir en prod)  
- [ ] Secretos fuertes (`AUTH_SECRET`, Keycloak, DB)  
- [ ] HTTPS / `AUTH_URL` correcto (HSTS activo en `NODE_ENV=production`)  
- [ ] `SECURITY_IP_ALLOWLIST` con IPs de oficina/VPN si aplica  
- [ ] Probar `npm run harness:security` + `npm run smoke`  
- [ ] Backups Postgres + object storage para uploads  
- [ ] Upstash configurado si hay flota serverless  
- [ ] Rotar credenciales si hubo exposición  

## Verificación

```bash
npm run harness:security
# Headers X-UNGRD-Security, bloqueo sonda, rate limit (opcional agresivo)
```

## Principios

1. Secretos solo en env.  
2. Autorización en servidor (ACL).  
3. Validación Zod + DIVIPOLA.  
4. No confiar en el cliente para límites.  
5. Fallar cerrado en prod (`ACL_STRICT`, Keycloak, security on).
