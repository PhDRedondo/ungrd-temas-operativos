# Scripts y arnés

## Comandos rápidos

```bash
npm run harness            # env + back + front + security
npm run harness:env
npm run harness:back       # requiere npm run dev
npm run harness:front
npm run harness:security
npm run smoke              # E2E Excel
```

## Contenido

| Ruta | Rol |
|------|-----|
| `harness/run.ts` | Orquestador |
| `harness/check-env.ts` | Variables y archivos críticos |
| `harness/check-back.ts` | APIs |
| `harness/check-front.ts` | Rutas UI |
| `harness/check-security.ts` | Protocolo seguridad |
| `harness/lib.ts` | Helpers compartidos |
| `smoke-local.ts` | Smoke E2E |

Docs: [`../docs/HARNESS.md`](../docs/HARNESS.md) · [`../docs/SMOKE.md`](../docs/SMOKE.md)
