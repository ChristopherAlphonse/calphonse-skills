// The /api/jobs payload: the job.json fields from cmd_create and the later stages, plus what snapshot() adds.
export interface Needs {
  action: string;
  files: string;
  why: string;
  todo: string;
  command: string;
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
  reviewers: string[];
  stack: string[];
  branch: string | null;
  worktree: string | null;
  tip: string | null;
  started: string;
  ended: string | null;
  note: string;
  review?: ReviewRange;
  activity?: Activity[];
  base_tip?: string;
  hooks_path?: string;
  hooks_sha?: string;
  parked_from?: string;
  kind: "review";
  report: Record<string, string | undefined>;
  reviews: Record<string, string | null>;
  files: string[];
  needs_human: boolean;
  needs: Needs | null;
  can_unblock: boolean;
}

export interface Column {
  label: string;
  stages: string[];
  you?: boolean;
  always?: boolean;
}

export interface State {
  jobs: Job[];
  openId: string | null;
  openFile: string | null;
  lastSig: string;
  loadToken: number;
}
