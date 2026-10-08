# Roadmap

## Hecho (MVP local)

- [x] Postgres + Drizzle + seed  
- [x] Auth.js demo + preparación Keycloak  
- [x] Excel tipado + validación DIVIPOLA + bandeja  
- [x] Analítica + mapa MGN conectados a DB  
- [x] ACL por tema + UI admin  
- [x] Docs profesionales + harness + smoke  

## Próximo (afianzar)

1. **Docker obligatorio en equipo** → Keycloak real en daily driver  
2. **CI** GitHub Actions: typecheck + lint + harness + smoke  
3. **Object storage** (MinIO local / OSS cloud) para Excel  
4. **ACL_STRICT=true** + seeds de permisos por usuario  
5. **Deploy** staging (Vercel o equivalente) con Postgres managed  

## Después

- Polígonos municipales bajo demanda (no embebidos)  
- Cola de workers para cargas muy grandes  
- Observabilidad (logs estructurados, métricas)  
- Hardening Keycloak (HTTPS, temas realm UNGRD)  

## Visión cloud (referencia histórica)

La base de datos ya está en Alibaba Cloud: PostgreSQL RDS, la misma instancia para la app y QuickBI (`docs/platform/ALIBABA-RDS.md`). Sigue pendiente como infraestructura, no como base de datos:

- RDS PostgreSQL ↔ `DATABASE_URL` ya está hecho. No volver a tratarlo como futuro.
- OSS ↔ archivos de carga
- IdP (Keycloak o IdP institucional) ↔ `AUTH_MODE=keycloak`
- Secretos en KMS / secret manager

Detalle de producto y UX de temas: ver también `/app/acerca` en la app.
