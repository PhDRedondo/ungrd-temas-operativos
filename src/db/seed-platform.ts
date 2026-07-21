/**
 * Seed plataforma: dependencias IAM + workflow piloto carrotanque.
 * Uso: npm run db:platform-seed
 * Requiere: drizzle/migrations/0001_platform_schemas.sql aplicada.
 */
import "dotenv/config";
import { db } from "./index";
import {
  dependencies,
  permissions,
  workflowDefinitions,
  workflowVersions,
  userDependencies,
  type WorkflowConfigJson,
} from "./platform-schema";
import { users } from "./schema";
import { eq } from "drizzle-orm";

const DEPS = [
  { id: "dep-logistica", code: "LOGISTICA", name: "Logística" },
  { id: "dep-tecnica", code: "TECNICA", name: "Técnica" },
  { id: "dep-juridica", code: "JURIDICA", name: "Jurídica" },
  { id: "dep-direccion", code: "DIRECCION", name: "Dirección" },
  { id: "dep-planeacion", code: "PLANEACION", name: "Planeación" },
];

const PERMS = [
  { id: "p-case-create", code: "case.create", description: "Crear caso" },
  { id: "p-case-submit", code: "case.submit", description: "Enviar caso" },
  { id: "p-task-approve", code: "task.approve", description: "Aprobar tarea" },
  { id: "p-task-return", code: "task.return", description: "Devolver con hallazgos" },
  { id: "p-case-publish", code: "case.publish", description: "Publicar a core" },
];

const PILOT_WORKFLOW: WorkflowConfigJson = {
  initialStatus: "DRAFT",
  caseStatuses: [
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "RETURNED",
    "CORRECTION_IN_PROGRESS",
    "RESUBMITTED",
    "STEP_APPROVED",
    "REJECTED",
    "FINAL_APPROVED",
    "PUBLISHING",
    "PUBLISHED",
    "CLOSED",
  ],
  steps: [
    {
      code: "CAPTURE",
      name: "Captura logística",
      type: "capture",
      mode: "serial",
      assigneeDependencyCode: "LOGISTICA",
      assigneeRole: "captura",
    },
    {
      code: "TECH_REVIEW",
      name: "Revisión técnica",
      type: "review",
      mode: "parallel",
      parallelGroup: "REVIEW",
      assigneeDependencyCode: "TECNICA",
      assigneeRole: "analista",
    },
    {
      code: "LEGAL_REVIEW",
      name: "Revisión jurídica",
      type: "review",
      mode: "parallel",
      parallelGroup: "REVIEW",
      assigneeDependencyCode: "JURIDICA",
      assigneeRole: "analista",
    },
    {
      code: "DIR_APPROVAL",
      name: "Aprobación dirección",
      type: "approval",
      mode: "serial",
      assigneeDependencyCode: "DIRECCION",
      assigneeRole: "admin",
    },
    {
      code: "PUBLISH",
      name: "Publicación",
      type: "publish",
      mode: "serial",
    },
  ],
  transitions: [
    { from: "DRAFT", action: "submit", to: "UNDER_REVIEW", roles: ["captura"] },
    { from: "RETURNED", action: "resubmit", to: "UNDER_REVIEW", roles: ["captura"] },
    { from: "UNDER_REVIEW", action: "approve", to: "STEP_APPROVED" },
    { from: "UNDER_REVIEW", action: "return", to: "RETURNED" },
    { from: "UNDER_REVIEW", action: "reject", to: "REJECTED" },
    { from: "STEP_APPROVED", action: "approve_final", to: "PUBLISHED", roles: ["admin"] },
  ],
};

async function main() {
  console.log("Seed plataforma IAM + workflow piloto…");

  for (const d of DEPS) {
    await db
      .insert(dependencies)
      .values(d)
      .onConflictDoNothing({ target: dependencies.id });
  }

  for (const p of PERMS) {
    await db
      .insert(permissions)
      .values(p)
      .onConflictDoNothing({ target: permissions.id });
  }

  await db
    .insert(workflowDefinitions)
    .values({
      id: "wf-asset-carrotanque",
      code: "WF_ASSET_CARROTANQUE",
      name: "Registro de activo — Carrotanque",
      caseType: "ASSET_REGISTRATION",
      moduleId: "carrotanques",
      active: true,
    })
    .onConflictDoNothing({ target: workflowDefinitions.id });

  await db
    .insert(workflowVersions)
    .values({
      id: "wf-asset-carrotanque-v1",
      definitionId: "wf-asset-carrotanque",
      version: 1,
      status: "active",
      config: PILOT_WORKFLOW,
    })
    .onConflictDoNothing({ target: workflowVersions.id });

  console.log("✓ Dependencias:", DEPS.length);
  console.log("✓ Workflow piloto: WF_ASSET_CARROTANQUE v1");

  const USER_DEPS: Array<{ email: string; dependencyId: string }> = [
    { email: "captura@ungrd.gov.co", dependencyId: "dep-logistica" },
    { email: "harness@ungrd.gov.co", dependencyId: "dep-logistica" },
    { email: "analista@ungrd.gov.co", dependencyId: "dep-tecnica" },
    { email: "admin@ungrd.gov.co", dependencyId: "dep-direccion" },
  ];

  for (const ud of USER_DEPS) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, ud.email))
      .limit(1);
    if (!user) continue;
    await db
      .insert(userDependencies)
      .values({
        userId: user.id,
        dependencyId: ud.dependencyId,
        isPrimary: true,
      })
      .onConflictDoNothing();
  }
  console.log("✓ user_dependencies asignadas (si existen usuarios demo)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
