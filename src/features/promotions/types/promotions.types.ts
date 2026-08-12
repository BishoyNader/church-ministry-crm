export type PromotionCycleStatus = "pending_confirmation" | "confirmed";

export type PromotionCycle = {
  id: string;
  churchId: string;
  academicYear: number;
  status: PromotionCycleStatus;
  confirmedAt: string | null;
  confirmedBy: string | null;
  createdAt: string;
  /** Beneficiaries still promoted (non-undone entries). */
  beneficiariesPromoted: number;
  /** Distinct services affected by the promoted placements. */
  affectedServices: number;
  /** Distinct servants with pending/published transitions. */
  affectedServants: number;
  /** Transitions still awaiting confirmation (status = pending). */
  pendingTransitions: number;
};

export type PromotionRunStatus = "applied" | "reverted";

export type AnnualPromotionRun = {
  id: string;
  churchId: string;
  stageId: string;
  academicYear: number;
  status: PromotionRunStatus;
  notes: string | null;
  runBy: string;
  createdAt: string;
  stageName: string | null;
  serviceName: string | null;
  totalEntries: number;
  undoneEntries: number;
};

export type PromotionEntry = {
  id: string;
  annualPromotionId: string;
  churchId: string;
  beneficiaryId: string;
  fromStageId: string;
  toStageId: string | null;
  isGraduated: boolean;
  note: string | null;
  undoneAt: string | null;
  undoneBy: string | null;
  createdAt: string;
  beneficiaryName: string;
  fromStageName: string | null;
  toStageName: string | null;
};
