// Domain types. Server payloads are parsed in payloads.ts; nothing unchecked crosses into these types.

export type GateVerdict = "PASS" | "FAIL";
export type ReviewVerdict = "PASS" | "CHANGES";
export type ReportField = "FINDINGS" | "BLOCKERS" | "STATUS";

export interface Needs {
  action: string;
  // The server sends a short human-readable list such as "pr-body.md and commit.md".
  fileSummary: string;
  why: string;
  todo: string;
}

export interface ReviewRange {
  baseRef: string;
  headRef: string;
  base: string;
  head: string;
}

export interface Activity {
  ts: string;
  text: string;
}

interface JobFields {
  id: string;
  title: string;
  // Stage ids include custom stages from pipeline.json, so this stays a string.
  stage: string;
  round?: number;
  roundLimit?: number;
  reviewers: string[];
  stack: string[];
  briefs?: Record<string, string>;
  stageSkill: string;
  branch: string | null;
  worktree: string | null;
  repo?: string | null;
  commit?: string | null;
  tip?: string | null;
  note: string;
  review?: ReviewRange;
  activity?: Activity[];
  parkedFrom?: string;
  progress?: [completedCount: number, totalCount: number];
  report: Partial<Record<ReportField, string>>;
  gate?: GateVerdict;
  reviews: Record<string, ReviewVerdict | null>;
  files: string[];
  canApprove?: boolean;
  canCommit?: boolean;
  canUnblock?: boolean;
}

export interface WaitingJob extends JobFields {
  needs: Needs;
  needsHuman: true;
}

export interface RunningJob extends JobFields {
  needs: null;
  needsHuman: false;
}

export type Job = WaitingJob | RunningJob;

export interface Stage {
  id: string;
  label: string;
  blurb: string;
}

// A change to the custom stages that waits for the user to click Apply.
export interface Proposal {
  operations: string[];
  stageOrderByBoard: Record<string, string[]>;
  changedStageIds: string[];
  isStale: boolean;
}

export interface StagesPayload {
  stageOrder: string[];
  customStages: Record<string, { label: string; blurb: string }>;
  proposal: Proposal | null;
}

export type Filter = "all" | "needs" | "done";

// One engine's board: its stages and how its jobs read in the panel.
export interface BoardDefinition {
  id: string;
  label: string;
  blurb: string;
  icon: string;
  stages: Stage[];
  lane: string;
  columns: number;
  homeStage: string;
  doneLabel: string;
  intro: string;
  kind: string;
  stats: (job: Job) => [string | number, string][];
  place: (job: Job) => string | null;
  humanActionPath: (job: Job) => string;
  statusBits: (job: Job) => { text: string; cls?: string }[][];
}

export interface BoardView {
  definition: BoardDefinition;
  jobs: Job[];
  openId: string | null;
  filter: Filter;
  zoomOverride: number | null;
  payloadSignature: string;
  session: string;
  builtInStages: Stage[];
  proposal: Proposal | null;
}
