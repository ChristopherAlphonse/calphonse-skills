// The /api/<board>/jobs payload: the job.json fields of either engine, plus what its snapshot() adds.
export interface Needs {
  action: string;
  files: string;
  why: string;
  todo: string;
}

export interface ReviewRange {
  base_ref: string;
  head_ref: string;
  base: string;
  head: string;
}

export interface Activity {
  ts: string;
  text: string;
}

export interface Job {
  id: string;
  title: string;
  stage: string;
  round?: number;
  round_limit?: number;
  reviewers: string[];
  stack: string[];
  skills_off?: string[];
  briefs?: Record<string, string>;
  skills: string[];
  branch: string | null;
  worktree: string | null;
  commit?: string | null;
  note: string;
  review?: ReviewRange;
  activity?: Activity[];
  parked_from?: string;
  progress?: [number, number];
  report: Record<string, string | undefined>;
  gate?: string | null;
  reviews: Record<string, string | null>;
  files: string[];
  needs_human: boolean;
  needs: Needs | null;
  can_approve?: boolean;
  can_commit?: boolean;
  can_unblock?: boolean;
}

export interface Stage {
  id: string;
  label: string;
  blurb: string;
}

export type Filter = "all" | "needs" | "done";

// One engine's board: its stages and how its jobs read in the panel.
export interface BoardDef {
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
  stats: (j: Job) => [string | number, string][];
  place: (j: Job) => string | null;
  needsPath: (j: Job) => string;
  statusBits: (j: Job) => { text: string; cls?: string }[][];
}

export interface View {
  def: BoardDef;
  jobs: Job[];
  openId: string | null;
  filter: Filter;
  userZoom: number | null;
  sig: string;
  session: string;
  skillsOpen: boolean;
}
