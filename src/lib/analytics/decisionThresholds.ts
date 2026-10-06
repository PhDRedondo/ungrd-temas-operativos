/** Umbrales del briefing. Archivo aparte para no arrastrar el motor al PDF. */
export const DECISION_THRESHOLDS = {
  version: "2026.07-nacional-v1",
  aguaDiasCola: 30,
  carrotanqueDiasEstancado: 45,
  ficGapCriticoPct: 15,
} as const;
