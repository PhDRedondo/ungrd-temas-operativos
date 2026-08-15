# Memoria del proyecto

Documento vivo para socios, desarrolladores y agentes de IA.  
Actualizar cuando cambie una decisión de arquitectura o el estado del MVP.

**Grafo de arquitectura (Graphify):** `graphify-out/graph.html` · `GRAPH_REPORT.md` · `graph.json`  
Rebuild: `graphify update .` (sin LLM). Commit indexado: `19ccb2c`.

---

## 1. Antes → ahora

| Dimensión | Antes (prototipo) | Ahora (MVP operable + cloud) |
|-----------|-------------------|------------------------------|
| Datos | Memoria / `localStorage` | PostgreSQL + Drizzle (+ Supabase en prod) |
| Auth | Demo débil en cliente | Auth.js · demo o Keycloak · cookie HTTPS/Vercel |
| Excel | Headers SheetJS | ExcelJS + Zod + DIVIPOLA + dry-run + upsert por clave+capa |
| Analítica | Solo cliente sobre demo | Records DB + SQL + Centro de Mando + decisión + red |
| Mapa | Demo | MGN 2024 + puntos DIVIPOLA + leyendas por base |
| Temas | UI + seed sintético | Temas cableados desde Excel oficiales (schema v3) |
| Reportes | — | PDF branding UNGRD + cron daily briefing |
| Calidad | Manual | `harness` + `smoke` + tests unitarios de pipeline |
| Deploy | Solo local | Vercel prod piloto Agua: `ungrd-manejo-phi.vercel.app` |

**Frase de producto:** de demo visual a plataforma operativa con ETL de bases oficiales, mando nacional y evidencias de contrato.

---

## 2. Decisiones (ADR ligero)

### ADR-001 · Sin Clerk
Auth open source (Auth.js + Keycloak). Modo `demo` para DX; Keycloak con Docker.

### ADR-002 · Temas como carpetas autónomas
`src/themes/<slug>/theme.ts` es el contrato. PRs por tema sin pisar núcleo.

### ADR-003 · Geo solo oficial
DIVIPOLA + MGN DANE 2024; no inventar municipios.

### ADR-004 · Mapa vía `public/geo`
JSON estático (Turbopack). Fuente: `data/geo/` → copiar a `public/geo/`.

### ADR-005 · ACL_STRICT
Local `false` (acceso amplio por rol). Prod `true` (ACL explícita).

### ADR-006 · Monolito Next (BFF)
Route Handlers en el mismo repo (v0.1). Platform API v1 (`/api/v1/cases|tasks`) coexistiendo con legacy `/api/themes/*`.

### ADR-007 · Protocolo de seguridad en middleware
Rate limit + ban IP + path inspection + headers + body limit (`src/lib/security`).

### ADR-008 · Clave de seguimiento + capa
Todo registro lleva `tipo_registro`, `capa`, `clave_seguimiento` para cruces, upsert y mando nacional.

### ADR-009 · Piloto contractual Agua y Saneamiento
Contrato 9677: foco en maqueta como matriz + satélites (bitácora, pagos, mods, CDP/RC) con inferencia de capa.

### ADR-010 · Medallón = 1 URL + schema.tema + tabla por hoja + JOIN intra-schema
Equipo de datos: una connection string `medallion_reader`. Cada hoja es
jalable sola con el **mismo nombre Excel** (`agua.general`, `agua.bitacora`,
`puentes.base_general_puentes`, `puentes.bitacora` con `convenio_o_cto`, …).
Sin `all`/`inventario`/`maqueta` inventados. Catálogo: `medallion.v_connections`.
**JOINs solo dentro del mismo schema** (`medallion.v_join_map`):
- Puentes: `id_puente` (bitácora↔inventario); `clave_proceso` / `convenio_o_cto` (↔contratos)
- Agua: `orden_de_proveeduria` une satélites con `agua.general`
No cruzar `puentes.*` con `agua.*`. Regenerar: `npm run medallion:generate` → aplicar SQL.
Handoff colega: `docs/platform/MEDALLION-DDL-HANDOFF.md`. Prod `vbxvqctdemtnmkifrxeo`
tiene **001+003 aplicados** (2026-08-06): `agua.general` (no `maqueta`), `v_join_map` OK.

### ADR-011 · Silver físico (Agua / Puentes) sin tocar captura
Schemas `silver_agua` / `silver_puentes`: tablas físicas con PK `record_id`,
FKs DEFERRABLE, dim `silver_agua.orden` (absorbe OPs huérfanas), sync
truncate+reload desde vistas Bronze. Captura y `public.records` intactos.
Bronze/Silver = **solo datos operativos reales** (`form`/`excel`; excluye
`seed`/`demo`/`harness`/`smoke`/`test`). Soft-delete 843 seeds en prod
2026-08-06. Docs: `docs/platform/MEDALLION-SILVER.md`. Scripts:
`medallion:generate-silver` · `medallion:sync-silver` · `medallion:test-silver`.
Prod sync post-filtro: Bronze=Silver; dim orden=112, general=107.

---

## 3. Inventario técnico actual

### Front (UI)
- `ThemeWorkspace` — captura / analítica / cargas / QuickBI / análisis avanzado
- `CapturePanel` + multi-form por capa (`capture-forms.ts`) + lookup OP (`OrdenLookup`)
- `MaquetaExcelView` — vista tipo Excel, badge versión, resaltado de cambios
- `AnalyticsPanel` + `ColombiaMap` + `SankeyFlowDiagram` + `AdvancedAnalysisPanel` (red)
- `NationalCommandCenter` — semáforos, alertas, deep-links a temas, PDF/Excel briefing
- `DecisionDashboard` · `RecordFilterBar` (URL compartible) · `TrackingGrid` · `ClaveCapasTimeline`
- Branding UNGRD (navy + amarillo institucional)

### Back (API)
| Área | Rutas |
|------|-------|
| Temas | `/api/themes/:slug/records`, `uploads`, `template`, `analytics`, `orders`, `change-marks` |
| Nacional | `/api/analytics/national`, `/api/analytics/crosswalk` |
| Reportes | `/api/reports/theme`, `/api/reports/national` |
| Cron | `/api/cron/daily-briefing` |
| Platform | `/api/v1/cases`, `/api/v1/tasks`, `/api/v1/me` |
| Admin | `/api/admin/access`, `security`, `schema-sync` |
| Auth | `/api/auth/[...nextauth]`, `/api/me/access` |

### Dominio (`src/lib`)
- `validation/record-schema.ts` — Zod + DIVIPOLA
- `excel/template.ts` — plantillas + remap
- `uploads/process-excel.ts` + `capa-inference.ts` — dry-run / upsert / inferencia
- `records/repository.ts` + `versions.ts` + `order-lookup.ts`
- `analytics/*` — national, decision, crosswalk, timeSeries, filters, PDF/Excel briefings
- `pdf/brand.ts` + `sendBriefingEmail.ts`
- `security/*` · `geo/*` · `workflow/*` · `publication/*`

### Temas cableados (schemaVersion 3–4)
**Puentes (v4 multi-capa)** · Obras emergencia · Obras por impuestos · Declaratoria · Banco maquinaria · Carrotanques · **Agua y Saneamiento (piloto)** · FIC · + resto del catálogo en `src/themes/`.

### Datos geo
- `data/divipola.json` — 33 deptos / 1122 municipios
- `public/geo/departamentos-mgn2024.json` — coropleta

### Verificación
- `npm run harness` · `npm run smoke` · `npm run test:unit`
- Prod smoke: tema Agua en Vercel

### Artefactos fuera del repo (carpeta Johan)
- `Comparacion_Bases_vs_Formularios_UNGRD.xlsx`
- `Comparacion_Agua_Saneamiento_Bases_vs_Formulario.xlsx`
- `Modelo_Alimentacion_Maqueta_Agua.xlsx`
- `evidencias-contrato-temas-operativos/` — informe supervisión + figuras

---

## 4. Lo último implementado (jul 2026) — leer primero

Orden cronológico reciente (commits + trabajo contractual):

1. **Plataforma operativa** — Postgres, workflows, cargas ArcGIS, tema FIC desde `Seguimiento_FIC_2026`
2. **Auth/Vercel** — cookie sesión HTTPS, login demo restringido, rate limits navegación
3. **Centro de mando** — semáforos/alertas por base, interconexión DIVIPOLA + claves
4. **Mapa real** — coroplético + filtros espaciales; macro/micro y leyendas por realidad de base
5. **Excel avanzado** — validar sin guardar, upsert por clave, inferencia de capa (maqueta/bitácora)
6. **Analítica de decisión** — lenguaje operativo, series temporales 24m, red sin jerga
7. **Filtros** — barra compartida, búsqueda por clave, URL compartible, deep-links, guía
8. **Reportes PDF** — branding UNGRD, API theme/national, cron daily briefing
9. **Evidencia contrato 9677** — comparación bases↔formularios, modelo alimentación maqueta, informe + figuras
10. **Graphify** — grafo del repo (1501 nodos / 3066 aristas / 128 comunidades) en `graphify-out/`
11. **Puentes multi-capa (ago 2026)** — `schemaVersion` 4: inventario (`id_puente`) + bitácora append + estructuración por `clave_proceso`; `PuenteLookup`/`ProcesoLookup`; reimport `scripts/reimport-puentes.ts`; sync inventario vía `puente-sync.ts`.
12. **Orden de alimentación Puentes (ago 2026)** — el proceso es la raíz: **Estructuración → Inventario → Bitácora**. Estructuración origina el proceso (`lookupOptional` en `CaptureFormConfig` + creación desde `ProcesoLookup`); el inventario exige proceso y hereda `contrato_convenio`/`clave_proceso`/`tipo_vinculo`/`descripcion_proceso`. `searchThemeProcesos` lee la capa Estructuración (inventario solo como legacy, marcado *sin etapas*). Reimport reordenado + `--seed-procesos`; `scripts/seed-procesos-estructuracion.ts` y `scripts/demo-puentes-orden.ts`.
13. **Contrato con punto de entrada único (ago 2026)** — `contrato_convenio` solo se escribe en Estructuración (`lookupCanCreate`); en Inventario y Bitácora llega heredado y actúa como filtro raíz. `proceso-chain.ts` aplica la regla en `POST`/`PATCH` de records; `capa-inference.ts` descarta el contrato de las hojas de bitácora. Facetas jerárquicas por `FACET_LEVEL` en `puente-lookup.ts`: contrato → origen → territorio → atributos.
14. **Banco de Maquinaria multi-capa (ago 2026)** — `schemaVersion` 6: **convenio raíz** (como Puentes); F–I editables; detalle por `serial` cuelga del convenio; sync bitácora/entrega; lookup `serial`/`convenio`.
15. **Carrotanques multi-capa (ago 2026)** — maqueta por `placa`; bitácora→M–P/T–Z; suministro→suma Q–R–S; formularios B–J / K–L.
16. **Subsidios de Arriendos (ago 2026)** — consolidado de envíos: identidad `uuid`; `numero_envio` + `n_orden` del archivo; ingesta Excel + formulario opcional; medallón `subsidios_arriendos.consolidado`.

### Hubs del grafo (core abstractions)
`requireSession` · `getTheme` · `ThemeConfig`/`ThemeModule` · `RecordRow` · `process-excel` · `buildDecisionBrief` · `enrichRecordsForDecision` · `NationalCommandCenter` · `guard` (security)

---

## 5. Deuda conocida

1. Keycloak requiere Docker (no en todas las máquinas).
2. Uploads en disco local (`/uploads`), no object storage.
3. Polígonos municipales completos no embebidos (peso).
4. Seed histórico puede tener municipios no DIVIPOLA.
5. Platform schemas (`iam/config/staging/workflow`) parcialmente documentados vs legacy `public`.
6. Memoria Claude-mem MCP puede fallar (dependencia `httpcore`); usar este `docs/MEMORY.md` + Graphify.

---

## 6. Glosario

| Término | Significado |
|---------|-------------|
| Tema | Módulo misional (`agua-y-saneamiento`, etc.) |
| Capa | Tipo de fila dentro del tema (maqueta, bitácora, pagos…) |
| Clave de seguimiento | Identificador de cruce (OP, placa, CDP, convenio…) |
| DIVIPOLA | Catálogo oficial depto/municipio DANE |
| MGN | Marco Geoestadístico Nacional (polígonos) |
| ACL | Access Control List por tema |
| Harness / Smoke | Checks locales / E2E corto |
| Mando nacional | Vista agregada multi-tema con alertas y briefing |
| Graphify | Knowledge graph del código (`graphify-out/`) |

---

## 7. Historial breve

| Fecha | Hito |
|-------|------|
| 2026-07-15 | Clone prototipo + plan Postgres/Auth/Excel |
| 2026-07-21 | Plataforma operativa + FIC + docs |
| 2026-07-22 | Hardening auth/Vercel |
| 2026-07-23 | Mando nacional, mapa, ETL, filtros, PDF/cron |
| 2026-07-28 | Comparación bases vs formularios + modelo maqueta Agua |
| 2026-07-30 | Evidencias contrato 9677 (informe + figuras) |
| 2026-07-31 | Init memoria agent + Graphify arquitectura |
