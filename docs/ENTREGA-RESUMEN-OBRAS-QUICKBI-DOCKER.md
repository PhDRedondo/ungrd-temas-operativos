# UNGRD Temas Operativos — Resumen de entrega

**Fecha:** agosto 2026 · **Repositorio:** [PhDRedondo/ungrd-temas-operativos](https://github.com/PhDRedondo/ungrd-temas-operativos) · **Rama:** `main`  
**Aplicativo en producción:** [https://ungrd-manejo-phi.vercel.app](https://ungrd-manejo-phi.vercel.app)  
**Health:** [https://ungrd-manejo-phi.vercel.app/api/health](https://ungrd-manejo-phi.vercel.app/api/health)

---

## 1. Qué es el producto

Plataforma operativa UNGRD para **captura, Excel DIVIPOLA, analítica y mapa** sobre **PostgreSQL (Supabase)**. Temas misionales aislados en `src/themes/<slug>/`. Auth open source (Auth.js / demo o Keycloak). Despliegue piloto en **Vercel**; empaquetado **Docker** listo para migrar (p. ej. Alibaba / VM).

| Acceso | Detalle |
|--------|---------|
| URL pública | https://ungrd-manejo-phi.vercel.app |
| Login demo (si `AUTH_MODE=demo`) | Según variables `DEMO_AUTH_*` del entorno |
| Temas clave de esta entrega | `/app/temas/obras-de-emergencia` · `/app/temas/obras-por-impuestos` |
| Código | https://github.com/PhDRedondo/ungrd-temas-operativos |

---

## 2. Alcance de lo entregado en este ciclo

### 2.1 QuickBI (tableros embebidos)

- Integración del flujo SNI: catálogo `pageId` → ticket → iframe (`token3rd` + `accessTicket`).
- API `POST /api/quickbi/embed-url` y componentes de embed en la app.
- Upstream configurado: `QUICKBI_UPSTREAM_BASE_URL` (backend SNI).
- UI sin avisos confusos de “ticket de respaldo” cuando el iframe carga bien.

### 2.2 Base de datos — local = producción

- **Una sola base de negocio:** PostgreSQL en **Supabase** (pooler Session `:5432`).
- Local y prod apuntan a la **misma** `DATABASE_URL` (recomendado en `docs/LOCAL.md`).
- Los registros viven en la tabla de negocio por `theme_id` (no hay DB aparte por tema).
- Conteos de referencia al cerrar el ciclo (no borrados):  
  **Obras de emergencia ≈ 76** · **Obras por impuestos ≈ 71** · (otros temas ya poblados: Agua, Carrotanques, Banco, etc.).

### 2.3 Obras de emergencia — captura + tablero de decisión

Migración de lógica del tablero SMD (`obras_emergencia`) al estilo UNGRD, **sin reducir el schema Excel**:

| Pieza | Contenido |
|-------|-----------|
| Formularios | 1 · Contrato de obra · 2 · Orden de proveeduría · 3 · Seguimiento de avances (lookup) |
| Indicadores | SPI / CPI / IRP, alerta ≤40 días en ejecución (`calculations.ts`, `dashboard.ts`) |
| Decisión | KPIs: valor, en ejecución, urgentes, IRP, SPI, avance ponderado, anticipos, riesgo de pago |
| Clave | `contrato_de_obra` / O.P. → `clave_seguimiento` |

Ruta: `/app/temas/obras-de-emergencia` → Captura · Registros · Decisión.

### 2.4 Obras por impuestos — captura + tablero de decisión

Misma línea de producto sobre el tema ArcGIS existente:

| Pieza | Contenido |
|-------|-----------|
| Formularios | 1 · Convenio · 2 · Interventoría · 3 · Seguimiento (lookup por Nº convenio / BPIN) |
| Indicadores | Plazos / IRP reutilizando motor de emergencia con fechas de convenio |
| Decisión | Valor, interventoría, en ejecución, vencidos, urgentes, IRP, SPI |
| Clave | `no_convenio` → `clave_seguimiento` |

Ruta: `/app/temas/obras-por-impuestos` → Captura · Registros · Decisión.

### 2.5 Dockerización (migración fuera de Vercel)

En Git y documentado (`docs/DOCKER.md`):

- `docker/Dockerfile` (Next.js standalone)
- `docker-compose.yml` — Postgres + migrate + app; perfil opcional Keycloak
- `.env.docker.example` · scripts `npm run docker:up|down|logs|build`

Arranque típico: `cp .env.docker.example .env.docker` → `docker compose --profile app up -d --build` → http://localhost:3000

En prod/Alibaba: fijar `AUTH_URL` pública, `AUTH_SECRET` fuerte y, si se desea la misma base, `DATABASE_URL` de Supabase.

### 2.6 Calidad y despliegue

- Commit de cierre: `9b83f58` — *feat(obras): captura y tablero SPI/IRP para emergencia e impuestos*
- Commits previos del ciclo: QuickBI + Docker (`a5849af`) y fix build Vercel standalone (`68e2fb0`)
- Verificación: `npm run typecheck` · `npm run test:unit` (incluye `scripts/test-obras-themes.ts`)
- Deploy Vercel Production: **success** sobre `main`; health prod con `db: up`

---

## 3. Arquitectura de datos (resumen)

```
Excel oficiales / captura UI
        ↓
  Next.js API + validación DIVIPOLA
        ↓
  PostgreSQL Supabase (records + capas/clave_seguimiento)
        ↓
  Decisión / analítica / mapa  ·  QuickBI (origen de tableros SNI, separado)
```

- **No** se inventan municipios: solo DIVIPOLA / MGN.
- Excel `fields-from-source` de obras **intactos**; los formularios exponen el subconjunto operativo.
- QuickBI puede mostrar cifras distintas si el workspace/tablero no comparte los mismos `pageId` o datos.

---

## 4. Cómo validar en 5 minutos

1. Abrir https://ungrd-manejo-phi.vercel.app e iniciar sesión.
2. **Obras de emergencia** → Registros (deben aparecer filas) → Decisión (KPIs) → Captura (3 formularios).
3. **Obras por impuestos** → mismo recorrido.
4. Health: https://ungrd-manejo-phi.vercel.app/api/health → `ok` y `db: "up"`.
5. (Opcional) Clonar repo y `docker compose --profile app up -d --build`.

Si Registros se ve vacío con usuario no admin: revisar **ACL / permisos del tema**. Si QuickBI falla: el `pageId` puede no estar en el workspace SNI (no implica ausencia de datos en Supabase).

---

## 5. Documentación de apoyo

| Documento | Uso |
|-----------|-----|
| `docs/MEMORY.md` | Decisiones y estado del MVP |
| `docs/LOCAL.md` | Local = Supabase |
| `docs/DOCKER.md` | Stack Docker / migración |
| `docs/DEPLOY.md` | Checklist despliegue |
| `src/themes/obras-de-emergencia/README.md` | Captura e IRP emergencia |
| `src/themes/obras-por-impuestos/README.md` | Captura e impuestos |

---

## 6. Entregables — checklist

| Ítem | Estado |
|------|--------|
| App en producción (Vercel) | Listo |
| Código en GitHub `main` | Listo |
| Supabase con datos de obras | Listo (≈76 / ≈71) |
| Captura + decisión emergencia | Listo |
| Captura + decisión impuestos | Listo |
| QuickBI embed + API tickets | Listo |
| Docker compose + docs | Listo |
| Tests unitarios obras + typecheck | Listo |

**Fuera de alcance de este ciclo (explícito):** clon pixel-perfect del SPA Recharts del zip SMD; roles propios `tablero_admin` del zip; tema *declaratoria* (no venía en ese paquete); nueva base de datos por tema.

---

*Documento de entrega — ciclo QuickBI · Docker · Obras emergencia / impuestos · UNGRD Temas Operativos.*
