# STATUS

**Agente:** Cursor  
**Fecha:** 2026-09-24  
**Deploy:** pedido por el usuario. Filtro del tablero (SMD + SDG 0900/2025 y 0384/2026) se sube a `origin` y `phdredondo` para que Vercel publique.  
**Proyecto:** UNGRD Temas Operativos  
**Ruta:** `/Users/jackstive26/Desktop/Johan/ungrd-temas-operativos`

## CONTINUAR AQUÍ (tras borrar cache o chats de Cursor)

Este archivo **es** la continuidad tipo SAG. Un chat nuevo no necesita `state.vscdb`.

1. Leer este archivo + `docs/MEMORY.md` (ADR-012, ADR-013).
2. `memanto recall --recent --tool cursor` (agente `jack-fleet` si pide activate).
3. `graphify query "<pregunta>"` antes de explorar código.
4. No force-push. No Clerk. Temas: solo `src/themes/<slug>/` salvo núcleo pedido.

## Dónde está cada cosa

| Qué | Dónde |
|-----|--------|
| Prod | https://ungrd-manejo-phi.vercel.app |
| Health | `/api/health` — `db:"up"` |
| Código en prod | `70c8930` (tablero SMD + formulario de cupo) |
| Git canónico | `origin` = `UNGRD-FNGRD/manejo-aplicativo-temas` |
| Git que dispara Vercel | `phdredondo` = `PhDRedondo/ungrd-temas-operativos` |
| Local DB | RDS Alibaba (`DATABASE_URL`, `sslmode=disable`) |
| Prod DB **hoy** | Supabase pooler (Vercel `DATABASE_URL` aún no es RDS) |
| Espejo | 834 CDP SMD vivos en **las dos** (2026-09-18) |

RDS: `pgm-7gotc9vw1p903hrzbo.pg.rds-aliyun-america.rds.aliyuncs.com:5432` / db y user `d01_p011_aplicativo_temas`. Password en `.env.local`, nunca en git.

## Ejecución financiera (foco reciente)

- Carga Fidusap **pestaña SMD** tal cual (~834 CDP, incluye SDG). Sin plantilla ni Captura.
- Tablero **Control y seguimiento: ejecución por línea** (grupo = filtro).
- Formulario de cupo en **Cargar Excel** (`SmdCorteCupoForm`): cupo COP **por línea**, a mano, ligado al corte.
- **Disponible = cupo − CDP**. Saldo por comprometer = **CDP − RC**. Excel no trae apropiación.
- El formulario **sí está en producción**. Los cupos **no**: 0 guardados → el tablero no muestra apropiación hasta llenarlo.
- Catálogo SIIF (`apropiaciones.ts`) vacío a propósito.
- Looker FNGRD (foto `PHOTO-2026-09-15-12-21-25`) es catálogo nacional: Colombia Vital 9677020 y Volcán Galeras 9677005 **no están** en el Excel agosto 31. El visor agrupa las 5 líneas reales del SMD. Carga OK: Excel = RDS (834).
- Tablero: área ejecutora **SMD** (todas) + **SDG** solo resolución 0900 de 2025 y 0384 de 2026. 4026 de 2025 no está en el corte de agosto.

## Deploy

- Push a **los dos** remotes; Vercel solo se dispara con `phdredondo`.
- CLI Vercel local está en equipo Instituto GIS: **no** puede inspeccionar `phdredondo-projects`.
- Primer deploy SMD falló por TS (`UploadsInbox` + formatters Recharts); arreglo en `70c8930`.
- Tras Excel en un solo lado: `npm run db:sync-supabase` (RDS → Supabase).
- Cuando peguen RDS en Vercel: `DATABASE_URL` + `MEDALLION_DATABASE_URL` con `?sslmode=disable`, `AUTH_SECRET` nuevo, `AUTH_URL=https://ungrd-manejo-phi.vercel.app`, `ACL_STRICT=true`, `SECURITY_ALLOW_LOCALHOST=false`. Abrir 5432 a Vercel. **No** crear vars Supabase ni OSS todavía.
- OSS Alibaba = futuro (uploads hoy: disco local / `/tmp` en Vercel).

## Pendiente

- Llenar cupos del corte agosto 31 2026 en prod (Cargar Excel).
- Cambiar env Vercel a RDS cuando el SG lo permita; no borrar Supabase.
- QuickBI FIC `token3rd` 502 (pageId privado vs agua).
- Objetivo infra: ACK + OSS; mientras tanto Vercel + RDS + espejo Supabase.

## No tocar

- `git reset --hard`, force-push, descartar cambios ajenos.
- Reintroducir catálogo SIIF de apropiación.
- Clerk. Inventar municipios. Persistencia solo-cliente de negocio.

## Working tree sucio esperado

`STATUS.md`, `docs/MEMORY.md`, `scripts/sync-rds-to-supabase.ts`, `package.json` (`db:sync-supabase`), `.env.example`. No commitear `.env.local`. No push salvo pedido.
