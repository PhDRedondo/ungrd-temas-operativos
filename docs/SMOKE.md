# Smoke local — checklist

Complementa el [harness](./HARNESS.md). El smoke cubre el camino Excel de punta a punta.

## Automático

```bash
npm run dev          # terminal 1
npm run smoke        # terminal 2
```

Valida: health + DIVIPOLA · login demo · records · analytics SQL · plantilla · carga (2 OK + 1 muni inválido) · bandeja.

## Manual UI (5 min)

1. Login demo — rol captura o admin.  
2. Tema **Agua y Saneamiento** → Analítica: mapa + gráficos.  
3. Clic en un departamento → filtra barras/pie/sankey.  
4. Captura → formulario → guardar → Analítica actualizada.  
5. Captura → Excel → plantilla → filas DIVIPOLA → subir.  
6. Pestaña **Cargas Excel** / `/app/cargas`.  
7. Admin → `/app/admin/permisos` (rol admin).

## Credenciales smoke

Script: `smoke@ungrd.gov.co` / `ungrd2026` (credentials demo).

## Notas

- Keycloak: `npm run stack:up` + `AUTH_MODE=keycloak`.
- Geo: DIVIPOLA `data/divipola.json` · polígonos `public/geo/`.
