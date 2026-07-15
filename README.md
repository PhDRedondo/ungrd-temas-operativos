# UNGRD — Gestión de Temas Operativos

Aplicación web para captura y analítica de temas operativos de la **UNGRD**, con identidad visual del **SNGRD** (azul navy + amarillo) y una puesta en escena inspirada en [Inventario de Pozos / ANH GOP](https://inventario-de-pozos.vercel.app).

## Qué incluye

- Página de inicio institucional
- Login demo (cualquier correo + contraseña ≥ 4 caracteres)
- Shell con menú lateral: 19 temas, visita guiada y acerca de
- Por tema:
  - **Captura**: formulario individual + carga masiva Excel
  - **Analítica**: filtros, tarjetas, mapa dept/muni, torta, barras, Sankey, serie de tiempo y heatmap

## Desarrollo

```bash
cd ungrd-app
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Stack

Next.js 16 · React 19 · Tailwind CSS 4 · Recharts · Leaflet · SheetJS · driver.js
