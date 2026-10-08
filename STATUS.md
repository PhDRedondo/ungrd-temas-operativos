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
| Base local | RDS Alibaba (`DATABASE_URL`, `sslmode=disable`) |
| Base de producción | Supabase, hasta cambiar `DATABASE_URL` en Vercel |
| Espejo | `npm run db:sync-supabase` copia RDS hacia Supabase |

La contraseña de la base vive en `.env.local`. No se commitea.

## Ejecución financiera

- La carga Fidusap usa la pestaña SMD del corte, sin plantilla intermedia.
- El tablero agrupa por línea. El grupo es el filtro.
- El cupo se escribe a mano, por línea, en Cargar Excel, ligado al corte.
- Disponible = cupo − CDP. Saldo por comprometer = CDP − RC. El Excel no trae apropiación.
- El formulario está en producción. Los cupos del corte de agosto 2026 aún no están llenos, así que el tablero no muestra apropiación.

## Despliegue

- Publicar en los dos remotos. Vercel solo se dispara con `phdredondo`.
- Cuando la base de producción pase a RDS: `DATABASE_URL` y `MEDALLION_DATABASE_URL` con `sslmode=disable`, `AUTH_URL=https://ungrd-manejo-phi.vercel.app`, `ACL_STRICT=true` y `SECURITY_ALLOW_LOCALHOST=false`.

## Pendiente

- Llenar los cupos del corte de agosto 2026 en producción.
- Pasar el entorno de Vercel a RDS cuando el grupo de seguridad lo permita. No borrar el espejo Supabase.
- El embed QuickBI de FIC responde 502 cuando la página es privada.
