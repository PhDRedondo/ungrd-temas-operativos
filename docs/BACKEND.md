# Backend local — stack open source

> Índice general: [`docs/README.md`](./README.md) · Arquitectura: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · API: [`API.md`](./API.md)

## Componentes

| Pieza | Tecnología | Licencia |
|---|---|---|
| App | Next.js 16 | MIT |
| ORM | Drizzle | Apache-2.0 |
| DB | PostgreSQL 14/16 | PostgreSQL |
| Auth | Auth.js + **Keycloak** | Apache-2.0 |
| Excel | ExcelJS + Zod | MIT / MIT |
| Contenedores | Docker Compose | — |

Sin Clerk, sin SaaS de auth de pago.

## Arranque rápido (demo auth + Postgres local)

```bash
# 1. Postgres accesible en 5432 (brew o Docker)
# 2. Variables
cp .env.example .env.local

# 3. Schema + seed
npm run db:setup

# 4. App
npm run dev
```

Login demo: cualquier correo + password ≥ 4, rol `captura` para escribir.

Health: http://localhost:3000/api/health

## Keycloak (OIDC completo)

Requiere Docker:

```bash
docker compose up -d
# Keycloak: http://localhost:8080  (admin / admin)
# Realm importado: ungrd
```

En `.env.local`:

```env
AUTH_MODE=keycloak
NEXT_PUBLIC_AUTH_MODE=keycloak
KEYCLOAK_CLIENT_ID=ungrd-app
KEYCLOAK_CLIENT_SECRET=ungrd-app-secret-change-me
KEYCLOAK_ISSUER=http://localhost:8080/realms/ungrd
AUTH_SECRET=cambiar-en-produccion
AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://ungrd:ungrd@127.0.0.1:5432/ungrd_temas
```

Usuarios de prueba (realm `ungrd`):

| Usuario | Password | Rol |
|---|---|---|
| captura@ungrd.gov.co | ungrd2026 | captura |
| analista@ungrd.gov.co | ungrd2026 | analista |
| admin@ungrd.gov.co | ungrd2026 | admin |
| auditor@ungrd.gov.co | ungrd2026 | auditor |

## APIs

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Salud DB |
| GET | `/api/me/access` | Temas visibles + permisos del usuario |
| GET/PUT | `/api/admin/access` | Admin: ACL por usuario |
| GET | `/api/uploads` | Bandeja de cargas (`?themeId=&mine=1`) |
| GET | `/api/uploads/:id` | Detalle (`?format=csv` errores) |
| GET | `/api/themes/:slug/records` | Listar registros |
| POST | `/api/themes/:slug/records` | Alta individual (Zod) |
| GET | `/api/themes/:slug/template` | Plantilla ExcelJS |
| POST | `/api/themes/:slug/uploads` | Carga masiva |

## ACL por tema

- Tabla `user_theme_access` (lectura/escritura por tema).
- `admin` / `auditor`: ven todos.
- Sin filas ACL + `ACL_STRICT=false` (local): acceso amplio según rol.
- Con filas ACL: solo esos temas.
- UI admin: `/app/admin/permisos`
- Bandeja: `/app/cargas` y pestaña “Cargas Excel” en cada tema.

## Modelo

- `themes` — catálogo + `field_schema` versionado
- `records` — columnas fijas + `payload` jsonb
- `uploads` — estado y errores por fila
- `users` — mapeo Keycloak/demo sub → rol
- `user_theme_access` — permisos por tema
- `audit_log` — acciones

La fuente de campos sigue siendo `src/themes/<slug>/theme.ts`.

## DIVIPOLA

Catálogo oficial integrado desde [datos.gov.co](https://www.datos.gov.co/resource/gdxc-w37w.json) (DANE):

- Archivo: `data/divipola.json` (33 departamentos, 1122 municipios)
- Validación estricta municipio ∈ departamento en Zod
- UI de captura filtra municipios por departamento
- `/api/health` expone `geo.countMunicipalities`

Ver `data/README.md` para actualizar.
