/**
 * Esquemas de plataforma multidependencia (iam, core, workflow, …).
 * Convive con tablas legacy en public (schema.ts).
 */
import {
  pgSchema,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  date,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

export const iamSchema = pgSchema("iam");
export const configSchema = pgSchema("config");
export const stagingSchema = pgSchema("staging");
export const workflowSchema = pgSchema("workflow");
export const coreSchema = pgSchema("core");
export const auditSchema = pgSchema("audit");

// ── IAM ─────────────────────────────────────────────────────
export const dependencies = iamSchema.table("dependencies", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const permissions = iamSchema.table("permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
});

export const userDependencies = iamSchema.table(
  "user_dependencies",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dependencyId: text("dependency_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [uniqueIndex("user_deps_pk").on(t.userId, t.dependencyId)],
);

// ── CONFIG ──────────────────────────────────────────────────
export const workflowDefinitions = configSchema.table(
  "workflow_definitions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    caseType: text("case_type").notNull(),
    moduleId: text("module_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const workflowVersions = configSchema.table(
  "workflow_versions",
  {
    id: text("id").primaryKey(),
    definitionId: text("definition_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("active"),
    config: jsonb("config")
      .notNull()
      .$type<WorkflowConfigJson>()
      .default({
        initialStatus: "DRAFT",
        steps: [],
        transitions: [],
        caseStatuses: [],
      } as WorkflowConfigJson),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("wf_def_ver_uidx").on(t.definitionId, t.version)],
);

export type WorkflowStepJson = {
  code: string;
  name: string;
  type: "capture" | "review" | "approval" | "publish";
  mode: "serial" | "parallel";
  parallelGroup?: string;
  assigneeRole?: string;
  assigneeDependencyCode?: string;
  requiredApprovals?: number;
  blockingFindingsSeverity?: string[];
};

export type WorkflowTransitionJson = {
  from: string;
  action: string;
  to: string;
  roles?: string[];
};

export type WorkflowConfigJson = {
  initialStatus: string;
  steps: WorkflowStepJson[];
  transitions: WorkflowTransitionJson[];
  caseStatuses: string[];
};

// ── CORE ────────────────────────────────────────────────────
export const cases = coreSchema.table(
  "cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseCode: text("case_code").notNull().unique(),
    caseType: text("case_type").notNull(),
    moduleId: text("module_id"),
    title: text("title").notNull(),
    status: text("status").notNull().default("DRAFT"),
    originDependencyId: text("origin_dependency_id"),
    currentVersion: integer("current_version").notNull().default(0),
    workflowInstanceId: uuid("workflow_instance_id"),
    createdBy: uuid("created_by").references(() => users.id),
    assignedDependencyId: text("assigned_dependency_id"),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("core_cases_status_idx").on(t.status),
    index("core_cases_type_idx").on(t.caseType),
  ],
);

export const assets = coreSchema.table("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetCode: text("asset_code").notNull().unique(),
  assetType: text("asset_type").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("OPERATIVE"),
  caseId: uuid("case_id"),
  publishedVersionId: uuid("published_version_id"),
  locationId: uuid("location_id"),
  metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const legalInstruments = coreSchema.table("legal_instruments", {
  id: uuid("id").defaultRandom().primaryKey(),
  instrumentCode: text("instrument_code").notNull().unique(),
  instrumentType: text("instrument_type").notNull(),
  title: text("title").notNull(),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  status: text("status").notNull().default("ACTIVE"),
  metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locations = coreSchema.table("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  departamento: text("departamento").notNull(),
  municipio: text("municipio").notNull(),
  description: text("description"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── STAGING ─────────────────────────────────────────────────
export const caseVersions = stagingSchema.table(
  "case_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    status: text("status").notNull().default("DRAFT"),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>().default({}),
    contentHash: text("content_hash"),
    createdBy: uuid("created_by").references(() => users.id),
    dependencyId: text("dependency_id"),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("case_ver_uidx").on(t.caseId, t.versionNumber)],
);

// ── WORKFLOW ────────────────────────────────────────────────
export const workflowInstances = workflowSchema.table("instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull().unique(),
  definitionId: text("definition_id").notNull(),
  definitionVersion: integer("definition_version").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  currentStepIds: jsonb("current_step_ids").notNull().$type<string[]>().default([]),
  context: jsonb("context").notNull().$type<Record<string, unknown>>().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const workflowTasks = workflowSchema.table(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instanceId: uuid("instance_id").notNull(),
    caseId: uuid("case_id").notNull(),
    stepCode: text("step_code").notNull(),
    taskType: text("task_type").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("PENDING"),
    assigneeRole: text("assignee_role"),
    assigneeDependencyId: text("assignee_dependency_id"),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id),
    dueAt: timestamp("due_at", { withTimezone: true }),
    priority: text("priority").notNull().default("NORMAL"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    result: jsonb("result").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("wf_tasks_case_idx").on(t.caseId),
    index("wf_tasks_status_idx").on(t.status),
  ],
);

export const reviewFindings = workflowSchema.table("review_findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull(),
  versionId: uuid("version_id"),
  taskId: uuid("task_id"),
  sectionCode: text("section_code"),
  fieldCode: text("field_code"),
  severity: text("severity").notNull().default("MEDIUM"),
  status: text("status").notNull().default("OPEN"),
  observation: text("observation").notNull(),
  requiredAction: text("required_action"),
  responsibleDependencyId: text("responsible_dependency_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const eventOutbox = workflowSchema.table(
  "event_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>().default({}),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [index("outbox_status_idx").on(t.status)],
);

export const auditEvents = auditSchema.table(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    dependencyId: text("dependency_id"),
    role: text("role"),
    action: text("action").notNull(),
    caseId: uuid("case_id"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    ipAddress: text("ip_address"),
    requestId: text("request_id"),
    reason: text("reason"),
    outcome: text("outcome").notNull().default("SUCCESS"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_ev_case_idx").on(t.caseId)],
);

export type CaseRow = typeof cases.$inferSelect;
export type WorkflowTaskRow = typeof workflowTasks.$inferSelect;
export type CaseVersionRow = typeof caseVersions.$inferSelect;
