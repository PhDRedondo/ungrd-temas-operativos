# Frontend

## Stack UI

- Next.js 16 App Router · React 19 · Tailwind 4
- Recharts · d3-sankey · Leaflet / react-leaflet
- Lucide icons · branding en `public/branding/`

## Rutas de aplicación

| Ruta | Descripción |
|------|-------------|
| `/` | Landing / redirect |
| `/login` | Auth demo o Keycloak |
| `/app` | Hub de temas (según ACL) |
| `/app/temas/[slug]` | Workspace: captura · analítica · cargas |
| `/app/cargas` | Bandeja global de uploads |
| `/app/admin/permisos` | ACL (admin) |
| `/app/acerca` | Ficha técnica |

## Componentes clave

| Componente | Rol |
|------------|-----|
| `ThemeWorkspace` | Tabs + carga de records + refresh |
| `CapturePanel` | Formulario + upload Excel |
| `AnalyticsPanel` | Filtros, KPIs, charts, SQL sync badge |
| `ColombiaMap` | Coropleta / puntos; fetch `/geo/...` |
| `UploadsInbox` | Historial de cargas |
| `AppShell` | Layout autenticado |

## Contrato con temas

Los campos del formulario y plantilla salen de:

```ts
// src/themes/<slug>/theme.ts
buildTheme({ id, name, extraFields, ... })
```

No hardcodear campos de un tema en componentes globales.

## Flujo analítica

1. `ThemeWorkspace` hace `GET /api/themes/:slug/records`.
2. `AnalyticsPanel` agrega en cliente + `GET .../analytics` para SQL.
3. Mapa recibe `aggregation` derivado de filtros.
4. Tras captura/upload → `bump()` refresca records y charts.

## Estilos

- Tokens UNGRD: navy `#002d5a` / `#001a36`, amarillo `#ffd100`.
- Clases `ungrd-*` en `globals.css`.
- Leaflet CSS importado globalmente.

## Qué no hacer en front

- Persistir datos de negocio solo en `localStorage` (excepto preferencias UI).
- Importar `.geojson` directo en componentes cliente (usar `/public/geo`).
- Duplicar lógica DIVIPOLA — usar `@/lib/geo`.
