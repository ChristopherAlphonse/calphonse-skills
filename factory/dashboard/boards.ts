import type { BoardDef, Job, Stage } from "/static/types.js";

const BUILD: Stage[] = [
  { id: "shape", label: "Shape", blurb: "Decide what to build, or reject it." },
  { id: "spec", label: "Spec", blurb: "Write the plan. You approve it here." },
  {
    id: "build",
    label: "Build",
    blurb: "Write the code, then the checks run.",
  },
  {
    id: "review",
    label: "Review",
    blurb: "Independent reviewers read the change.",
  },
  { id: "polish", label: "Polish", blurb: "Strip comments and workarounds." },
  { id: "prove", label: "Prove", blurb: "Run it for real and write the UAT." },
  {
    id: "ship",
    label: "Ship",
    blurb: "PR body and commit message. You commit.",
  },
  { id: "ready", label: "Ready", blurb: "Committed locally." },
];
const REVIEW: Stage[] = [
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
const verdicts = (j: Job) =>
  Object.entries(j.reviews).map(([name, v]) => ({
    text: v ? `${name} ${v}` : `${name} ...`,
    cls: v ?? "",
  }));
const stack = (j: Job) =>
  j.stack?.length ? [j.stack.map((k) => ({ text: k }))] : [];

export const DEFS: Record<string, Omit<BoardDef, "id" | "label">> = {
  build: {
    blurb: "Take a feature from idea to a local commit.",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/></svg>',
    stages: BUILD,
    lane: "Build jobs",
    columns: 4,
    homeStage: "build",
    doneLabel: "Ready to land",
    intro:
      "Local only. Nothing is pushed, and nothing is committed until you click.",
    kind: "Build job",
    stats: (j) => [
      [!j.round ? "-" : `${j.round}/${j.round_limit}`, "round"],
      [j.progress?.[1] ? `${j.progress[0]}/${j.progress[1]}` : "-", "tasks"],
      [j.files.length, "files"],
    ],
    place: (j) => j.branch ?? j.worktree,
    needsPath: (j) =>
      j.can_approve ? "approve" : j.can_commit ? "commit" : "unblock",
    statusBits: (j) => [
      [
        ...(j.stage === "gate" || j.gate
          ? [{ text: `gate ${j.gate || "pending"}`, cls: j.gate || "" }]
          : []),
        ...(j.commit
          ? [{ text: `committed locally ${j.commit.slice(0, 7)}`, cls: "PASS" }]
          : []),
      ],
      ...stack(j),
      ...(j.stage === "review" ? [verdicts(j)] : []),
    ],
  },
  review: {
    blurb: "Review a branch. Read-only, never edits code.",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
    stages: REVIEW,
    lane: "Review jobs",
    columns: 3,
    homeStage: "scope",
    doneLabel: "Reported",
    intro: "Read-only. Nothing is edited, committed, pushed or posted.",
    kind: "Review",
    stats: (j) => [
      [j.report?.FINDINGS ?? "-", "findings"],
      [j.report?.BLOCKERS ?? "-", "blockers"],
      [j.files.length, "files"],
    ],
    place: (j) =>
      j.review
        ? `${j.review.base_ref} .. ${j.review.head_ref}`
        : (j.branch ?? j.worktree),
    needsPath: () => "unblock",
    statusBits: (j) => [
      ...stack(j),
      ...(j.report?.FINDINGS !== undefined
        ? [
            [
              { text: `${j.report.FINDINGS} findings` },
              ...(j.report.BLOCKERS !== undefined
                ? [
                    {
                      text: `${j.report.BLOCKERS} blockers`,
                      cls: Number(j.report.BLOCKERS) ? "FAIL" : "PASS",
                    },
                  ]
                : []),
            ],
          ]
        : []),
      ...(Object.values(j.reviews).some(Boolean) || j.stage === "review"
        ? [verdicts(j)]
        : []),
    ],
  },
};
