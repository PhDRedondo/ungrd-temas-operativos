# STATUS

**Agente:** Cursor  
**Fecha:** 2026-09-15  
**Foco:** Datos migrados a RDS Alibaba; app local apunta ahí (`sslmode=disable`).

**RDS:** `pgm-7gotc9vw1p903hrzbo.pg.rds-aliyun-america.rds.aliyuncs.com:5432` / db `d01_p011_aplicativo_temas`.  
**Verificado:** records 11305, live 5216, fic.fic 387 (igual que Supabase).

**Pendiente:** cambiar `DATABASE_URL` en Vercel al mismo RDS. QuickBI: dataset `fic.fic` clave `record_id`, SSL off.

**Git:** `origin` = `UNGRD-FNGRD/manejo-aplicativo-temas`. No guardar passwords/tokens en git.

**Prod Vercel (aún Supabase hasta cambiar env):** `https://ungrd-manejo-phi.vercel.app`
