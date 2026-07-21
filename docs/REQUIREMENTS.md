# Requisitos del sistema

Versión del documento: **0.1.0** · Ámbito: MVP local operable (pre-producción).

## 1. Objetivo

Centralizar captura y analítica de **temas operativos UNGRD**, con:

- Persistencia confiable
- Validación geográfica oficial (DIVIPOLA)
- Carga masiva Excel auditable
- Visualización (gráficos + mapa) sobre la misma fuente de datos
- Control de acceso por rol y, opcionalmente, por tema

## 2. Actores

| Actor | Necesidad |
|-------|-----------|
| Capturador | Formulario + Excel; ver resultado en analítica |
| Analista | Consultar KPIs, mapa y gráficos filtrables |
| Administrador | Gestionar permisos por tema |
| Auditor | Lectura global + historial de cargas |
| Desarrollador de tema | Evolucionar solo `src/themes/<slug>/` |

## 3. Requisitos funcionales

### RF-01 Temas

- El sistema expone N temas registrados en `src/themes/`.
- Cada tema define su schema de campos (`FormField[]`) de forma autónoma.

### RF-02 Captura individual

- Formulario según schema del tema.
- Validación servidor (Zod) + municipio ∈ departamento (DIVIPOLA).
- Persistencia en PostgreSQL.

### RF-03 Carga masiva Excel

- Descarga de plantilla tipada (headers = `field.name`, dropdowns, meta schema).
- Upload `.xlsx` con aceptación parcial (filas válidas / inválidas / duplicados).
- Bandeja de cargas con detalle y export CSV de errores.

### RF-04 Analítica

- KPIs: conteo, valor, departamentos, % finalizados.
- Gráficos: pie, barras, serie temporal, Sankey, heatmap.
- Filtros cruzados (clic en visualizaciones).
- Agregaciones SQL disponibles vía API.

### RF-05 Mapa

- Nivel departamento: polígonos MGN DANE 2024.
- Nivel municipio: puntos DIVIPOLA.
- Interacción: clic filtra analítica.

### RF-06 Autenticación y autorización

- Modo `demo` (local) y modo `keycloak` (OIDC).
- Roles: `captura`, `analista`, `admin`, `auditor`.
- ACL por tema (`user_theme_access`); `ACL_STRICT` configurable.

### RF-07 Observabilidad mínima

- `GET /api/health` (DB + geo).
- Harness y smoke scripts.

## 4. Requisitos no funcionales

| ID | Requisito | Criterio |
|----|-----------|----------|
| RNF-01 | Stack open source | Sin Clerk/SaaS auth de pago en el diseño base |
| RNF-02 | Datos geo oficiales | Solo DIVIPOLA / MGN; no inventar municipios |
| RNF-03 | DX local | `npm run dev` + Postgres; smoke en < 30 s |
| RNF-04 | Temas desacoplados | PRs de tema no tocan núcleo sin acuerdo |
| RNF-05 | Auditoría de cargas | Cada upload deja rastro (usuario, counts, errores) |
| RNF-06 | Seguridad básica | Middleware en `/app` y APIs; secretos en env |

## 5. Fuera de alcance (v0.1)

- Object storage productivo (MinIO/S3) — uploads locales
- Polígonos municipales completos embebidos
- Push automático a Vercel / CI cloud obligatorio
- App móvil nativa
- Integración ERP / presupuestal en tiempo real

## 6. Criterios de aceptación del MVP local

- [x] Health OK con DIVIPOLA ≥ 1000 municipios  
- [x] Login demo + records + analytics SQL  
- [x] Plantilla Excel + upload con rechazo de muni inválido  
- [x] Mapa y gráficos alimentados desde Postgres  
- [x] `npm run harness` y `npm run smoke` en verde  

Verificación: [`HARNESS.md`](./HARNESS.md) · [`SMOKE.md`](./SMOKE.md)
