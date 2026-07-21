# Memoria del proyecto

Documento vivo para socios, desarrolladores y agentes de IA.  
Actualizar cuando cambie una decisión de arquitectura o el estado del MVP.

---

## 1. Antes → ahora

| Dimensión | Antes (prototipo) | Ahora (MVP local) |
|-----------|-------------------|-------------------|
| Datos | Memoria / `localStorage` | PostgreSQL + Drizzle |
| Auth | Demo débil en cliente | Auth.js · demo o Keycloak |
| Excel | Headers SheetJS | ExcelJS + Zod + DIVIPOLA + bandeja |
| Analítica | Solo cliente sobre demo | Records DB + SQL aggregates |
| Mapa | Demo | MGN 2024 + puntos DIVIPOLA |
| Temas | UI + seed sintético | Mismos módulos + persistencia real |
| Calidad | Manual | `harness` + `smoke` |

**Frase de producto:** de demo visual a MVP operable en local.

---

## 2. Decisiones (ADR ligero)

### ADR-001 · Sin Clerk

- **Decisión:** Auth open source (Auth.js + Keycloak).
- **Motivo:** requisito explícito del producto; evitar SaaS de auth de pago.
- **Consecuencia:** modo `demo` para DX sin Docker; Keycloak cuando haya contenedores.

### ADR-002 · Temas como carpetas autónomas

- **Decisión:** `src/themes/<slug>/theme.ts` es el contrato de campos.
- **Motivo:** PRs por desarrollador sin pisar núcleo.
- **Consecuencia:** cambios de `ThemeConfig` / componentes compartidos = PR de arquitectura.

### ADR-003 · Geo solo oficial

- **Decisión:** DIVIPOLA (datos.gov.co) + MGN DANE 2024; no inventar municipios.
- **Consecuencia:** seed antiguo con nombres no DIVIPOLA puede fallar re-validación.

### ADR-004 · Mapa vía `public/geo`

- **Decisión:** servir JSON estático; fetch en cliente.
- **Motivo:** Turbopack no resuelve bien imports de `.geojson` / JSON fuera de bundling esperado.
- **Fuente canónica:** `data/geo/` → copiar a `public/geo/` al actualizar.

### ADR-005 · ACL_STRICT

- **Local:** `false` → sin filas ACL, acceso amplio según rol.
- **Prod:** `true` → sin filas ACL, sin acceso (fuerza asignación explícita).

### ADR-006 · Monolito Next (BFF)

- **Decisión:** API en Route Handlers del mismo repo, no microservicio aparte (v0.1).
- **Motivo:** velocidad de entrega local; un solo deploy path futuro.

### ADR-007 · Protocolo de seguridad en middleware

- **Decisión:** Rate limit + ban IP progresivo + inspección de path + headers + límite de body en `src/lib/security`, aplicado en middleware global.
- **Motivo:** Mitigar abuso / fuerza bruta / sondas antes del deploy.
- **Consecuencia:** Almacén en memoria por proceso (Redis opcional a futuro). Localhost allowlist en desarrollo.

---

## 3. Inventario técnico actual

### Front

- `ThemeWorkspace` orquesta captura / analítica / cargas.
- `AnalyticsPanel` + `ColombiaMap` + `SankeyFlowDiagram`.
- Branding UNGRD (navy + amarillo).

### Back

- APIs bajo `/api/themes/:slug/*`, `/api/uploads`, `/api/me/access`, `/api/admin/access`, `/api/health`.
- Validación `src/lib/validation/record-schema.ts`.
- Excel `src/lib/excel/template.ts`.

### Datos geo

- `data/divipola.json` — 33 / 1122
- `public/geo/departamentos-mgn2024.json` — coropleta depto

### Verificación

- `npm run harness` — env + back + front
- `npm run smoke` — login → template → upload → bandeja

---

## 4. Deuda conocida (no olvidar)

1. Keycloak requiere Docker (no instalado en todas las máquinas).
2. Uploads en disco local (`/uploads`), no object storage.
3. Polígonos municipales completos no embebidos (peso).
4. Seed histórico puede tener municipios no DIVIPOLA.
5. README antiguo (Alibaba Cloud detallado) condensado en [`ROADMAP.md`](./ROADMAP.md).

---

## 5. Glosario

| Término | Significado |
|---------|-------------|
| Tema | Módulo misional (`agua-y-saneamiento`, etc.) |
| DIVIPOLA | Catálogo oficial depto/municipio DANE |
| MGN | Marco Geoestadístico Nacional (polígonos) |
| ACL | Access Control List por tema |
| Harness | Suite de checks locales (env/back/front) |
| Smoke | Prueba E2E corta de caminos críticos |

---

## 6. Historial breve

| Fecha | Hito |
|-------|------|
| 2026-07 | Clone prototipo cliente-only |
| 2026-07 | Postgres + Auth.js + Excel + ACL |
| 2026-07 | DIVIPOLA + mapa MGN + smoke |
| 2026-07 | Docs profesionales + harness |
| 2026-07 | Protocolo seguridad v1 (rate limit, ban IP, headers) |
