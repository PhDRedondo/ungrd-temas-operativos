# UNGRD — Temas Operativos

Plataforma institucional para **captura**, **carga masiva Excel** y **analítica geoespacial** de temas misionales de la [UNGRD](https://portal.gestiondelriesgo.gov.co/) / SNGRD.

| | |
|---|---|
| **Versión** | `0.1.0` · MVP local operable |
| **Stack** | Next.js 16 · PostgreSQL · Drizzle · Auth.js · Keycloak (opcional) |
| **Mapa del repo** | [`STRUCTURE.md`](./STRUCTURE.md) ← si la raíz se ve llena |

---

## Empieza aquí

| # | Archivo | Contenido |
|---|---------|-----------|
| 1 | [`STRUCTURE.md`](./STRUCTURE.md) | Qué es cada carpeta/archivo en Finder |
| 2 | [`REQUIREMENTS.md`](./REQUIREMENTS.md) | Requisitos |
| 3 | [`MEMORY.md`](./MEMORY.md) | Antes → ahora |
| 4 | [`docs/`](./docs/) | Arquitectura, API, seguridad, local |

---

## Arranque rápido

```bash
cp .env.example .env.local
npm install
npm run db:setup
npm run dev                  # http://localhost:3000
```

Verificación:

```bash
npm run harness              # env + back + front + security
npm run smoke                # Excel E2E
```

Detalle: [`docs/LOCAL.md`](docs/LOCAL.md)

---

## Estructura (vista limpia)

```text
ungrd-temas-operativos/
├── README.md STRUCTURE.md REQUIREMENTS.md MEMORY.md
├── CONTRIBUTING.md AGENTS.md Makefile
├── docs/                 ← documentación técnica
├── scripts/              ← arnés + smoke
├── src/                  ← código (app, api, temas, security)
├── data/  public/  infra/
├── docker-compose.yml
└── package.json + configs Next/TS/ESLint (deben estar en raíz)
```

Las configs (`next.config.ts`, `tsconfig.json`, etc.) **no se pueden meter en una subcarpeta**: las herramientas las exigen en la raíz. Por eso el Finder se ve “lleno”; el orden de lectura es el de la tabla de arriba.

---

## Scripts npm

| Script | Uso |
|--------|-----|
| `dev` / `build` / `start` | App |
| `lint` / `typecheck` | Calidad |
| `db:setup` | Schema + seed |
| `harness` / `harness:security` | Arnés |
| `smoke` | E2E Excel |
| `stack:up` | Docker Postgres + Keycloak |

---

## Roles

| Rol | Capacidades |
|-----|-------------|
| `captura` | Leer + escribir + Excel |
| `analista` | Solo lectura |
| `admin` | Todo + ACL + seguridad |
| `auditor` | Lectura global |

---

## Contribución

[`CONTRIBUTING.md`](./CONTRIBUTING.md) · temas en `src/themes/<slug>/`.
