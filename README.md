# UNGRD — Gestión de Temas Operativos

Plataforma web institucional para **captura** y **analítica** de temas misionales de la [Unidad Nacional para la Gestión del Riesgo de Desastres (UNGRD)](https://portal.gestiondelriesgo.gov.co/), enmarcada en el **Sistema Nacional de Gestión del Riesgo de Desastres (SNGRD)**.

| | |
|---|---|
| **Versión** | `0.1.0` · prototipo funcional |
| **Repositorio** | [PhDRedondo/ungrd-temas-operativos](https://github.com/PhDRedondo/ungrd-temas-operativos) |
| **Demo** | [ungrd-manejo-phi.vercel.app](https://ungrd-manejo-phi.vercel.app) |
| **Referencia UX** | [Inventario de Pozos / ANH GOP](https://inventario-de-pozos.vercel.app) |
| **Identidad** | Branding SNGRD/UNGRD (navy + amarillo; logos color / 1 tinta) |

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del prototipo actual](#2-arquitectura-del-prototipo-actual)
3. [Mapa de rutas y experiencia de usuario](#3-mapa-de-rutas-y-experiencia-de-usuario)
4. [Módulo de captura](#4-módulo-de-captura)
5. [Módulo de analítica (filtros cruzados)](#5-módulo-de-analítica-filtros-cruzados)
6. [Temas operativos (carpetas autónomas)](#6-temas-operativos-carpetas-autónomas)
7. [Stack tecnológico](#7-stack-tecnológico)
8. [Estructura del repositorio y flujo GitHub](#8-estructura-del-repositorio-y-flujo-github)
9. [Arquitectura objetivo en Alibaba Cloud](#9-arquitectura-objetivo-en-alibaba-cloud)
10. [Modelo de datos propuesto](#10-modelo-de-datos-propuesto)
11. [Seguridad y operación](#11-seguridad-y-operación)
12. [Roadmap](#12-roadmap)
13. [Desarrollo local](#13-desarrollo-local)
14. [Despliegue](#14-despliegue)
15. [Limitaciones del prototipo](#15-limitaciones-del-prototipo)

---

## 1. Resumen ejecutivo

La aplicación centraliza **20 módulos** (19 temas operativos + plantilla de referencia: agua y saneamiento, carrotanques, obras de emergencia, presupuesto, declaratorias, etc.). Cada tema ofrece:

- **Captura de datos**: formulario individual + carga masiva Excel.
- **Analítica**: KPI, mapa departamental/municipal, torta, barras, serie temporal, Sankey y heatmap, con **filtros cruzados** entre visualizaciones.

**Organización para equipos:** el monorepo aísla cada tema en `src/themes/<slug>/`, de modo que cada desarrollador puede evolucionar su módulo desde GitHub con PRs acotados, sin pisar el trabajo de otros. El núcleo compartido (`src/components`, `src/lib`, `src/themes/shared`) solo se toca en PRs de arquitectura.

El prototipo actual es **100 % cliente** (Next.js App Router): autenticación demo, datos sintéticos y agregaciones en el navegador. La ficha técnica en `/app/acerca` y las secciones 9–12 definen la articulación con **Alibaba Cloud**.

---

## 2. Arquitectura del prototipo actual

### 2.1 Vista lógica

```mermaid
flowchart TB
  subgraph Cliente["Navegador del usuario"]
    UI["Next.js App Router<br/>React 19 · Tailwind 4"]
    AUTH["AuthProvider<br/>localStorage"]
    THEME["ThemeProvider<br/>claro / oscuro"]
    DATA["Generador demo + caché en memoria<br/>lib/data.ts"]
    CAP["CapturePanel<br/>formulario + xlsx"]
    AN["AnalyticsPanel<br/>agregaciones client-side"]
    MAP["Leaflet · OSM tiles"]
    CHARTS["Recharts + d3-sankey"]
  end

  UI --> AUTH
  UI --> THEME
  UI --> DATA
  DATA --> CAP
  DATA --> AN
  AN --> MAP
  AN --> CHARTS

  OSM["OpenStreetMap<br/>(tiles públicos)"] -.-> MAP

  style Cliente fill:#001a36,color:#fff,stroke:#ffd100
```

### 2.2 Capas de la aplicación

```mermaid
flowchart LR
  subgraph Presentación
    P1["Landing /"]
    P2["Login /login"]
    P3["Shell /app"]
    P4["Tema /app/temas/slug"]
    P5["Acerca /app/acerca"]
  end

  subgraph Dominio["Dominio · monorepo por tema"]
    D0["src/themes/index.ts<br/>registro"]
    D1["src/themes/slug/<br/>theme.ts autónomo"]
    D2["lib/geo.ts"]
    D3["lib/data.ts"]
  end

  subgraph UX
    U1["AppShell sidebar"]
    U2["Visita guiada driver.js"]
    U3["BrandLogo claro/oscuro"]
  end

  P3 --> U1
  P4 --> D0
  D0 --> D1
  P4 --> D2
  P4 --> D3
  U1 --> U2
  U1 --> U3
```

### 2.3 Lo que **no** incluye el prototipo

```mermaid
flowchart TB
  A["Prototipo actual"] --> B["Sin API backend"]
  A --> C["Sin base de datos"]
  A --> D["Sin object storage"]
  A --> E["Sin IdP / SSO"]
  A --> F["Sin CI/CD formal<br/>(solo Vercel + GitHub)"]

  B -.-> G["Objetivo: API Gateway + FC/SAE"]
  C -.-> H["Objetivo: RDS PostgreSQL"]
  D -.-> I["Objetivo: OSS"]
  E -.-> J["Objetivo: IDaaS / OIDC"]
```

---

## 3. Mapa de rutas y experiencia de usuario

### 3.1 Flujo de navegación

```mermaid
flowchart TD
  START([Usuario]) --> HOME["/ · Landing institucional"]
  HOME -->|Ingresar| LOGIN["/login"]
  LOGIN -->|demo auth OK| APP["/app · Panel general"]
  APP --> TEMA["/app/temas/slug"]
  APP --> ACERCA["/app/acerca"]
  APP --> TOUR["Visita guiada driver.js"]

  TEMA --> TAB1["Pestaña Captura"]
  TEMA --> TAB2["Pestaña Analítica"]

  TAB1 --> F1["Formulario individual"]
  TAB1 --> F2["Carga masiva Excel"]
  TAB2 --> VIZ["Mapa · KPI · Charts · Sankey · Heatmap"]

  ACERCA --> TECH["Ficha técnica + Alibaba Cloud"]
```

### 3.2 Shell de aplicación

| Elemento | Comportamiento |
|---|---|
| **Sidebar** | Lista de temas (19 operativos + plantilla) + visita guiada + acerca de + panel + logout |
| **Plegar** | Rail de íconos (`w-16`) con tooltips; pestaña a media altura |
| **Tema** | Claro / oscuro (persistido); logo color vs `1 tinta` |
| **Auth** | Guarda usuario en `localStorage` (`ungrd-auth-user`) |

---

## 4. Módulo de captura

```mermaid
flowchart LR
  subgraph Individual
    A1["Formulario tipado<br/>por ThemeConfig"] --> A2["Validación required"]
    A2 --> A3["addRecords themeId"]
  end

  subgraph Masiva
    B1["Descargar plantilla xlsx"] --> B2["Usuario completa Excel"]
    B2 --> B3["Parse SheetJS"]
    B3 --> A3
  end

  A3 --> C["Caché en memoria<br/>visible en Analítica"]
```

Campos comunes por tema: `departamento`, `municipio`, `fecha`, `estado`, más campos específicos (`valor`, `tipo_intervencion`, etc.).

---

## 5. Módulo de analítica (filtros cruzados)

Todas las visualizaciones comparten el mismo estado de filtros. Un clic en cualquier vista actualiza KPI, mapa, charts, Sankey y heatmap.

### 5.1 Dimensiones de filtro

| Dimensión | Origen típico del clic |
|---|---|
| `departamento` | Mapa (nivel depto), barras, Sankey col. 1, heatmap fila |
| `municipio` | Mapa (con depto activo) |
| `estado` | Select, torta (si no hay categoría), Sankey col. 2 |
| `tercero` / categoría | Torta / Sankey col. 3 (campo select del tema) |
| `periodo` `YYYY-MM` | Serie temporal, heatmap celda/columna |
| `from` / `to` | Inputs de fecha del panel |

### 5.2 Flujo de filtros cruzados

```mermaid
flowchart TB
  subgraph Fuentes["Interacciones"]
    M["Mapa Leaflet"]
    P["Pie Recharts"]
    B["Barras"]
    L["Serie temporal"]
    S["Sankey d3"]
    H["Heatmap"]
    F["Filtros UI"]
  end

  subgraph Estado["Estado compartido AnalyticsPanel"]
    ST["departamento · municipio · estado<br/>tercero · periodo · from/to"]
  end

  subgraph Salida["Vistas derivadas"]
    KPI["Tarjetas KPI"]
    MAPO["Mapa agregado"]
    CH["Charts"]
    SK["Sankey"]
    HM["Heatmap"]
  end

  M & P & B & L & S & H & F --> ST
  ST --> KPI & MAPO & CH & SK & HM
```

### 5.3 Pipeline Sankey

```mermaid
flowchart LR
  R["Records filtrados"] --> G["buildGraph<br/>dept → estado → categoría"]
  G --> D3["d3-sankey<br/>nodeId string"]
  D3 --> SVG["SVG nodos + flujos"]
  SVG -->|clic nodo| FILT["toggle filtro cruzado"]
```

---

## 6. Temas operativos (carpetas autónomas)

Cada tema es un **módulo de carpeta** con su propio `theme.ts`, registrado en `src/themes/index.ts`. La ruta pública sigue siendo `/app/temas/{slug}`.

### 6.1 Catálogo

| # | Tema | Slug / carpeta | Ruta app |
|---|---|---|---|
| 1 | Agua y Saneamiento | `agua-y-saneamiento` | `/app/temas/agua-y-saneamiento` |
| 2 | Carrotanques | `carrotanques` | `/app/temas/carrotanques` |
| 3 | Obras de Emergencia | `obras-de-emergencia` | `/app/temas/obras-de-emergencia` |
| 4 | Puentes | `puentes` | `/app/temas/puentes` |
| 5 | Banco de Maquinaria | `banco-de-maquinaria` | `/app/temas/banco-de-maquinaria` |
| 6 | Obras por impuestos | `obras-por-impuestos` | `/app/temas/obras-por-impuestos` |
| 7 | Asistencia Humanitaria | `asistencia-humanitaria` | `/app/temas/asistencia-humanitaria` |
| 8 | Gestión de Servicios | `gestion-de-servicios` | `/app/temas/gestion-de-servicios` |
| 9 | Subsidios de Arriendos | `subsidios-de-arriendos` | `/app/temas/subsidios-de-arriendos` |
| 10 | Alertas tempranas | `alertas-tempranas` | `/app/temas/alertas-tempranas` |
| 11 | Asistencia técnica | `asistencia-tecnica` | `/app/temas/asistencia-tecnica` |
| 12 | Equipo de respuesta | `equipo-de-respuesta` | `/app/temas/equipo-de-respuesta` |
| 13 | Compra de materiales | `compra-de-materiales` | `/app/temas/compra-de-materiales` |
| 14 | FIC | `fic` | `/app/temas/fic` |
| 15 | Convenios | `convenios` | `/app/temas/convenios` |
| 16 | Presupuesto | `presupuesto` | `/app/temas/presupuesto` |
| 17 | Ejecución financiera | `ejecucion-financiera` | `/app/temas/ejecucion-financiera` |
| 18 | Materiales | `materiales` | `/app/temas/materiales` |
| 19 | Declaratoria de emergencia | `declaratoria-de-emergencia` | `/app/temas/declaratoria-de-emergencia` |
| 20 | **Plantilla** (línea base, no modificar) | `plantilla` | `/app/temas/plantilla` |

Ruta en disco: `src/themes/<slug>/`. La carpeta `plantilla` es la referencia congelada para copiar o comparar temas.

### 6.2 Contenido de cada carpeta de tema

```text
src/themes/<slug>/
├── theme.ts      # buildTheme({ id, name, extraFields, … })
├── index.ts      # export del ThemeModule
└── README.md     # guía del desarrollador dueño del tema
```

Contrato exportado (`ThemeModule`):

```ts
{ config: ThemeConfig }
```

`ThemeConfig` incluye `id`, textos, `icon`, `unit`, `valueLabel` y `fields` (geo + campos propios + fecha/estado).

### 6.3 Diagrama de registro

```mermaid
flowchart TB
  subgraph Carpetas["src/themes/*  · un owner por carpeta"]
    A["agua-y-saneamiento/theme.ts"]
    B["carrotanques/theme.ts"]
    C["… 17 temas más"]
  end

  subgraph Núcleo["Compartido"]
    S["shared/buildTheme.ts"]
    R["index.ts · THEME_MODULES"]
    L["lib/themes.ts · reexport"]
  end

  subgraph App["Consumidores"]
    SHELL["AppShell sidebar"]
    PAGE["app/temas/slug/page.tsx"]
    CAP["CapturePanel"]
    AN["AnalyticsPanel"]
  end

  A & B & C --> R
  S --> A & B & C
  R --> L
  L --> SHELL & PAGE
  PAGE --> CAP & AN
```

---

## 7. Stack tecnológico

| Capa | Tecnología | Uso |
|---|---|---|
| Framework | **Next.js 16.2** (App Router, Turbopack) | SSR/SSG, rutas, deploy |
| UI | **React 19** · **Tailwind CSS 4** · Nunito Sans · Lucide | Interfaces |
| Mapas | **Leaflet 1.9** · **react-leaflet 5** · OSM | Coropleta por centroides |
| Charts | **Recharts 3** | Torta, barras, serie |
| Sankey | **d3-sankey** · **d3-shape** | Flujo dept → estado → categoría |
| Excel | **SheetJS (xlsx)** | Plantillas y carga masiva |
| Tour | **driver.js** | Visita guiada |
| Utils | **clsx** | Clases condicionales |
| Lenguaje | **TypeScript 5** | Tipado estricto |

### Diagrama de dependencias de frontend

```mermaid
flowchart TB
  NEXT["next"] --> REACT["react / react-dom"]
  NEXT --> TW["tailwindcss"]
  APP["App UNGRD"] --> NEXT
  APP --> RL["react-leaflet → leaflet"]
  APP --> RC["recharts"]
  APP --> D3["d3-sankey → d3-shape"]
  APP --> XLS["xlsx"]
  APP --> DJ["driver.js"]
  APP --> LC["lucide-react"]
```

---

## 8. Estructura del repositorio y flujo GitHub

```text
ungrd-app/
├── .github/CODEOWNERS        # Dueños por carpeta de tema
├── CONTRIBUTING.md           # Cómo trabajar un tema de forma autónoma
├── public/branding/          # Logos color y 1 tinta
├── src/
│   ├── app/                  # Rutas Next.js (landing, login, shell, temas)
│   ├── components/           # Núcleo compartido (Shell, Captura, Analítica)
│   ├── lib/                  # Auth, data, geo; lib/themes.ts reexporta el registro
│   └── themes/               # ★ Un directorio por tema (autonomía GitHub)
│       ├── README.md
│       ├── index.ts          # Registro THEME_MODULES
│       ├── shared/           # types + buildTheme
│       ├── agua-y-saneamiento/
│       │   ├── theme.ts
│       │   ├── index.ts
│       │   └── README.md
│       ├── carrotanques/
│       └── … (19 temas + plantilla)
├── package.json
└── README.md
```

### 8.1 Por qué carpetas (no un solo `themes.ts`)

| Beneficio | Detalle |
|---|---|
| PRs pequeños | Un PR típicamente solo cambia `src/themes/<slug>/` |
| Menos conflictos Git | Devs A y B no editan el mismo archivo monolítico |
| CODEOWNERS | GitHub puede exigir review del dueño de la carpeta |
| Onboarding | Cada tema trae su `README.md` local |
| Extensión futura | Validaciones, demo data o UI propia viven junto al tema |

### 8.2 Flujo de trabajo autónomo

```mermaid
sequenceDiagram
  participant Dev as Desarrollador del tema
  participant GH as GitHub
  participant Core as Núcleo shared/components
  participant CI as Build Vercel

  Dev->>GH: branch feat/slug-cambio
  Dev->>Dev: edita solo src/themes/slug/**
  Dev->>GH: Pull Request
  Note over GH: CODEOWNERS pide review del owner del slug
  GH->>CI: typecheck + next build
  CI-->>GH: OK
  GH->>GH: merge a main
  Note over Core: Intocado, salvo PRs de arquitectura
```

```bash
# Ejemplo: trabajar Agua y Saneamiento
git checkout -b feat/agua-y-saneamiento-nuevo-campo
# Editar únicamente:
#   src/themes/agua-y-saneamiento/theme.ts
#   src/themes/agua-y-saneamiento/README.md  (opcional)
git add src/themes/agua-y-saneamiento
git commit -m "feat(agua-y-saneamiento): agregar campo X"
git push -u origin HEAD
# Abrir PR en GitHub
```

### 8.3 Crear un tema nuevo

1. Copiar `src/themes/agua-y-saneamiento` como plantilla → renombrar carpeta.
2. Ajustar `id`, textos e `extraFields` en `theme.ts`.
3. Importar y registrar el módulo en `src/themes/index.ts`.
4. Añadir la ruta en `.github/CODEOWNERS`.
5. Verificar en `/app/temas/<slug>` y abrir PR (arquitectura + tema).

### 8.4 Qué sí / qué no tocar

| Sí (en su carpeta) | No (sin PR de núcleo) |
|---|---|
| `extraFields`, labels, icono, descripción | `src/components/*` |
| README del tema | Otras carpetas `src/themes/<otro>/` |
| Futuros `demo.ts` / `rules.ts` del tema | Romper el contrato `ThemeConfig` |
| | Quitar el tema del registro sin acuerdo |

Documentación detallada: [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`src/themes/README.md`](src/themes/README.md) · [`.github/CODEOWNERS`](.github/CODEOWNERS).

Reglas de Cursor (el agente respeta la carpeta del tema): [`.cursor/rules/theme-autonomy.mdc`](.cursor/rules/theme-autonomy.mdc) · [`.cursor/rules/theme-module.mdc`](.cursor/rules/theme-module.mdc).

---

## 9. Arquitectura objetivo en Alibaba Cloud

El prototipo se articula hacia una arquitectura institucional sobre Alibaba Cloud.

### 9.1 Arquitectura de referencia (producción)

```mermaid
flowchart TB
  U["Usuarios UNGRD / SNGRD"] --> CDN["CDN + WAF + DNS"]
  CDN --> WEB["Next.js<br/>SAE o ACK Serverless"]
  WEB --> GW["API Gateway"]
  GW --> BFF["BFF Node/TypeScript<br/>Function Compute / SAE"]

  BFF --> RDS["ApsaraDB RDS<br/>PostgreSQL / PolarDB"]
  BFF --> TAIR["Tair Redis<br/>sesiones · caché"]
  BFF --> OSS["Object Storage Service<br/>Excel · anexos · logos"]
  BFF --> ID["IDaaS / OIDC<br/>SSO institucional"]

  BFF --> SLS["SLS · logs"]
  WEB --> ARMS["ARMS · APM/RUM"]
  BFF --> MON["CloudMonitor · alertas"]

  subgraph Red["VPC privada"]
    RDS
    TAIR
    BFF
  end
```

### 9.2 Mapeo capa → servicio

```mermaid
flowchart LR
  subgraph Hoy["Hoy · prototipo"]
    H1["Next local / Vercel"]
    H2["Lógica en cliente"]
    H3["Memoria browser"]
    H4["localStorage"]
    H5["xlsx en browser"]
    H6["Login demo"]
  end

  subgraph Meta["Alibaba Cloud"]
    M1["SAE / ACK / FC"]
    M2["API Gateway + BFF"]
    M3["RDS PostgreSQL"]
    M4["Tair Redis"]
    M5["OSS + STS"]
    M6["IDaaS OIDC"]
  end

  H1 --> M1
  H2 --> M2
  H3 --> M3
  H4 --> M4
  H5 --> M5
  H6 --> M6
```

| Capa | Hoy (demo) | Alibaba Cloud |
|---|---|---|
| Frontend / App | Next.js en Vercel / local | **SAE**, **ACK Serverless** o **FC** + CDN |
| API / BFF | No existe | **API Gateway** + FC/SAE |
| Base de datos | Memoria del navegador | **ApsaraDB RDS PostgreSQL** / PolarDB |
| Caché / sesiones | `localStorage` | **Tair (Redis)** |
| Archivos | Parse Excel en cliente | **OSS** + credenciales STS |
| Identidad | Login demo | **IDaaS** / OIDC-SAML institucional |
| Borde | N/A | **CDN** + **WAF** + Anti-DDoS |
| Observabilidad | Consola browser | **SLS** + **ARMS** + CloudMonitor |
| CI/CD | GitHub → Vercel | Yunxiao/Flow o GH Actions → **ACR** → SAE/ACK |
| Analítica pesada | Agregación en cliente | **Hologres** / AnalyticDB / MaxCompute |

### 9.3 Flujo de carga masiva en producción

```mermaid
sequenceDiagram
  participant U as Usuario
  participant WEB as Next.js SAE
  participant API as API Gateway / BFF
  participant OSS as OSS
  participant FC as Function Compute
  participant DB as RDS PostgreSQL

  U->>WEB: Sube Excel
  WEB->>API: Solicita URL firmada STS
  API->>OSS: Genera putObject URL
  WEB->>OSS: Upload directo
  WEB->>API: Confirma uploadId
  API->>FC: Job de validación
  FC->>OSS: Lee archivo
  FC->>DB: Inserta records + errores
  FC-->>API: Estado processado
  API-->>WEB: Resumen OK / fallidos
  WEB-->>U: Feedback + refresco analítica
```

---

## 10. Modelo de datos propuesto

```mermaid
erDiagram
  THEMES ||--o{ RECORDS : contiene
  USERS ||--o{ RECORDS : crea
  USERS ||--o{ UPLOADS : sube
  THEMES ||--o{ UPLOADS : afecta
  USERS ||--o{ AUDIT_LOG : genera

  THEMES {
    string id PK
    string name
    jsonb field_schema
  }
  RECORDS {
    uuid id PK
    string theme_id FK
    string departamento
    string municipio
    date fecha
    string estado
    numeric valor
    jsonb payload
    string source
    uuid created_by FK
    timestamp created_at
  }
  UPLOADS {
    uuid id PK
    string theme_id FK
    string oss_key
    string status
    jsonb errors
  }
  USERS {
    uuid id PK
    string email
    string role
  }
  AUDIT_LOG {
    uuid id PK
    uuid user_id FK
    string action
    jsonb before
    jsonb after
    timestamp at
  }
```

Índices recomendados: `(theme_id, fecha)`, `(theme_id, departamento)`, `(theme_id, estado)`.

---

## 11. Seguridad y operación

```mermaid
flowchart TB
  subgraph Perímetro
    WAF["WAF"]
    CDN["CDN TLS"]
  end

  subgraph App
    WEB["Next.js"]
    API["BFF"]
  end

  subgraph Datos
    RDS["RDS cifrado + backups"]
    OSS["OSS KMS + versionado"]
    TAIR["Tair privado"]
  end

  subgraph Identidad
    SSO["IDaaS / OIDC"]
    RBAC["Roles: captura · analista · admin · auditor"]
  end

  U["Usuario"] --> WAF --> CDN --> WEB
  WEB --> SSO
  WEB --> API
  API --> RBAC
  API --> RDS & OSS & TAIR
```

- Tránsito: TLS extremo a extremo.
- Reposo: cifrado RDS/OSS con KMS.
- Red: VPC, Security Groups, endpoints privados a RDS/Tair.
- Auditoría: SLS con retención según política UNGRD.
- Región: validar latencia y **residencia de datos** (Colombia / soberanía).

---

## 12. Roadmap

```mermaid
gantt
  title Roadmap de articulación Alibaba Cloud
  dateFormat  YYYY-MM
  section Empaque
  Dockerfile + ACR           :a1, 2026-08, 1M
  section Hosting
  SAE/ACK + CDN + dominio    :a2, after a1, 1M
  section Persistencia
  RDS + API BFF captura      :a3, after a2, 2M
  section Archivos
  OSS + jobs FC Excel        :a4, after a3, 1M
  section Identidad
  IDaaS / SSO + RBAC         :a5, after a4, 1M
  section Escala
  Agregados Hologres/ADB     :a6, after a5, 2M
```

1. **Fase 0 — Empaque:** imagen Docker multi-stage → ACR.  
2. **Fase 1 — Hosting:** SAE/ACK Serverless + CDN + certificado.  
3. **Fase 2 — Persistencia:** RDS + BFF; sacar lógica del cliente.  
4. **Fase 3 — Archivos:** OSS + STS + validación async (FC).  
5. **Fase 4 — Identidad:** OIDC/SSO + roles + auditoría.  
6. **Fase 5 — Escala analítica:** materializados / Hologres.

---

## 13. Desarrollo local

### Requisitos

- Node.js **≥ 20 LTS**
- npm 10+

### Comandos

```bash
git clone https://github.com/PhDRedondo/ungrd-temas-operativos.git
cd ungrd-temas-operativos
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción + typecheck |
| `npm run start` | Sirve el build (`next start`) |
| `npm run lint` | ESLint |

### Login demo

Cualquier correo válido + contraseña de **≥ 4 caracteres**. Ejemplo precargado: `analista@ungrd.gov.co` / `ungrd2026`.

### Trabajar un solo tema en local

```bash
npm run dev
# Abrir http://localhost:3000/app/temas/<slug>
# Editar src/themes/<slug>/theme.ts y recargar
```

Ver sección [8. Estructura del repositorio y flujo GitHub](#8-estructura-del-repositorio-y-flujo-github).

---

## 14. Despliegue

### 14.1 Vercel (demo actual)

Proyecto: `phdredondo-projects/ungrd-manejo`  
Producción: https://ungrd-manejo-phi.vercel.app

```bash
npm run build
vercel --prod
```

GitHub (`main`) puede disparar deploys automáticos si el proyecto está vinculado.

### 14.2 Contenedor (propuesto ACR → SAE/ACK)

```dockerfile
# Esquema orientativo
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Health check sugerido: `GET /` (o `/api/health` cuando exista backend).

### 14.3 Diagrama CI/CD objetivo

```mermaid
flowchart LR
  DEV["Developer"] --> GH["GitHub main"]
  GH --> CI["GH Actions / Yunxiao"]
  CI --> ACR["Container Registry"]
  ACR --> SAE["SAE / ACK deploy"]
  SAE --> CDN["CDN producción"]
```

---

## 15. Limitaciones del prototipo

- Sin API backend ni persistencia real (los datos se pierden al recargar, salvo lo añadido en la sesión del navegador).
- Autenticación demo sin tokens, MFA ni roles.
- Excel se procesa enteramente en el cliente.
- Mapa por **centroides** (no GeoJSON oficial DANE/IGAC).
- Observabilidad limitada a lo que Vercel/browser proveen.
- Marca de agua de prototipo: no constituye sistema oficial UNGRD en producción.

---

## Créditos y contacto

- **Producto / arquitectura de referencia:** articulación UNGRD × Alibaba Cloud (ver `/app/acerca`).
- **Autor del repositorio:** [PhDRedondo](https://github.com/PhDRedondo) · `phdredondo@gmail.com`
- **Branding:** logos SNGRD/UNGRD en `public/branding/`.

---

© Prototipo de demostración · SNGRD / UNGRD · No sustituye sistemas oficiales en producción.
