# Datos geoespaciales / catálogos

## DIVIPOLA (códigos y coordenadas)

Archivo: `divipola.json`  
Fuente: [datos.gov.co](https://www.datos.gov.co/resource/gdxc-w37w.json) (DANE).

- 33 departamentos · 1122 municipios
- No inventado: API pública Socrata
- Raw opcional: `divipola-municipios.raw.json`

## GeoJSON oficial — Departamentos (MGN 2024)

Archivos:

- `geo/departamentos-mgn2024.json` (FeatureCollection; extensión `.json` para Turbopack/Next)
- `geo/departamentos-mgn2024.geojson` (copia misma, formato estándar)
- `geo/departamentos-mgn2024.meta.json`

Fuente DANE FeatureServer:

`https://geoportal.dane.gov.co/mparcgis/rest/services/MGN2024/Serv_CapasMGN_2024/FeatureServer/319`

- CRS EPSG:4326
- Geometría simplificada (`maxAllowableOffset=0.01`) para el mapa web
- Usado en `ColombiaMap` como coropleta departamental

## Municipios (polígonos)

Capa oficial: FeatureServer **317 Municipio** (mismo servicio MGN2024).  
No se embebió el archivo completo (~1100 polígonos, pesado).  
A nivel municipal el mapa usa puntos oficiales DIVIPOLA.

## Actualizar DIVIPOLA

```bash
curl -sL "https://www.datos.gov.co/resource/gdxc-w37w.json?\$limit=50000" \
  -o data/divipola-municipios.raw.json
# Regenerar divipola.json (script Python de la sesión / agente)
```
