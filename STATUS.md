# Estado operativo

**Fecha:** 2026-10-08  
**Proyecto:** UNGRD Temas Operativos

## Dónde está cada cosa

| Qué | Dónde |
|-----|--------|
| Producción | https://ungrd-manejo-phi.vercel.app |
| Salud | `/api/health` |
| Repositorio canónico | `UNGRD-FNGRD/manejo-aplicativo-temas` |
| Remoto que despliega en Vercel | `PhDRedondo/ungrd-temas-operativos` |
| Base de datos | PostgreSQL en RDS de Alibaba Cloud. La misma instancia sirve a la app (local y Vercel) y a QuickBI |
| Comprobación | `GET /api/health` → `db: "up"` y host `*.rds.aliyuncs.com` (verificado el 8-oct-2026) |
| Conexión | `sslmode=disable`. Detalle en `docs/platform/ALIBABA-RDS.md` |

La contraseña de la base vive en `.env.local`. No se commitea.

## Ejecución financiera

- La carga Fidusap usa la pestaña SMD del corte, sin plantilla intermedia.
- El tablero agrupa por línea. El grupo es el filtro.
- El cupo se escribe a mano, por línea, en Cargar Excel, ligado al corte.
- Disponible = cupo − CDP. Saldo por comprometer = CDP − RC. El Excel no trae apropiación.
- El formulario está en producción. Los cupos del corte de agosto 2026 aún no están llenos, así que el tablero no muestra apropiación.

## Despliegue

- Publicar en los dos remotos. Vercel solo se dispara con `phdredondo`.
- `DATABASE_URL` y `MEDALLION_DATABASE_URL` de producción apuntan al RDS de Alibaba, con `sslmode=disable`. `AUTH_URL=https://ungrd-manejo-phi.vercel.app`, `ACL_STRICT=true` y `SECURITY_ALLOW_LOCALHOST=false`.

## Pendiente

- Llenar los cupos del corte de agosto 2026 en producción.
- El embed QuickBI de FIC responde 502 cuando la página es privada.
