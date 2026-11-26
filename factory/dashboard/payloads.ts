// The only place server data becomes a domain type. Everything downstream can trust these types.
import type {
  Activity,
  GateVerdict,
  Job,
  Needs,
  Proposal,
  ReportField,
  ReviewRange,
  ReviewVerdict,
  StagesPayload,
  WaitingJob,
} from "/static/types.js";

export type RequestOptions = { method?: string; body?: string };
export type RequestFn = (path: string, options?: RequestOptions) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 10_000;
const REPORT_FIELDS: ReportField[] = ["FINDINGS", "BLOCKERS"];

type UnknownRecord = Record<string, unknown>;

export function request(path: string, options: RequestOptions = {}): Promise<Response> {
  return fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "X-Factory": "1" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function expectRecord(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${label}: expected an object`);
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}: expected a string`);
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return expectString(value, label);
}

function nullableString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return expectString(value, label);
}

function optionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label}: expected a number`);
  return value;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new Error(`${label}: expected a boolean`);
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return [];
  if (!isStringArray(value)) throw new Error(`${label}: expected a list of strings`);
  return value;
}

function stringRecord(value: unknown, label: string): Record<string, string> {
  const record = expectRecord(value, label);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) result[key] = expectString(entry, `${label}.${key}`);
  return result;
}

function parseNeeds(value: unknown): Needs {
  const record = expectRecord(value, "job.needs");
  return {
    action: expectString(record.action, "job.needs.action"),
    fileSummary: expectString(record.files, "job.needs.files"),
    why: expectString(record.why, "job.needs.why"),
    todo: expectString(record.todo, "job.needs.todo"),
  };
}

function parseReviewRange(value: unknown): ReviewRange {
  const record = expectRecord(value, "job.review");
  return {
    baseRef: expectString(record.base_ref, "job.review.base_ref"),
    headRef: expectString(record.head_ref, "job.review.head_ref"),
    base: expectString(record.base, "job.review.base"),
    head: expectString(record.head, "job.review.head"),
  };
}

function parseActivity(value: unknown): Activity[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("job.activity: expected a list");
  return value.map((entry, index) => {
    const record = expectRecord(entry, `job.activity[${index}]`);
    return {
      ts: expectString(record.ts, `job.activity[${index}].ts`),
      text: expectString(record.text, `job.activity[${index}].text`),
    };
  });
}

function parseGate(value: unknown): GateVerdict | undefined {
  return value === "PASS" || value === "FAIL" ? value : undefined;
}

function parseReviewVerdict(value: unknown): ReviewVerdict | null {
  return value === "PASS" || value === "CHANGES" ? value : null;
}

function parseReport(value: unknown): Partial<Record<ReportField, string>> {
  if (value === undefined || value === null) return {};
  const raw = stringRecord(value, "job.report");
  const report: Partial<Record<ReportField, string>> = {};
  for (const field of REPORT_FIELDS) if (raw[field] !== undefined) report[field] = raw[field];
  return report;
}

function parseReviews(value: unknown): Record<string, ReviewVerdict | null> {
  if (value === undefined || value === null) return {};
  const raw = expectRecord(value, "job.reviews");
  const reviews: Record<string, ReviewVerdict | null> = {};
  for (const [reviewerName, verdict] of Object.entries(raw)) reviews[reviewerName] = parseReviewVerdict(verdict);
  return reviews;
}

function parseProgress(value: unknown): [number, number] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length !== 2) throw new Error("job.progress: expected two numbers");
  const [completedCount, totalCount] = value;
  if (typeof completedCount !== "number" || !Number.isFinite(completedCount)
    || typeof totalCount !== "number" || !Number.isFinite(totalCount)) {
    throw new Error("job.progress: expected two numbers");
  }
  return [completedCount, totalCount];
}

function parseJob(value: unknown): Job {
  const raw = expectRecord(value, "job");
  const fields = {
    id: expectString(raw.id, "job.id"),
    title: expectString(raw.title, "job.title"),
    stage: expectString(raw.stage, "job.stage"),
    round: optionalNumber(raw.round, "job.round"),
    roundLimit: optionalNumber(raw.round_limit, "job.round_limit"),
    reviewers: stringArray(raw.reviewers, "job.reviewers"),
    stack: stringArray(raw.stack, "job.stack"),
    skillsOff: raw.skills_off === undefined ? undefined : stringArray(raw.skills_off, "job.skills_off"),
    briefs: raw.briefs === undefined || raw.briefs === null ? undefined : stringRecord(raw.briefs, "job.briefs"),
    skills: stringArray(raw.skills, "job.skills"),
    branch: nullableString(raw.branch, "job.branch"),
    worktree: nullableString(raw.worktree, "job.worktree"),
    repo: optionalString(raw.repo, "job.repo") ?? null,
    commit: optionalString(raw.commit, "job.commit") ?? null,
    note: optionalString(raw.note, "job.note") ?? "",
    review: raw.review === undefined || raw.review === null ? undefined : parseReviewRange(raw.review),
    activity: parseActivity(raw.activity),
    parkedFrom: optionalString(raw.parked_from, "job.parked_from"),
    progress: parseProgress(raw.progress),
    report: parseReport(raw.report),
    gate: parseGate(raw.gate),
    reviews: parseReviews(raw.reviews),
    files: stringArray(raw.files, "job.files"),
    canApprove: optionalBoolean(raw.can_approve, "job.can_approve"),
    canCommit: optionalBoolean(raw.can_commit, "job.can_commit"),
    canUnblock: optionalBoolean(raw.can_unblock, "job.can_unblock"),
  };
  if (raw.needs === undefined || raw.needs === null) return { ...fields, needs: null, needsHuman: false };
  const waiting: WaitingJob = { ...fields, needs: parseNeeds(raw.needs), needsHuman: true };
  return waiting;
}

export function parseJobs(value: unknown): Job[] {
  if (!Array.isArray(value)) throw new Error("jobs: expected a list");
  return value.map(parseJob);
}

function parseProposal(value: unknown): Proposal | null {
  if (value === undefined || value === null) return null;
  const raw = expectRecord(value, "proposal");
  const order = expectRecord(raw.order, "proposal.order");
  const stageOrderByBoard: Record<string, string[]> = {};
  for (const [boardId, stages] of Object.entries(order)) stageOrderByBoard[boardId] = stringArray(stages, `proposal.order.${boardId}`);
  const isStale = optionalBoolean(raw.stale, "proposal.stale") ?? false;
  return {
    operations: stringArray(raw.ops, "proposal.ops"),
    stageOrderByBoard,
    changedStageIds: stringArray(raw.changed, "proposal.changed"),
    isStale,
  };
}

export function parseStages(value: unknown): StagesPayload {
  const raw = expectRecord(value, "stages");
  const custom = expectRecord(raw.custom, "stages.custom");
  const customStages: Record<string, { label: string; blurb: string }> = {};
  for (const [stageId, entry] of Object.entries(custom)) {
    const record = expectRecord(entry, `stages.custom.${stageId}`);
    customStages[stageId] = {
      label: expectString(record.label, `stages.custom.${stageId}.label`),
      blurb: expectString(record.blurb, `stages.custom.${stageId}.blurb`),
    };
  }
  return {
    stageOrder: stringArray(raw.order, "stages.order"),
    customStages,
    proposal: parseProposal(raw.proposal),
  };
}

export function parseBoards(value: unknown): { id: string; label: string }[] {
  if (!Array.isArray(value)) throw new Error("boards: expected a list");
  return value.map((entry, index) => {
    const record = expectRecord(entry, `boards[${index}]`);
    return {
      id: expectString(record.id, `boards[${index}].id`),
      label: expectString(record.label, `boards[${index}].label`),
    };
  });
}

export function parseEngines(value: unknown): Record<string, string[]> {
  const raw = expectRecord(value, "engines");
  const choices: Record<string, string[]> = {};
  for (const [engineName, models] of Object.entries(raw)) choices[engineName] = stringArray(models, `engines.${engineName}`);
  return choices;
}

export interface ChatTurn {
  board: string;
  job: string;
  question: string;
  answer: string;
  error: string;
  mode?: "chat" | "act";
}

export function parseChatTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) throw new Error("chat: expected a list");
  return value.map((entry, index) => {
    const record = expectRecord(entry, `chat[${index}]`);
    const mode = optionalString(record.mode, `chat[${index}].mode`);
    return {
      board: optionalString(record.board, `chat[${index}].board`) ?? "",
      job: optionalString(record.job, `chat[${index}].job`) ?? "",
      question: optionalString(record.question, `chat[${index}].question`) ?? "",
      answer: optionalString(record.answer, `chat[${index}].answer`) ?? "",
      error: optionalString(record.error, `chat[${index}].error`) ?? "",
      ...(mode === "act" || mode === "chat" ? { mode } : {}),
    };
  });
}

export function parseFeatureFlags(value: unknown): { mermaid: boolean } {
  const raw = expectRecord(value, "features");
  return { mermaid: optionalBoolean(raw.mermaid, "features.mermaid") ?? false };
}

export function parseAskResponse(value: unknown): { answer?: string; session?: string; error?: string } {
  const raw = expectRecord(value, "ask response");
  return {
    answer: optionalString(raw.answer, "ask response.answer"),
    session: optionalString(raw.session, "ask response.session"),
    error: optionalString(raw.error, "ask response.error"),
  };
}

export function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label}: invalid JSON`);
  }
}
