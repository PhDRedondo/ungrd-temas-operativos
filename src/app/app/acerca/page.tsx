"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { THEMES } from "@/lib/themes";

const STACK = [
  ["Framework", "Next.js 16.2 (App Router) + React 19 + TypeScript 5"],
  ["UI / estilos", "Tailwind CSS 4 · Nunito Sans · Lucide React"],
  ["Mapas", "Leaflet 1.9 + react-leaflet 5 · OpenStreetMap tiles"],
  ["Gráficos", "Recharts 3 · d3-sankey / d3-shape (Sankey)"],
  ["Excel", "SheetJS (xlsx) — plantillas y carga masiva"],
  ["UX guiada", "driver.js (visita guiada)"],
  ["Estado UI", "React Context (auth + tema claro/oscuro)"],
  ["Build / runtime", "Node.js · Turbopack · npm"],
];

const MODULES = [
  [
    "Inicio (/)",
    "Landing institucional con branding SNGRD/UNGRD y selector de tema.",
  ],
  [
    "Login (/login)",
    "Autenticación demo en cliente (localStorage). Objetivo prod: IdP / OIDC.",
  ],
  [
    "Shell (/app)",
    "Sidebar plegable (iconos), visita guiada, tema claro/oscuro, 19 temas + plantilla.",
  ],
  [
    "Captura",
    "Formulario individual + carga masiva Excel por tema; registros en memoria de sesión.",
  ],
  [
    "Analítica descriptiva",
    "Filtros cruzados entre mapa, torta, barras, serie, Sankey y heatmap.",
  ],
  [
    "Análisis avanzado",
    "Red compleja multipartite (depto–muni–estado–categoría) con métricas de grado, intermediación, clustering y topología.",
  ],
];

const CURRENT_LIMITS = [
  "Sin API backend ni base de datos persistente (datos sintéticos / en cliente).",
  "Auth demo sin tokens, roles ni MFA.",
  "Sin almacenamiento de archivos en objeto (Excel se procesa en el navegador).",
  "Mapa por centroides departamentales/municipales (no GeoJSON oficial).",
  "Sin CI/CD, observabilidad ni entornos (dev/test/prod) formalizados.",
];

const ALIBABA = [
  {
    capa: "Frontend / App",
    hoy: "Next.js SPA/SSR local (npm run dev / next start)",
    alibaba:
      "Function Compute (FC) + CDN, o Serverless App Engine (SAE), o Contenedor en ACK / ACK Serverless (Knative)",
  },
  {
    capa: "API / BFF",
    hoy: "No existe (lógica 100 % en cliente)",
    alibaba:
      "API Gateway + FC / MSE (Microservices Engine) / aplicación Node en SAE o ACK",
  },
  {
    capa: "Base de datos",
    hoy: "Memoria del navegador + generador demo",
    alibaba:
      "ApsaraDB RDS for PostgreSQL (recomendado) o PolarDB; partición por tema/vigencia",
  },
  {
    capa: "Caché / sesiones",
    hoy: "localStorage (auth + tema + sidebar)",
    alibaba: "Tair (Redis) para sesiones, rate-limit y caché de agregados analíticos",
  },
  {
    capa: "Object Storage",
    hoy: "Excel parseado en browser",
    alibaba:
      "OSS — plantillas, cargas masivas, anexos, logos; firmas STS temporales",
  },
  {
    capa: "Identidad",
    hoy: "Login demo (correo + password local)",
    alibaba:
      "IDaaS / SAML-OIDC institucional, o RAM + OIDC custom; integración SSO UNGRD",
  },
  {
    capa: "CDN / WAF",
    hoy: "N/A",
    alibaba: "Alibaba Cloud CDN + WAF + Anti-DDoS para borde público",
  },
  {
    capa: "Observabilidad",
    hoy: "Consola browser / logs Next",
    alibaba: "SLS (logs) + ARMS (APM/RUM) + CloudMonitor + Alertas DingTalk/correo",
  },
  {
    capa: "Secretos / config",
    hoy: "Hardcoded / env local",
    alibaba: "KMS + Secrets Manager / Parameter Store equivalente via OPS",
  },
  {
    capa: "CI/CD",
    hoy: "Build manual (npm run build)",
    alibaba:
      "Flow / Yunxiao o GitHub Actions → ACR (registry) → deploy SAE/ACK",
  },
  {
    capa: "Datos geo",
    hoy: "Centroides en TS + tiles OSM",
    alibaba:
      "OSS/ GeoJSON; opcional AMap/Location Service o tiles propios vía CDN",
  },
  {
    capa: "Analítica pesada",
    hoy: "Agregaciones en cliente (Recharts/d3)",
    alibaba:
      "MaxCompute / Hologres / AnalyticDB para cuadros consolidados; API de agregados",
  },
];

const TARGET_ARCH = [
  "Usuario → CDN/WAF → dominio institucional",
  "Next.js (SSR/ISR) en SAE o ACK Serverless",
  "API Gateway → microservicios BFF (Node/TS) en FC/SAE",
  "RDS PostgreSQL (transaccional) + Tair (caché)",
  "OSS (plantillas Excel, cargas, evidencias)",
  "IDaaS/OIDC (SSO) → roles: captura, analista, admin",
  "SLS + ARMS para auditoría y desempeño",
  "VPC privada, Security Groups, NAS opcional para jobs",
];

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-ungrd-heading">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-6">
        <div className="flex flex-wrap items-center gap-4">
          <BrandLogo
            width={140}
            height={168}
            className="h-24 w-auto object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-ungrd-heading">
              Acerca de · Ficha técnica
            </h1>
            <p className="mt-1 text-sm text-ungrd-muted">
              Plataforma de Temas Operativos UNGRD / SNGRD — documento para
              articular despliegue e integración con{" "}
              <strong className="text-ungrd-heading">Alibaba Cloud</strong>
            </p>
          </div>
          <div className="rounded-xl border border-ungrd-border bg-ungrd-bg px-4 py-3 text-sm">
            <p className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
              Versión
            </p>
            <p className="font-extrabold text-ungrd-heading">0.1.0 · prototipo</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-ungrd-text">
          Aplicación web para captura y analítica de {THEMES.length} temas
          misionales de la UNGRD. El prototipo actual corre 100 % en cliente
          (Next.js). Esta ficha describe el stack real, los límites del demo y
          el mapeo de componentes a servicios Alibaba Cloud para una futura
          puesta en producción institucional.
        </p>
      </div>

      <Section title="1. Propósito y alcance funcional">
        <ul className="list-disc space-y-2 pl-5 text-sm text-ungrd-text">
          <li>
            Captura individual (formularios tipados por tema) y masiva (Excel).
          </li>
          <li>
            Analítica descriptiva con filtros cruzados: mapa dept/muni, KPI,
            torta, barras, serie temporal, Sankey y heatmap.
          </li>
          <li>
            Análisis avanzado: modelo de redes complejas y métricas (grado,
            intermediación, clustering, componente gigante, diámetro).
          </li>
          <li>
            Shell institucional: branding dual (claro/oscuro), sidebar
            plegable, visita guiada y módulo Acerca de.
          </li>
          <li>
            Idioma de interfaz: español. Zona geográfica: Colombia
            (departamentos/municipios de referencia).
          </li>
        </ul>
      </Section>

      <Section title="2. Arquitectura actual (prototipo)">
        <pre className="overflow-x-auto rounded-xl border border-ungrd-border bg-ungrd-bg p-4 text-xs leading-relaxed text-ungrd-text">
{`Navegador
 ├─ Next.js App Router (SSR/estático)
 ├─ AuthProvider (localStorage)
 ├─ ThemeProvider (claro/oscuro)
 ├─ Datos demo (generador JS en memoria)
 ├─ Captura: formularios + xlsx en cliente
 └─ Analítica: agregaciones en cliente
        → Recharts / d3-sankey / Leaflet

Sin backend · Sin BD · Sin object storage · Sin IdP`}
        </pre>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {MODULES.map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-ungrd-border bg-ungrd-bg px-4 py-3"
            >
              <dt className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
                {k}
              </dt>
              <dd className="mt-1 text-sm text-ungrd-text">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="3. Stack tecnológico (implementado)">
        <div className="overflow-x-auto rounded-xl border border-ungrd-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ungrd-bg text-xs tracking-wide text-ungrd-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">Componente</th>
                <th className="px-4 py-3 font-bold">Tecnología</th>
              </tr>
            </thead>
            <tbody>
              {STACK.map(([k, v]) => (
                <tr key={k} className="border-t border-ungrd-border">
                  <td className="px-4 py-2.5 font-semibold text-ungrd-heading">
                    {k}
                  </td>
                  <td className="px-4 py-2.5 text-ungrd-text">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ungrd-muted">
          Rutas principales: <code>/</code>, <code>/login</code>,{" "}
          <code>/app</code>, <code>/app/acerca</code>,{" "}
          <code>/app/temas/[slug]</code> ({THEMES.length} páginas SSG).
        </p>
      </Section>

      <Section title="4. Temas operativos (dominio)">
        <p className="mb-3 text-sm text-ungrd-muted">
          Cada tema define campos de formulario, unidad de valor y datasets
          demo. IDs usados en routing:
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-ungrd-border bg-ungrd-bg px-3 py-2 text-sm"
            >
              <p className="font-bold text-ungrd-heading">{t.name}</p>
              <p className="font-mono text-[11px] text-ungrd-muted">{t.id}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="5. Modelo de datos (propuesto para producción)">
        <pre className="overflow-x-auto rounded-xl border border-ungrd-border bg-ungrd-bg p-4 text-xs leading-relaxed text-ungrd-text">
{`themes (catálogo)
records (
  id, theme_id, departamento, municipio,
  fecha, estado, payload JSONB, valor NUMERIC,
  created_by, created_at, source: form|excel|api
)
uploads (id, theme_id, oss_key, status, errors JSONB)
users / roles (captura | analista | admin | auditor)
audit_log (quién, qué, cuándo, before/after)`}
        </pre>
        <p className="mt-3 text-sm text-ungrd-text">
          Recomendación Alibaba: <strong>ApsaraDB RDS PostgreSQL</strong> con
          JSONB para campos variables por tema; índices por{" "}
          <code>theme_id</code>, <code>departamento</code>, <code>fecha</code>,{" "}
          <code>estado</code>. Agregados analíticos vía vistas materializadas o{" "}
          <strong>Hologres / AnalyticDB</strong> si el volumen crece.
        </p>
      </Section>

      <Section title="6. Mapeo a Alibaba Cloud">
        <p className="mb-3 text-sm text-ungrd-muted">
          Tabla de articulación: estado actual del prototipo → servicio Alibaba
          Cloud candidato.
        </p>
        <div className="overflow-x-auto rounded-xl border border-ungrd-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ungrd-bg text-xs tracking-wide text-ungrd-muted uppercase">
              <tr>
                <th className="px-3 py-3 font-bold">Capa</th>
                <th className="px-3 py-3 font-bold">Hoy (demo)</th>
                <th className="px-3 py-3 font-bold">Alibaba Cloud</th>
              </tr>
            </thead>
            <tbody>
              {ALIBABA.map((row) => (
                <tr key={row.capa} className="border-t border-ungrd-border align-top">
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-ungrd-heading">
                    {row.capa}
                  </td>
                  <td className="px-3 py-2.5 text-ungrd-muted">{row.hoy}</td>
                  <td className="px-3 py-2.5 text-ungrd-text">{row.alibaba}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="7. Arquitectura objetivo en Alibaba Cloud">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ungrd-text">
          {TARGET_ARCH.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-ungrd-border bg-ungrd-bg p-4 text-xs leading-relaxed text-ungrd-text">
{`[Usuarios UNGRD]
        │
   CDN + WAF + DNS
        │
   Next.js (SAE / ACK Serverless)
        │
   API Gateway ─── BFF Node/TS (FC o SAE)
        │
   ┌────┼────────────┐
  RDS  Tair         OSS
 (PG) (Redis)   (Excel/anexos)
        │
   SLS + ARMS + CloudMonitor
        │
   IDaaS / OIDC (SSO institucional)`}
        </pre>
      </Section>

      <Section title="8. Seguridad, cumplimiento y operación">
        <ul className="list-disc space-y-2 pl-5 text-sm text-ungrd-text">
          <li>
            <strong>Identidad:</strong> SSO institucional (OIDC/SAML) + RBAC por
            tema (lectura / escritura / aprobación).
          </li>
          <li>
            <strong>Red:</strong> VPC, Security Groups, endpoints privados a RDS
            y Tair; front público solo vía WAF/CDN.
          </li>
          <li>
            <strong>Datos:</strong> cifrado en tránsito (TLS) y en reposo (RDS /
            OSS KMS); backups RDS + versionado OSS.
          </li>
          <li>
            <strong>Auditoría:</strong> bitácora de captura/edición en SLS;
            retención alineada a política UNGRD.
          </li>
          <li>
            <strong>Región:</strong> elegir región Alibaba cercana a usuarios
            (p. ej. US/Singapore/Frankfurt según latencia y residencia de
            datos); validar requisitos de soberanía de datos Colombia.
          </li>
          <li>
            <strong>SLAs:</strong> multi-AZ para RDS; health checks SAE/ACK;
            rollback por imagen ACR.
          </li>
        </ul>
      </Section>

      <Section title="9. Roadmap de articulación (sugerido)">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ungrd-text">
          <li>
            <strong>Fase 0 — Empaque:</strong> Dockerfile multi-stage Next.js +
            imagen en <em>Container Registry (ACR)</em>.
          </li>
          <li>
            <strong>Fase 1 — Hosting:</strong> desplegar UI en SAE o ACK
            Serverless; dominio + CDN + certificado.
          </li>
          <li>
            <strong>Fase 2 — Persistencia:</strong> RDS PostgreSQL + API BFF;
            migrar captura/analítica fuera del cliente.
          </li>
          <li>
            <strong>Fase 3 — Archivos:</strong> OSS + STS para plantillas y
            cargas Excel; validación asíncrona (FC).
          </li>
          <li>
            <strong>Fase 4 — Identidad:</strong> IDaaS/OIDC; roles y auditoría.
          </li>
          <li>
            <strong>Fase 5 — Escala analítica:</strong> materializar agregados;
            opcional Hologres/MaxCompute; dashboards P99 bajo carga.
          </li>
        </ol>
      </Section>

      <Section title="10. Limitaciones del prototipo actual">
        <ul className="list-disc space-y-2 pl-5 text-sm text-ungrd-text">
          {CURRENT_LIMITS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title="11. Comandos y empaquetado">
        <pre className="overflow-x-auto rounded-xl border border-ungrd-border bg-ungrd-bg p-4 text-xs leading-relaxed text-ungrd-text">
{`# Desarrollo
cd ungrd-app && npm install && npm run dev   # http://localhost:3000

# Producción local
npm run build && npm run start

# Contenedor (propuesto para ACR → SAE/ACK)
# Dockerfile: node:20-alpine → next build → next start -p 3000
# ENV: NODE_ENV=production PORT=3000
# Health: GET /  o  /api/health (a implementar)`}
        </pre>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Paquete", "ungrd-app@0.1.0"],
            ["Runtime Node", "≥ 20 LTS (recomendado)"],
            ["Puerto", "3000"],
            ["Licencia UI", "Prototipo institucional"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-ungrd-border bg-ungrd-bg px-4 py-3"
            >
              <dt className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
                {k}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ungrd-heading">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className="text-center text-xs text-ungrd-muted">
        Documento técnico generado desde el módulo Acerca de · Útil como anexo
        para arquitectura de referencia Alibaba Cloud · UNGRD / SNGRD
      </p>
    </div>
  );
}
