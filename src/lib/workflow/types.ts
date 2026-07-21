import { createHash } from "crypto";
import type { WorkflowConfigJson } from "@/db/platform-schema";

export const CASE_STATUSES = [
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
  "REOPENED",
  "CANCELLED",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function nextCaseCode(seq: number, year = new Date().getFullYear()) {
  return `CAS-${year}-${String(seq).padStart(5, "0")}`;
}

export function assetCodeFromPayload(payload: Record<string, unknown>): string {
  const placa = String(payload.placa || payload.asset_code || "").trim();
  if (placa) return `CT-${placa.toUpperCase()}`;
  return `CT-${Date.now().toString(36).toUpperCase()}`;
}

/** Pasos activos según config y estado del caso. */
export function resolveActiveSteps(
  config: WorkflowConfigJson,
  caseStatus: string,
): WorkflowConfigJson["steps"] {
  if (caseStatus === "DRAFT" || caseStatus === "CORRECTION_IN_PROGRESS") {
    return config.steps.filter((s) => s.type === "capture");
  }
  if (
    ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"].includes(caseStatus)
  ) {
    return config.steps.filter((s) => s.type === "review");
  }
  if (caseStatus === "STEP_APPROVED" || caseStatus === "FINAL_APPROVED") {
    return config.steps.filter((s) => s.type === "approval");
  }
  if (caseStatus === "PUBLISHING") {
    return config.steps.filter((s) => s.type === "publish");
  }
  return [];
}

export function canTransition(
  config: WorkflowConfigJson,
  from: string,
  action: string,
): string | null {
  const hit = config.transitions.find(
    (t) => t.from === from && t.action === action,
  );
  return hit?.to ?? null;
}
