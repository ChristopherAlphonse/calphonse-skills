import type { BoardDefinition, Job, Stage } from "/static/types.js";

const BUILD_STAGES: Stage[] = [
  { id: "shape", label: "Shape", blurb: "Decide what to build, or reject it." },
  { id: "spec", label: "Spec", blurb: "Write the plan. You approve it here." },
  {
    id: "build",
    label: "Feature",
    blurb: "Write the code, then the checks run.",
  },
  { id: "polish", label: "Polish", blurb: "Strip comments and workarounds." },
  {
    id: "ship",
    label: "Ship",
    blurb: "PR body and commit message, then a commit on the branch.",
  },
  { id: "ready", label: "Ready", blurb: "Commit on the branch." },
];

const PROVE_STAGES: Stage[] = [
  { id: "prove", label: "Prove", blurb: "Run it for real and write the UAT." },
  { id: "ready", label: "Ready", blurb: "UAT written. Nothing was edited." },
];

const REVIEW_STAGES: Stage[] = [
  {
    id: "scope",
    label: "Scope",
    blurb: "Find the diff and the repo's own checks.",
  },
  {
    id: "review",
    label: "Review",
    blurb: "Reviewers read the diff in parallel.",
  },
  {
    id: "reconcile",
    label: "Reconcile",
    blurb: "Merge the reviews into one ranked list.",
  },
  {
    id: "verify",
    label: "Verify",
    blurb: "Rerun the evidence, drop what fails.",
  },
  {
    id: "report",
    label: "Report",
    blurb: "Write the report and paste-ready comments.",
  },
  { id: "ready", label: "Ready", blurb: "Report written. Nothing was posted." },
];

function reviewVerdictChips(job: Job): { text: string; cls?: string }[] {
  return Object.entries(job.reviews).map(([reviewerName, verdict]) => ({
    text: verdict ? `${reviewerName} ${verdict}` : `${reviewerName} ...`,
    cls: verdict ?? "",
  }));
}

function stackChips(job: Job): { text: string; cls?: string }[][] {
  return job.stack.length ? [job.stack.map((stackName) => ({ text: stackName }))] : [];
}

function humanActionPath(job: Job): string {
  if (job.canApprove) return "approve";
  if (job.canCommit) return "commit";
  return "unblock";
}

export const BOARD_DEFINITIONS: Record<string, Omit<BoardDefinition, "id" | "label">> = {
  build: {
    blurb: "Take a feature from idea to a local commit.",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/></svg>',
    stages: BUILD_STAGES,
    lane: "Feature jobs",
    columns: 4,
    homeStage: "build",
    doneLabel: "Ready to land",
    intro:
      "Plain commits and pushes are allowed. Board buttons stay yours.",
    kind: "Build job",
    stats: (job) => [
      [!job.round ? "-" : `${job.round}/${job.roundLimit}`, "round"],
      [job.progress?.[1] ? `${job.progress[0]}/${job.progress[1]}` : "-", "tasks"],
      [job.files.length, "files"],
    ],
    place: (job) => job.branch ?? job.worktree,
    humanActionPath,
    statusBits: (job) => [
      [
        ...(job.stage === "gate" || job.gate
          ? [{ text: `gate ${job.gate || "pending"}`, cls: job.gate || "" }]
          : []),
        ...(job.commit || job.tip
          ? [{ text: `commit ${(job.commit || job.tip || "").slice(0, 7)}`, cls: "PASS" }]
          : []),
      ],
      ...stackChips(job),
    ],
  },
  review: {
    blurb: "Review a branch. Read-only, never edits code.",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
    stages: REVIEW_STAGES,
    lane: "Audit jobs",
    columns: 3,
    homeStage: "scope",
    doneLabel: "Reported",
    intro: "Read-only. Nothing is edited, committed, pushed or posted.",
    kind: "Audit",
    stats: (job) => [
      [job.report.FINDINGS ?? "-", "findings"],
      [job.report.BLOCKERS ?? "-", "blockers"],
      [job.files.length, "files"],
    ],
    place: (job) =>
      job.review
        ? job.review.head
          ? `${job.review.baseRef} .. ${job.review.headRef}`
          : "investigation"
        : (job.branch ?? job.worktree),
    humanActionPath: () => "unblock",
    statusBits: (job) => [
      ...stackChips(job),
      ...(job.report.FINDINGS !== undefined
        ? [
            [
              { text: `${job.report.FINDINGS} findings` },
              ...(job.report.BLOCKERS !== undefined
                ? [
                    {
                      text: `${job.report.BLOCKERS} blockers`,
                      cls: Number(job.report.BLOCKERS) ? "FAIL" : "PASS",
                    },
                  ]
                : []),
            ],
          ]
        : []),
      ...(Object.values(job.reviews).some(Boolean) || job.stage === "review"
        ? [reviewVerdictChips(job)]
        : []),
    ],
  },
  prove: {
    blurb: "Check a finished task works for real. Never edits code.",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    stages: PROVE_STAGES,
    lane: "Acceptance jobs",
    columns: 2,
    homeStage: "prove",
    doneLabel: "Proved",
    intro: "Runs the real thing and writes a UAT. Nothing is edited, committed, pushed or posted.",
    kind: "Acceptance",
    stats: (job) => [
      [job.report.STATUS ?? "-", "result"],
      [job.files.length, "files"],
    ],
    place: (job) => job.title,
    humanActionPath: () => "unblock",
    statusBits: (job) =>
      job.report.STATUS
        ? [[{ text: `UAT ${job.report.STATUS}`, cls: job.report.STATUS }]]
        : [],
  },
};
