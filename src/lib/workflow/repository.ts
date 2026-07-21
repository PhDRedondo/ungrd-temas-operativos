import { eq, and, sql, desc, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  cases,
  caseVersions,
  workflowInstances,
  workflowTasks,
  reviewFindings,
  eventOutbox,
  auditEvents,
  workflowDefinitions,
  workflowVersions,
  dependencies,
  userDependencies,
  type WorkflowConfigJson,
} from "@/db/platform-schema";
import {
  assetCodeFromPayload,
  canTransition,
  hashPayload,
  nextCaseCode,
  resolveActiveSteps,
} from "./types";
import { publishCarrotanqueCase } from "@/lib/publication/carrotanque";

export type CreateCaseInput = {
  caseType: string;
  moduleId?: string;
  title: string;
  payload?: Record<string, unknown>;
  userId: string;
  dependencyId?: string;
  role: string;
};

async function writeAudit(params: {
  userId: string;
  dependencyId?: string | null;
  role: string;
  action: string;
  caseId?: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  await db.insert(auditEvents).values({
    userId: params.userId,
    dependencyId: params.dependencyId ?? null,
    role: params.role,
    action: params.action,
    caseId: params.caseId as never,
    entityType: params.entityType,
    entityId: params.entityId,
    beforeData: params.before as never,
    afterData: params.after as never,
    reason: params.reason,
    outcome: "SUCCESS",
  });
}

async function emitEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
) {
  await db.insert(eventOutbox).values({
    eventType,
    aggregateType,
    aggregateId,
    payload,
    status: "PENDING",
  });
}

export async function getWorkflowConfig(
  definitionCode: string,
): Promise<{ definitionId: string; version: number; config: WorkflowConfigJson } | null> {
  const [def] = await db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.code, definitionCode))
    .limit(1);
  if (!def) return null;
  const [ver] = await db
    .select()
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.definitionId, def.id),
        eq(workflowVersions.status, "active"),
      ),
    )
    .orderBy(desc(workflowVersions.version))
    .limit(1);
  if (!ver) return null;
  return {
    definitionId: def.id,
    version: ver.version,
    config: ver.config as WorkflowConfigJson,
  };
}

export async function listCasesForUser(userId: string, role: string) {
  if (role === "admin" || role === "auditor") {
    return db.select().from(cases).orderBy(desc(cases.updatedAt)).limit(100);
  }
  const deps = await db
    .select()
    .from(userDependencies)
    .where(eq(userDependencies.userId, userId));
  const depIds = deps.map((d) => d.dependencyId);
  if (!depIds.length) {
    return db
      .select()
      .from(cases)
      .where(eq(cases.createdBy, userId))
      .orderBy(desc(cases.updatedAt));
  }
  return db
    .select()
    .from(cases)
    .where(
      or(eq(cases.createdBy, userId), inArray(cases.originDependencyId, depIds)),
    )
    .orderBy(desc(cases.updatedAt))
    .limit(100);
}

export async function getCaseById(caseId: string) {
  const [row] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  return row ?? null;
}

export async function getCaseVersions(caseId: string) {
  return db
    .select()
    .from(caseVersions)
    .where(eq(caseVersions.caseId, caseId))
    .orderBy(caseVersions.versionNumber);
}

export async function createCase(input: CreateCaseInput) {
  const wf =
    input.caseType === "ASSET_REGISTRATION"
      ? await getWorkflowConfig("WF_ASSET_CARROTANQUE")
      : null;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases);
  const caseCode = nextCaseCode((count ?? 0) + 1);
  const payload = input.payload ?? {};

  const [created] = await db
    .insert(cases)
    .values({
      caseCode,
      caseType: input.caseType,
      moduleId: input.moduleId ?? null,
      title: input.title,
      status: "DRAFT",
      originDependencyId: input.dependencyId ?? null,
      createdBy: input.userId,
      metadata: { workflowCode: wf ? "WF_ASSET_CARROTANQUE" : null },
    })
    .returning();

  await db.insert(caseVersions).values({
    caseId: created!.id,
    versionNumber: 1,
    status: "DRAFT",
    payload,
    contentHash: hashPayload(payload),
    createdBy: input.userId,
    dependencyId: input.dependencyId ?? null,
  });

  await db
    .update(cases)
    .set({ currentVersion: 1, updatedAt: new Date() })
    .where(eq(cases.id, created!.id));

  await writeAudit({
    userId: input.userId,
    dependencyId: input.dependencyId,
    role: input.role,
    action: "case.created",
    caseId: created!.id,
    entityType: "case",
    entityId: created!.id,
    after: created,
  });

  await emitEvent("case.created", "case", created!.id, {
    caseCode,
    caseType: input.caseType,
  });

  return created!;
}

export async function updateCaseDraft(params: {
  caseId: string;
  payload: Record<string, unknown>;
  userId: string;
  role: string;
  dependencyId?: string;
}) {
  const c = await getCaseById(params.caseId);
  if (!c) throw new Error("Caso no encontrado");
  if (!["DRAFT", "RETURNED", "CORRECTION_IN_PROGRESS"].includes(c.status)) {
    throw new Error("El caso no está en estado editable");
  }

  const verNum = c.currentVersion || 1;
  const [ver] = await db
    .select()
    .from(caseVersions)
    .where(
      and(
        eq(caseVersions.caseId, params.caseId),
        eq(caseVersions.versionNumber, verNum),
      ),
    )
    .limit(1);

  if (ver?.status === "FROZEN" || ver?.submittedAt) {
    const newVer = verNum + 1;
    await db.insert(caseVersions).values({
      caseId: params.caseId,
      versionNumber: newVer,
      status: "DRAFT",
      payload: params.payload,
      contentHash: hashPayload(params.payload),
      createdBy: params.userId,
      dependencyId: params.dependencyId ?? null,
      changeReason: "Corrección post-devolución",
    });
    await db
      .update(cases)
      .set({
        currentVersion: newVer,
        status: "CORRECTION_IN_PROGRESS",
        updatedAt: new Date(),
      })
      .where(eq(cases.id, params.caseId));
  } else {
    await db
      .update(caseVersions)
      .set({
        payload: params.payload,
        contentHash: hashPayload(params.payload),
      })
      .where(eq(caseVersions.id, ver!.id));
    await db
      .update(cases)
      .set({ updatedAt: new Date() })
      .where(eq(cases.id, params.caseId));
  }

  await writeAudit({
    userId: params.userId,
    role: params.role,
    action: "case.draft_updated",
    caseId: params.caseId,
    after: { payload: params.payload },
  });

  return getCaseById(params.caseId);
}

async function spawnReviewTasks(params: {
  caseId: string;
  instanceId: string;
  config: WorkflowConfigJson;
  caseStatus: string;
}) {
  const steps = resolveActiveSteps(params.config, params.caseStatus);
  const parallel = steps.filter((s) => s.mode === "parallel");
  const serial = steps.filter((s) => s.mode === "serial");

  const toCreate = parallel.length ? parallel : serial;

  for (const step of toCreate) {
    let depId: string | null = null;
    if (step.assigneeDependencyCode) {
      const [dep] = await db
        .select()
        .from(dependencies)
        .where(eq(dependencies.code, step.assigneeDependencyCode))
        .limit(1);
      depId = dep?.id ?? null;
    }

    await db.insert(workflowTasks).values({
      instanceId: params.instanceId,
      caseId: params.caseId,
      stepCode: step.code,
      taskType: step.type,
      title: `${step.name} — revisión`,
      status: "PENDING",
      assigneeRole: step.assigneeRole ?? null,
      assigneeDependencyId: depId,
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
  }

  await db
    .update(workflowInstances)
    .set({
      currentStepIds: toCreate.map((s) => s.code) as never,
    })
    .where(eq(workflowInstances.id, params.instanceId));
}

export async function submitCase(params: {
  caseId: string;
  userId: string;
  role: string;
  dependencyId?: string;
}) {
  const c = await getCaseById(params.caseId);
  if (!c) throw new Error("Caso no encontrado");
  if (!["DRAFT", "CORRECTION_IN_PROGRESS", "RETURNED"].includes(c.status)) {
    throw new Error("Estado no permite envío");
  }

  const wf = await getWorkflowConfig("WF_ASSET_CARROTANQUE");
  if (!wf) throw new Error("Workflow no configurado");

  const verNum = c.currentVersion;
  await db
    .update(caseVersions)
    .set({ status: "FROZEN", submittedAt: new Date() })
    .where(
      and(
        eq(caseVersions.caseId, params.caseId),
        eq(caseVersions.versionNumber, verNum),
      ),
    );

  let instanceId = c.workflowInstanceId;
  if (!instanceId) {
    const [inst] = await db
      .insert(workflowInstances)
      .values({
        caseId: params.caseId,
        definitionId: wf.definitionId,
        definitionVersion: wf.version,
        status: "ACTIVE",
      })
      .returning();
    instanceId = inst!.id;
    await db
      .update(cases)
      .set({ workflowInstanceId: instanceId })
      .where(eq(cases.id, params.caseId));
  }

  const newStatus =
    c.status === "CORRECTION_IN_PROGRESS" || c.status === "RETURNED"
      ? "RESUBMITTED"
      : "SUBMITTED";

  await db
    .update(cases)
    .set({
      status: "UNDER_REVIEW",
      submittedAt: c.submittedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cases.id, params.caseId));

  await spawnReviewTasks({
    caseId: params.caseId,
    instanceId: instanceId!,
    config: wf.config,
    caseStatus: "UNDER_REVIEW",
  });

  await writeAudit({
    userId: params.userId,
    role: params.role,
    action: "case.submitted",
    caseId: params.caseId,
    after: { status: "UNDER_REVIEW", version: verNum },
  });

  await emitEvent("case.submitted", "case", params.caseId, {
    version: verNum,
    previousStatus: c.status,
    newStatus,
  });

  return getCaseById(params.caseId);
}

export async function listTasksForUser(params: {
  userId: string;
  role: string;
  dependencyIds?: string[];
}) {
  const conditions = [eq(workflowTasks.status, "PENDING")];

  const roleMatch = eq(workflowTasks.assigneeRole, params.role);
  const userMatch = eq(workflowTasks.assigneeUserId, params.userId);

  if (params.role === "admin") {
    return db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.status, "PENDING"))
      .orderBy(desc(workflowTasks.createdAt))
      .limit(100);
  }

  return db
    .select()
    .from(workflowTasks)
    .where(
      and(
        eq(workflowTasks.status, "PENDING"),
        or(roleMatch, userMatch),
      ),
    )
    .orderBy(desc(workflowTasks.createdAt))
    .limit(100);
}

export async function completeTask(params: {
  taskId: string;
  action: "approve" | "return" | "reject";
  userId: string;
  role: string;
  comment?: string;
  findings?: Array<{
    fieldCode?: string;
    sectionCode?: string;
    severity: string;
    observation: string;
  }>;
}) {
  const [task] = await db
    .select()
    .from(workflowTasks)
    .where(eq(workflowTasks.id, params.taskId))
    .limit(1);
  if (!task) throw new Error("Tarea no encontrada");
  if (task.status !== "PENDING") throw new Error("Tarea ya completada");

  const c = await getCaseById(task.caseId);
  if (!c) throw new Error("Caso no encontrado");

  const wf = await getWorkflowConfig("WF_ASSET_CARROTANQUE");
  if (!wf) throw new Error("Workflow no configurado");

  await db
    .update(workflowTasks)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      claimedAt: new Date(),
      assigneeUserId: params.userId,
      result: { action: params.action, comment: params.comment },
    })
    .where(eq(workflowTasks.id, params.taskId));

  if (params.action === "return" && params.findings?.length) {
    for (const f of params.findings) {
      await db.insert(reviewFindings).values({
        caseId: task.caseId,
        taskId: task.id,
        fieldCode: f.fieldCode,
        sectionCode: f.sectionCode,
        severity: f.severity,
        observation: f.observation,
        status: "OPEN",
        createdBy: params.userId,
        responsibleDependencyId: c.originDependencyId,
      });
    }
    await db
      .update(cases)
      .set({ status: "RETURNED", updatedAt: new Date() })
      .where(eq(cases.id, task.caseId));

    await emitEvent("review.returned", "case", task.caseId, {
      taskId: task.id,
    });
    return { case: await getCaseById(task.caseId), published: false };
  }

  if (params.action === "reject") {
    await db
      .update(cases)
      .set({ status: "REJECTED", updatedAt: new Date() })
      .where(eq(cases.id, task.caseId));
    return { case: await getCaseById(task.caseId), published: false };
  }

  // approve — check pending parallel tasks
  const pending = await db
    .select()
    .from(workflowTasks)
    .where(
      and(
        eq(workflowTasks.caseId, task.caseId),
        eq(workflowTasks.status, "PENDING"),
      ),
    );

  if (pending.length > 0) {
    await db
      .update(cases)
      .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
      .where(eq(cases.id, task.caseId));
    return { case: await getCaseById(task.caseId), published: false };
  }

  // All reviews done — spawn direction approval or publish
  const openCritical = await db
    .select()
    .from(reviewFindings)
    .where(
      and(
        eq(reviewFindings.caseId, task.caseId),
        eq(reviewFindings.status, "OPEN"),
        eq(reviewFindings.severity, "CRITICAL"),
      ),
    );

  if (openCritical.length > 0) {
    throw new Error("Hay hallazgos críticos abiertos");
  }

  if (params.role !== "admin") {
    const [dirDep] = await db
      .select()
      .from(dependencies)
      .where(eq(dependencies.code, "DIRECCION"))
      .limit(1);

    await db.insert(workflowTasks).values({
      instanceId: task.instanceId,
      caseId: task.caseId,
      stepCode: "DIR_APPROVAL",
      taskType: "approval",
      title: "Aprobación dirección",
      status: "PENDING",
      assigneeRole: "admin",
      assigneeDependencyId: dirDep?.id ?? null,
    });

    await db
      .update(cases)
      .set({ status: "STEP_APPROVED", updatedAt: new Date() })
      .where(eq(cases.id, task.caseId));

    return { case: await getCaseById(task.caseId), published: false };
  }

  // Final approval (admin) → publish
  await db
    .update(cases)
    .set({ status: "PUBLISHING", updatedAt: new Date() })
    .where(eq(cases.id, task.caseId));

  const versions = await getCaseVersions(task.caseId);
  const current = versions.find((v) => v.versionNumber === c.currentVersion);
  const payload = (current?.payload ?? {}) as Record<string, unknown>;

  const published = await publishCarrotanqueCase({
    caseId: task.caseId,
    versionId: current!.id,
    payload,
    userId: params.userId,
  });

  await db
    .update(cases)
    .set({
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cases.id, task.caseId));

  await emitEvent("record.published", "case", task.caseId, published);

  return { case: await getCaseById(task.caseId), published: true, asset: published };
}

export async function listFindings(caseId: string) {
  return db
    .select()
    .from(reviewFindings)
    .where(eq(reviewFindings.caseId, caseId))
    .orderBy(desc(reviewFindings.createdAt));
}

export async function getUserPrimaryDependency(userId: string) {
  const [row] = await db
    .select()
    .from(userDependencies)
    .where(
      and(
        eq(userDependencies.userId, userId),
        eq(userDependencies.isPrimary, true),
      ),
    )
    .limit(1);
  return row?.dependencyId ?? null;
}

export { assetCodeFromPayload, canTransition };
