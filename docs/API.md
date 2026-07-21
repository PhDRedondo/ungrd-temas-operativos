# API — catálogo

Base: `http://localhost:3000` · Auth: cookie de sesión Auth.js.  
Seguridad: ver [`SECURITY.md`](./SECURITY.md) (rate limit, ban IP, headers).

## Salud

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | No | DB + geo DIVIPOLA + `authMode` |

## Auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| * | `/api/auth/*` | Auth.js (csrf, session, callback, signout) · rate limit estricto |

## Sesión / ACL / Seguridad

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/me/access` | Sí | Temas visibles + flags escritura |
| GET | `/api/admin/access` | Admin | Listar ACL |
| PUT | `/api/admin/access` | Admin | Upsert ACL usuario↔tema |
| GET | `/api/admin/security` | Admin | Bans activos, stats, límites |
| POST | `/api/admin/security` | Admin | `{ action: "ban"\|"unban", ip, minutes? }` |

## Temas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/themes/:slug/records` | Lectura tema | Lista registros activos |
| POST | `/api/themes/:slug/records` | Escritura | Alta individual (JSON `{ values }`) |
| GET | `/api/themes/:slug/analytics` | Lectura | Agregados SQL |
| GET | `/api/themes/:slug/template` | Lectura | Descarga `.xlsx` |
| POST | `/api/themes/:slug/uploads` | Escritura | `multipart/form-data` campo `file` (máx MB configurable) |

### Respuesta típica upload

```json
{
  "uploadId": "uuid",
  "accepted": 2,
  "rejected": 1,
  "duplicates": 0,
  "errors": [{ "row": 4, "field": "municipio", "code": "CUSTOM", "message": "..." }],
  "async": false
}
```

## Cargas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/uploads` | Sí | `?themeId=` · `?mine=1` |
| GET | `/api/uploads/:id` | Sí | Detalle; `?format=csv` errores |

## Códigos de error comunes

| HTTP | Código posible | Significado |
|------|----------------|------------|
| 400 | `BAD_REQUEST` | Path/sonda rechazada por filtro |
| 401 | — | Sin sesión |
| 403 | `IP_BANNED` / `IP_DENIED` | IP bloqueada o sin ACL |
| 404 | — | Tema o recurso inexistente |
| 413 | `PAYLOAD_TOO_LARGE` | Body / Excel demasiado grande |
| 415 | `BAD_FILE_TYPE` | No es Excel |
| 422 | — | Validación Zod / filas |
| 429 | `RATE_LIMITED` | Demasiadas peticiones |
| 500 | — | Error servidor |

## Estáticos relacionados

| Ruta | Descripción |
|------|-------------|
| `/geo/departamentos-mgn2024.json` | FeatureCollection MGN (mapa) |
