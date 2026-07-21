# Harness — arnés de verificación

El harness comprueba que el entorno y las capas **back** / **front** / **security** responden como se espera. No sustituye tests unitarios; es la red de seguridad diaria / CI local.

## Comandos

```bash
npm run harness:env        # Variables y prerequisitos
npm run harness:back       # Health + APIs autenticadas
npm run harness:front      # Rutas UI HTTP
npm run harness:security   # Headers + bloqueo de sondas
npm run harness            # env → back → front → security
npm run smoke              # E2E API (Excel incluido)
npm run ci:local           # lint + typecheck + smoke
```

Requiere `npm run dev` (o `start`) en otra terminal para back/front/security/smoke.

## Capas

| Capa | Script | Qué valida |
|------|--------|------------|
| Env | `scripts/harness/check-env.ts` | `.env.local`, `DATABASE_URL`, geo, docs |
| Back | `scripts/harness/check-back.ts` | health, login, records, analytics |
| Front | `scripts/harness/check-front.ts` | `/`, `/login`, `/app` |
| Security | `scripts/harness/check-security.ts` | protocolo v1, sondas, headers |
| E2E | `scripts/smoke-local.ts` | plantilla + upload + bandeja |

## Variables

| Var | Default | Uso |
|-----|---------|-----|
| `SMOKE_BASE` / `HARNESS_BASE` | `http://127.0.0.1:3000` | URL base |
| `DATABASE_URL` | — | Solo check-env |

## Criterio de verde

- `harness` exit 0
- `smoke` imprime `SMOKE LOCAL PASS`
- Header `X-UNGRD-Security: protocol-v1` presente

## Integración CI (futuro)

```yaml
- npm ci
- npm run typecheck
- npm run lint
# levantar postgres + app
- npm run harness
- npm run smoke
```
