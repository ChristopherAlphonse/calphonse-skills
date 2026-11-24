import { el, chip } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";
import { attachAnnotate } from "/static/annotate.js";
import type {
  BoardDef,
  Filter,
  Job,
  Needs,
  Stage,
  View,
} from "/static/types.js";

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

const DEFS: Record<string, Omit<BoardDef, "id" | "label">> = {
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

const POLL_MS = 2000;
const STORE = "factory.board";
const SIDE_OPEN = 240;
const SIDE_RAIL = 56;

const $ = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};

// ---- state: one View per board, plus which boards are open as tabs
const views = new Map<string, View>();
let order: string[] = [];
let openTabs: string[] = [];
let active = "";
let scale = 1;
let loadToken = 0;

// The file shown in the panel, and an edit in progress on it. `base` is the hash the edit started from; the server refuses a save if the file has moved on.
type Loaded = { job: string; name: string; text: string; base: string };
type Edit = { job: string; name: string; l1?: number; l2?: number; text: string; base: string; error?: string };
let loaded: Loaded | null = null;
let edit: Edit | null = null;
let sideCollapsed = false;

const view = (): View => {
  const v = views.get(active);
  if (!v) throw new Error("no active board");
  return v;
};
const openJob = (): Job | undefined =>
  view().jobs.find((j) => j.id === view().openId);

function save(): void {
  try {
    localStorage.setItem(
      STORE,
      JSON.stringify({ order, openTabs, active, sideCollapsed }),
    );
  } catch {
    // private window or blocked storage: the layout just is not remembered
  }
}
function restore(): {
  order: string[];
  openTabs: string[];
  active: string;
  sideCollapsed: boolean;
} | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
}

const api = (path: string, opts: { method?: string; body?: string } = {}) =>
  fetch(path, {
    ...opts,
    credentials: "same-origin",
    headers: { "X-Factory": "1" },
  });

async function post(
  action: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await api(`/api/${active}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) $("meta").textContent = `Refused: ${action} (${res.status})`;
  } catch {
    $("meta").textContent = "offline";
  }
  await pollOne(active);
}

const stageOf = (v: View, j: Job): string =>
  j.stage === "needs-human"
    ? (j.parked_from ?? v.def.homeStage)
    : j.stage === "gate"
      ? "build"
      : j.stage === "rejected"
        ? "ready"
        : j.stage;
const finished = (j: Job): boolean => ["ready", "rejected"].includes(j.stage);
const visible = (v: View, j: Job): boolean =>
  v.filter === "needs"
    ? j.needs_human
    : v.filter === "done"
      ? finished(j)
      : true;
const waitingCount = (v: View): number =>
  v.jobs.filter((j) => j.needs_human).length;

function button(
  label: string,
  cls: string,
  onclick: () => void,
): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.onclick = onclick;
  return b;
}
function row(...chips: HTMLElement[]): HTMLDivElement {
  const r = el("div", "row");
  r.append(...chips);
  return r;
}

// ---- left sidebar: every board, draggable into the tab strip
function boardIcon(id: string): HTMLElement {
  const i = el("span", "bico");
  i.innerHTML = DEFS[id]?.icon ?? "";
  return i;
}

function renderSidebar(): void {
  const list = $("boardlist");
  list.replaceChildren(
    ...order.map((id) => {
      const v = views.get(id);
      if (!v) return el("span");
      const r = el(
        "button",
        `boardrow${id === active ? " on" : ""}${openTabs.includes(id) ? " open" : ""}`,
      );
      r.type = "button";
      r.draggable = true;
      r.dataset.board = id;
      r.title = `${v.def.label}: ${v.def.blurb}`;
      const text = el("span", "btext");
      text.append(el("b", "", v.def.label), el("small", "", v.def.blurb));
      r.append(boardIcon(id), text);
      const n = waitingCount(v);
      if (n) r.append(el("span", "badge", String(n)));
      r.onclick = () => openBoard(id);
      r.ondragstart = (e) => dragStart(e, id);
      r.ondragend = dragEnd;
      r.ondragover = (e) => e.preventDefault();
      r.ondrop = (e) => {
        e.preventDefault();
        const from = e.dataTransfer?.getData("text/plain") ?? "";
        if (from && from !== id && views.has(from)) {
          order = order.filter((b) => b !== from);
          order.splice(order.indexOf(id), 0, from);
          save();
          renderSidebar();
        }
      };
      return r;
    }),
  );
}

function setSide(collapsed: boolean): void {
  sideCollapsed = collapsed;
  document.body.classList.toggle("side-collapsed", collapsed);
  $("side-toggle").setAttribute("aria-expanded", String(!collapsed));
  save();
  applyScale();
}

// ---- drag and drop
function dragStart(e: DragEvent, id: string): void {
  e.dataTransfer?.setData("text/plain", id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  document.body.classList.add("dragging");
  (e.target as HTMLElement).classList.add("drag");
}
function dragEnd(e: DragEvent): void {
  document.body.classList.remove("dragging");
  (e.target as HTMLElement).classList.remove("drag");
  $("boardtabs").classList.remove("over");
}
function dropIndex(x: number): number {
  const tabs = [...$("boardtabs").querySelectorAll<HTMLElement>(".btab")];
  const i = tabs.findIndex(
    (t) => x < t.getBoundingClientRect().left + t.offsetWidth / 2,
  );
  return i < 0 ? tabs.length : i;
}
function dropOnTabs(e: DragEvent): void {
  e.preventDefault();
  document.body.classList.remove("dragging");
  const id = e.dataTransfer?.getData("text/plain") ?? "";
  if (!views.has(id)) return;
  const at = dropIndex(e.clientX);
  const was = openTabs.indexOf(id);
  openTabs = openTabs.filter((b) => b !== id);
  openTabs.splice(was >= 0 && was < at ? at - 1 : at, 0, id);
  active = id;
  save();
  renderAll();
}

// ---- tabs and filters
function openBoard(id: string): void {
  if (!views.has(id)) return;
  if (!openTabs.includes(id)) openTabs.push(id);
  active = id;
  save();
  renderAll();
}
function closeBoard(id: string): void {
  if (openTabs.length < 2) return;
  const at = openTabs.indexOf(id);
  openTabs = openTabs.filter((b) => b !== id);
  if (active === id) active = openTabs[Math.min(at, openTabs.length - 1)];
  save();
  renderAll();
}

function renderTabs(): void {
  const strip = $("boardtabs");
  strip.replaceChildren(
    ...openTabs.map((id) => {
      const v = views.get(id);
      if (!v) return el("span");
      const t = el("div", `btab${id === active ? " on" : ""}`);
      t.draggable = true;
      t.dataset.board = id;
      t.append(boardIcon(id), el("span", "", v.def.label));
      const n = waitingCount(v);
      if (n) t.append(el("span", "badge", String(n)));
      if (openTabs.length > 1) {
        const x = button("×", "tabx", () => closeBoard(id));
        x.setAttribute("aria-label", `Close ${v.def.label}`);
        x.onclick = (e) => {
          e.stopPropagation();
          closeBoard(id);
        };
        t.append(x);
      }
      t.onclick = () => openBoard(id);
      t.ondragstart = (e) => dragStart(e, id);
      t.ondragend = dragEnd;
      return t;
    }),
  );
  const v = view();
  const done = v.jobs.filter(finished).length;
  const defs: [Filter, string, number, string][] = [
    ["all", "Pipeline", 0, ""],
    ["needs", "Needs you", waitingCount(v), ""],
    ["done", v.def.doneLabel, done, "ok"],
  ];
  $("filters").replaceChildren(
    ...defs.map(([id, label, n, cls]) => {
      const b = button(label, `tab${v.filter === id ? " on" : ""}`, () => {
        v.filter = id;
        renderAll();
      });
      if (n) b.append(el("span", `badge ${cls}`, String(n)));
      return b;
    }),
  );
  $("meta").textContent =
    `${v.jobs.length} jobs, updated ${new Date().toLocaleTimeString()}`;
  showIcon();
}

// The tab icon follows the active board; an amber dot and a count in the title mean something waits on you.
function showIcon(): void {
  const waiting = [...views.values()].reduce((n, v) => n + waitingCount(v), 0);
  const href = `/favicon-${active || "factory"}.svg?dot=${waiting ? 1 : 0}`;
  const link = document.getElementById("favicon");
  if (link && link.getAttribute("href") !== href)
    link.setAttribute("href", href);
  document.title = `${waiting ? `(${waiting}) ` : ""}Factory${active ? ` · ${view().def.label}` : ""}`;
}

// ---- canvas
function node(v: View, s: Stage, jobs: Job[]): HTMLElement {
  const hold = jobs.some((j) => j.needs_human);
  const n = el(
    "section",
    `node${jobs.length ? " lit" : ""}${hold ? " hold" : ""}`,
  );
  n.dataset.stage = s.id;
  const h = el("h3", "", s.label);
  h.append(el("span", "", jobs.length ? String(jobs.length) : ""));
  const list = el("div", "jobs");
  for (const j of jobs) {
    const bad = Number(j.report?.BLOCKERS) > 0 || j.gate === "FAIL";
    const c = el(
      "button",
      `jobchip${j.needs_human ? " hold" : ""}${bad ? " FAIL" : ""}${j.id === v.openId ? " on" : ""}`,
    );
    c.type = "button";
    c.append(el("i"), el("span", "", j.title));
    c.onclick = () => openJobPanel(j.id);
    list.append(c);
  }
  n.append(h, el("p", "", s.blurb), list);
  return n;
}

function renderCanvas(): void {
  const v = view();
  const mine = v.jobs.filter((j) => visible(v, j));
  const nodes = el("div", `nodes cols${v.def.columns}`);
  nodes.append(
    ...v.def.stages.map((s) =>
      node(
        v,
        s,
        mine.filter((j) => stageOf(v, j) === s.id),
      ),
    ),
  );
  const lane = el("div", "lane");
  lane.append(el("div", "rowlabel", v.def.lane), nodes);
  $("lanes").replaceChildren(lane);
  applyScale();
}

function renderAll(): void {
  renderSidebar();
  renderTabs();
  renderCanvas();
  renderPanel();
  showEngine();
}

function applyScale(): void {
  if (!active) return;
  const v = view();
  const lanes = $("lanes");
  const canvas = $("canvas");
  const rowsEl = $("rows");
  rowsEl.style.transform = "none";
  const w = lanes.offsetWidth;
  const h = lanes.offsetHeight;
  const fit = Math.min(
    1,
    (canvas.clientWidth - 56) / w,
    (canvas.clientHeight - 200) / h,
  );
  scale = v.userZoom ?? Math.max(0.3, fit);
  rowsEl.style.transform = `scale(${scale})`;
  $("stage").style.width = `${w * scale}px`;
  $("stage").style.height = `${h * scale}px`;
  drawWires();
}

type Pt = [number, number];
// A right-angle route with rounded corners, like Floorplan's connectors.
function routed(pts: Pt[], radius = 12): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py) || 1;
    const outLen = Math.hypot(nx - cx, ny - cy) || 1;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    d += ` L${cx - ((cx - px) / inLen) * r},${cy - ((cy - py) / inLen) * r} Q${cx},${cy} ${cx + ((nx - cx) / outLen) * r},${cy + ((ny - cy) / outLen) * r}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

function drawWires(): void {
  const svg = $("wires");
  const base = $("lanes").getBoundingClientRect();
  const ns = "http://www.w3.org/2000/svg";
  const at = (r: DOMRect) => ({
    l: (r.left - base.left) / scale,
    r: (r.right - base.left) / scale,
    t: (r.top - base.top) / scale,
    b: (r.bottom - base.top) / scale,
  });
  const shapes: SVGElement[] = [];
  const mk = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Record<string, string>,
    cls: string,
  ): SVGElementTagNameMap[K] => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.setAttribute("class", cls);
    return e;
  };
  for (const nodes of document.querySelectorAll<HTMLElement>(".nodes")) {
    const cards = [...nodes.children] as HTMLElement[];
    for (let i = 0; i + 1 < cards.length; i++) {
      const a = at(cards[i].getBoundingClientRect());
      const b = at(cards[i + 1].getBoundingClientRect());
      const lit = cards[i].classList.contains("lit") ? " lit" : "";
      const y1 = (a.t + a.b) / 2;
      const y2 = (b.t + b.b) / 2;
      const wrap = b.t > a.b;
      const route: Pt[] = wrap
        ? [
            [a.r, y1],
            [a.r + 28, y1],
            [a.r + 28, (a.b + b.t) / 2],
            [b.l - 28, (a.b + b.t) / 2],
            [b.l - 28, y2],
            [b.l, y2],
          ]
        : [
            [a.r, y1],
            [(a.r + b.l) / 2, y1],
            [(a.r + b.l) / 2, y2],
            [b.l, y2],
          ];
      shapes.push(mk("path", { d: routed(route) }, `wire${lit}`));
      for (const [cx, cy] of [route[0], route[route.length - 1]])
        shapes.push(
          mk(
            "circle",
            { cx: String(cx), cy: String(cy), r: "4.5" },
            `port${lit}`,
          ),
        );
    }
  }
  svg.setAttribute("width", String(base.width / scale));
  svg.setAttribute("height", String(base.height / scale));
  svg.replaceChildren(...shapes);
}

// ---- side panel (Floorplan's structure: header, title, description, stats, titled sections)
const sec = (...kids: (HTMLElement | null)[]): HTMLElement => {
  const s = el("div", "sec");
  s.append(...kids.filter((k): k is HTMLElement => k !== null));
  return s;
};
const heading = (text: string, count?: number): HTMLElement => {
  const h = el("h3", "", text);
  if (count !== undefined) h.append(el("span", "c", String(count)));
  return h;
};
const stats = (...pairs: [string | number, string][]): HTMLElement => {
  const box = el("div", "stats");
  for (const [n, label] of pairs) {
    const d = el("div");
    d.append(el("b", "", String(n)), el("span", "", label));
    box.append(d);
  }
  return box;
};
const dotClass = (j: Job): string =>
  j.needs_human
    ? "warn"
    : j.gate === "FAIL" || Number(j.report?.BLOCKERS) > 0
      ? "bad"
      : finished(j)
        ? "done"
        : "ok";

function listRow(j: Job): HTMLButtonElement {
  const r = el("button", "lrow");
  r.type = "button";
  const t = el("div", "rt");
  t.append(
    el("div", "rn", j.title),
    el(
      "div",
      "rd",
      `${j.id} at ${j.stage}${j.needs_human ? ", waiting on you" : ""}`,
    ),
  );
  r.append(
    el("span", `dot ${dotClass(j)}`),
    t,
    el("span", "rc", `${j.files.length} files`),
  );
  r.onclick = () => openJobPanel(j.id);
  return r;
}

function overview(): HTMLElement[] {
  const v = view();
  const waiting = v.jobs.filter((j) => j.needs_human);
  const ph = el("div", "ph");
  ph.append(boardIcon(v.def.id), el("span", "kindlabel", "Board"));
  const jobList = el("div", "list");
  const shown = v.jobs.filter((j) => visible(v, j));
  jobList.append(...shown.map(listRow));
  return [
    sec(
      ph,
      el("h2", "pt", v.def.label),
      el("p", "pd", v.def.intro),
      el("div", "gap"),
      stats(
        [v.jobs.length, "jobs"],
        [waiting.length, "need you"],
        [v.jobs.filter(finished).length, "done"],
      ),
    ),
    ...(waiting.length
      ? [
          sec(
            heading("Needs you", waiting.length),
            ...waiting.map((j) => {
              const c = el("button", "callout");
              c.type = "button";
              c.append(
                el("b", "", j.title),
                el("span", "", j.needs?.action ?? "Open"),
              );
              c.onclick = () => openJobPanel(j.id);
              return c;
            }),
          ),
        ]
      : []),
    sec(
      heading("Jobs", shown.length),
      shown.length
        ? jobList
        : el(
            "p",
            "pd empty",
            "No jobs yet. Ask an agent to run it, or type below.",
          ),
    ),
  ];
}

function needsBox(n: Needs, j: Job): HTMLElement {
  const box = el("div", "callout amber");
  box.append(
    el("b", "", `Needs you: ${n.action}`),
    el("p", "", n.why),
    el("p", "", n.todo),
  );
  box.append(
    button(n.action, "btn", () => post(view().def.needsPath(j), { id: j.id })),
  );
  return box;
}

function skillsSection(j: Job): HTMLElement {
  const v = view();
  const off = new Set(j.skills_off ?? []);
  const tag = (name: string) => {
    const t = el("button", `tag${off.has(name) ? " off" : ""}`, name);
    t.type = "button";
    t.title = off.has(name)
      ? "Off for this job. Click to use it again."
      : "Click to stop using this skill on this job.";
    t.onclick = () => post("skill", { id: j.id, name, off: !off.has(name) });
    return t;
  };
  const tagBox = el("div", "tags");
  tagBox.append(
    ...(v.skillsOpen ? j.skills : j.skills.filter((n) => off.has(n))).map(tag),
  );
  if (!v.skillsOpen && !off.size)
    tagBox.append(el("span", "pd empty", "All skills on"));
  const actions = el("div", "actions");
  actions.append(
    button(
      v.skillsOpen ? "Hide list" : "Choose skills",
      "btn ghost small",
      () => {
        v.skillsOpen = !v.skillsOpen;
        renderPanel();
      },
    ),
  );
  return sec(heading("Skills", off.size), tagBox, actions);
}

function noteSection(j: Job): HTMLElement {
  const note = el("textarea");
  note.rows = 2;
  note.placeholder = `Note for the ${j.stage} stage. The next agent follows it.`;
  note.value = j.briefs?.[j.stage] ?? "";
  const actions = el("div", "actions");
  actions.append(
    button("Save note", "btn ghost", () =>
      post("brief", { id: j.id, stage: j.stage, text: note.value }),
    ),
  );
  return sec(heading("Stage note"), note, actions);
}

function jobView(j: Job): HTMLElement[] {
  const v = view();
  const ph = el("div", "ph");
  ph.append(
    button("←", "iconbtn", closeJob),
    el("span", "kindlabel", v.def.kind),
  );
  const last = j.activity?.at(-1);
  const where = v.def.place(j);
  const bits = v.def.statusBits(j).filter((r) => r.length);
  const files = j.files.map((f) => {
    const r = el("button", `lrow${f === v.openFile ? " on" : ""}`);
    r.type = "button";
    const t = el("div", "rt");
    t.append(el("div", "rn", f));
    r.append(el("span", "dot file"), t);
    r.onclick = () => {
      v.openFile = f;
      renderPanel();
    };
    return r;
  });
  const fileList = el("div", "list");
  fileList.append(...files);
  const body = el("div");
  body.id = "dbody";
  return [
    sec(
      ph,
      el("h2", "pt", j.title),
      el("p", `pd${last ? "" : " empty"}`, last ? `now: ${last.text}` : j.id),
      where ? el("div", "pp", where) : null,
      el("div", "gap"),
      stats(...v.def.stats(j)),
    ),
    ...(j.needs ? [sec(needsBox(j.needs, j))] : []),
    ...(bits.length
      ? [
          sec(
            heading("Status"),
            ...bits.map((r) => row(...r.map((b) => chip(b.text, b.cls ?? "")))),
          ),
        ]
      : []),
    skillsSection(j),
    noteSection(j),
    sec(heading("Files", j.files.length), fileList, body),
  ];
}

function renderPanel(): void {
  if (document.activeElement?.tagName === "TEXTAREA") return;
  const j = openJob();
  $("panel").replaceChildren(...(j ? jobView(j) : overview()));
  if (j) void loadFile();
}

function showBody(className: string, content: string | Node): void {
  const body = document.getElementById("dbody");
  if (!body) return;
  body.className = className;
  if (typeof content === "string") body.textContent = content;
  else body.replaceChildren(content);
}

async function loadFile(): Promise<void> {
  const token = ++loadToken;
  const v = view();
  const name = v.openFile;
  if (!name) {
    const log = openJob()?.activity ?? [];
    return showBody(
      "raw",
      log.length
        ? log
            .toReversed()
            .map((a) => `${a.ts.slice(11, 19)}  ${a.text}`)
            .join("\n")
        : "No files or notes yet.",
    );
  }
  let ok = false;
  let text: string;
  let base = "";
  try {
    const res = await api(
      `/api/${v.def.id}/file?job=${encodeURIComponent(String(v.openId))}&name=${encodeURIComponent(name)}`,
    );
    ok = res.ok;
    text = ok ? await res.text() : "not found";
    base = res.headers.get("X-Base") ?? "";
  } catch {
    text = "offline, retrying";
  }
  if (token !== loadToken) return;
  loaded = ok && base ? { job: String(v.openId), name, text, base } : null;
  if (ok && /\.(md|markdown)$/i.test(name)) {
    if (edit && edit.job === loaded?.job && edit.name === name)
      return showBody("edit", editor(edit));
    const page = document.createDocumentFragment();
    const bar = el("div", "fbar");
    if (loaded) bar.append(button("Edit file", "", () => startEdit()));
    page.append(bar, renderMarkdown(text));
    showBody("md", page);
  } else showBody("raw", text);
}

function startEdit(l1?: number, l2?: number): void {
  if (!loaded) return;
  const lines = loaded.text.split("\n");
  edit = {
    job: loaded.job,
    name: loaded.name,
    l1,
    l2,
    base: loaded.base,
    text: l1 && l2 ? lines.slice(l1 - 1, l2).join("\n") : loaded.text,
  };
  void loadFile();
}

const SAVE_ERRORS: Record<number, string> = {
  409: "The file changed on disk after you opened it. Copy your text, cancel, and edit again.",
  422: "Lines like STATUS: and VERDICT: steer the board. They cannot be edited here.",
  400: "That edit was refused.",
};

async function saveEdit(e: Edit): Promise<void> {
  const { job, name, base, text, l1, l2 } = e;
  try {
    const res = await api(`/api/${view().def.id}/save`, {
      method: "POST",
      body: JSON.stringify({ id: job, name, base, text, l1, l2 }),
    });
    e.error = res.ok ? undefined : (SAVE_ERRORS[res.status] ?? `Refused (${res.status}).`);
    if (res.ok) edit = null;
  } catch {
    e.error = "offline";
  }
  await loadFile();
}

function editor(e: Edit): HTMLElement {
  const box = el("div", "editor");
  const where = e.l1 && e.l2 ? `${e.name}:${e.l1 === e.l2 ? e.l1 : `${e.l1}-${e.l2}`}` : e.name;
  const area = el("textarea");
  area.value = e.text;
  area.spellcheck = false;
  area.rows = Math.min(24, Math.max(6, e.text.split("\n").length + 1));
  area.oninput = () => {
    e.text = area.value;
  };
  area.onkeydown = (k) => {
    if (k.key === "Enter" && (k.metaKey || k.ctrlKey)) void saveEdit(e);
  };
  const row = el("div", "row");
  row.append(
    button("Cancel", "", () => {
      edit = null;
      void loadFile();
    }),
    button("Save", "go", () => void saveEdit(e)),
  );
  box.append(el("div", "ref", where), area, el("div", "emsg", e.error ?? ""), row);
  queueMicrotask(() => area.focus());
  return box;
}

function openJobPanel(id: string): void {
  const v = view();
  v.openId = id;
  v.openFile = openJob()?.files.at(-1) ?? null;
  document.body.classList.add("with-panel");
  renderAll();
}
function closeJob(): void {
  view().openId = null;
  loadToken++;
  renderAll();
}

// ---- polling: every board, so the sidebar and tab badges stay live
const inflight = new Map<string, Promise<void>>();
function pollOne(id: string): Promise<void> {
  const v = views.get(id);
  if (!v) return Promise.resolve();
  const p = inflight.get(id) ?? fetchJobs(v).finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

async function fetchJobs(v: View): Promise<void> {
  try {
    const res = await api(`/api/${v.def.id}/jobs`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const text = await res.text();
    if (text === v.sig)
      return v.def.id === active ? renderTabs() : renderSidebar();
    v.sig = text;
    // shortcut: the payload is trusted, not validated, upgrade if the server stops being ours
    v.jobs = JSON.parse(text) as Job[];
    if (v.def.id === active) renderAll();
    else {
      renderSidebar();
      renderTabs();
    }
  } catch {
    $("meta").textContent = "offline, retrying";
  }
}
async function pollLoop(): Promise<void> {
  if (!document.hidden) await Promise.all([...views.keys()].map(pollOne));
  setTimeout(pollLoop, POLL_MS);
}

// ---- ask bar
let engineList: string[] = ["claude"];
let modelChoices: Record<string, string[]> = {};
let engine = "claude";
const ENGINE_LABEL: Record<string, string> = {
  claude: "Claude Code",
  opencode: "OpenCode",
  kiro: "Kiro",
};
// Simple drawn marks, not the official logos: the page may not load outside images.
const ENGINE_ICON: Record<string, string> = {
  claude:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#d97757" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></g></svg>',
  kiro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#9046ff" d="M12 2.5c-4.4 0-7.5 3.3-7.5 7.9v8.6c0 1.2 1.3 1.8 2.2 1l1.5-1.3c.5-.4 1.2-.4 1.7 0l1.1 1c.6.5 1.4.5 2 0l1.1-1c.5-.4 1.2-.4 1.7 0l1.5 1.3c.9.8 2.2.2 2.2-1v-8.6c0-4.6-3.1-7.9-7.5-7.9z"/><circle cx="9.2" cy="10.5" r="1.3" fill="#fff"/><circle cx="14.8" cy="10.5" r="1.3" fill="#fff"/></svg>',
  opencode:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5 3h14v18H5V3zm4 4v10h6V7H9z"/></svg>',
};

const bubble = (cls: string, text: string): void => {
  $("ask-sheet").hidden = false;
  $("ask-log").append(el("div", cls, text));
  $("ask-sheet").scrollTop = $("ask-sheet").scrollHeight;
};
$("ask-close").onclick = () => {
  $("ask-sheet").hidden = true;
};

const composer = $("ask-input") as HTMLTextAreaElement;
composer.addEventListener("input", () => {
  composer.style.height = "auto";
  composer.style.height = `${composer.scrollHeight}px`;
});
composer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    ($("ask-form") as HTMLFormElement).requestSubmit();
  }
});
$("ask-form").onsubmit = (e) => {
  e.preventDefault();
  const question = composer.value.trim();
  if (!question) return;
  composer.value = "";
  composer.style.height = "auto";
  return ask(question);
};

attachAnnotate(
  () => {
    const v = view();
    return v.openId && v.openFile
      ? { job: String(v.openId), file: v.openFile }
      : null;
  },
  (text) => void ask(text),
  (r) => startEdit(r.l1, r.l2),
);

async function ask(question: string): Promise<void> {
  const v = view();
  $("ask-q").textContent = `${v.def.label}: ${question.split("\n")[0]}`;
  bubble("me", question);
  try {
    const body = {
      board: v.def.id,
      id: v.openId ?? "",
      question,
      session: v.session,
      engine,
      model: menus.model.value,
      effort: menus.effort.value,
    };
    const res = await api("/api/ask", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const out: { answer?: string; session?: string; error?: string } =
      await res.json();
    v.session = out.session ?? v.session;
    bubble(out.error ? "err" : "bot", out.error ?? out.answer ?? "");
  } catch {
    bubble("err", "offline");
  }
  await pollOne(v.def.id);
}

function showEngine(): void {
  $("engines").replaceChildren(
    ...engineList.map((name) => {
      const b = el("button", `eng${name === engine ? " on" : ""}`);
      b.type = "button";
      b.title = ENGINE_LABEL[name] ?? name;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(name === engine));
      const icon = el("span");
      icon.innerHTML = ENGINE_ICON[name] ?? "";
      b.append(
        icon,
        ...(name === engine
          ? [el("span", "", ENGINE_LABEL[name] ?? name)]
          : []),
      );
      b.onclick = () => {
        engine = name;
        for (const v of views.values()) v.session = "";
        showEngine();
      };
      return b;
    }),
  );
  menus.model.options = (modelChoices[engine] ?? []).map((m) => ({
    value: m,
    label: m,
  }));
  if (!menus.model.options.some((o) => o.value === menus.model.value))
    menus.model.value = "";
  menus.model.render();
  $("model-wrap").hidden = !modelChoices[engine]?.length;
}

const EFFORT_BARS: Record<string, number> = {
  "": 0,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
  max: 4,
};

// A popup menu that opens above its button. Our own markup, so it never flickers the way a native select does.
interface Menu {
  value: string;
  options: { value: string; label: string }[];
  render: () => void;
}
const openMenus = new Set<() => void>();

function makeMenu(
  id: string,
  placeholder: string,
  options: { value: string; label: string }[],
  onPick: () => void,
): Menu {
  const btn = $(`${id}-btn`);
  const pop = $(`${id}-pop`);
  const label = $(`${id}-label`);
  const menu: Menu = { value: "", options, render };
  const close = (): void => {
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    openMenus.delete(close);
  };
  function render(): void {
    const current = menu.options.find((o) => o.value === menu.value);
    label.textContent = current && menu.value ? current.label : placeholder;
    pop.replaceChildren(
      ...[{ value: "", label: "Default" }, ...menu.options].map((o) => {
        const item = el(
          "button",
          `popitem${o.value === menu.value ? " on" : ""}`,
        );
        item.type = "button";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(o.value === menu.value));
        item.append(
          el("span", "", o.label),
          el("span", "tick", o.value === menu.value ? "✓" : ""),
        );
        item.onclick = () => {
          menu.value = o.value;
          render();
          close();
          onPick();
        };
        return item;
      }),
    );
  }
  btn.onclick = (e) => {
    e.stopPropagation();
    const wasOpen = !pop.hidden;
    for (const c of [...openMenus]) c();
    if (wasOpen) return;
    render();
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    openMenus.add(close);
  };
  render();
  return menu;
}

const showEffort = (): void => {
  const level = EFFORT_BARS[menus.effort.value] ?? 0;
  document
    .querySelectorAll("#effort-icon .b")
    .forEach((bar, i) => bar.classList.toggle("on", i < level));
};
const menus = {
  model: makeMenu("model", "model", [], () => undefined),
  effort: makeMenu(
    "effort",
    "effort",
    [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "xhigh", label: "Extra high" },
      { value: "max", label: "Max" },
    ],
    () => showEffort(),
  ),
};
showEffort();
document.addEventListener("pointerdown", (e) => {
  if (!(e.target as HTMLElement).closest(".menu"))
    for (const c of [...openMenus]) c();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") for (const c of [...openMenus]) c();
});

// ---- chrome: zoom, panel, sidebar, drop zones
$("zoom-in").onclick = () => {
  view().userZoom = Math.min(2, scale * 1.2);
  applyScale();
};
$("zoom-out").onclick = () => {
  view().userZoom = Math.max(0.3, scale / 1.2);
  applyScale();
};
$("zoom-fit").onclick = () => {
  view().userZoom = null;
  applyScale();
};
$("panel-toggle").onclick = () => {
  document.body.classList.toggle("with-panel");
  applyScale();
};
$("side-toggle").onclick = () => setSide(!sideCollapsed);
for (const zone of [$("boardtabs"), $("canvas")]) {
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("over");
  };
  zone.ondragleave = () => zone.classList.remove("over");
  zone.ondrop = (e) => {
    zone.classList.remove("over");
    document.body.classList.remove("dragging");
    if (zone.id === "canvas") {
      e.preventDefault();
      const id = e.dataTransfer?.getData("text/plain") ?? "";
      if (views.has(id)) openBoard(id);
    } else dropOnTabs(e);
  };
}
window.addEventListener("resize", applyScale);
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) await Promise.all([...views.keys()].map(pollOne));
});

// ---- start
async function start(): Promise<void> {
  try {
    const boards: { id: string; label: string }[] = await (
      await api("/api/boards")
    ).json();
    for (const b of boards) {
      const def = DEFS[b.id];
      if (def)
        views.set(b.id, {
          def: { ...def, id: b.id, label: b.label },
          jobs: [],
          openId: null,
          openFile: null,
          filter: "all",
          userZoom: null,
          sig: "",
          session: "",
          skillsOpen: false,
        });
    }
  } catch {
    $("meta").textContent = "offline, retrying";
  }
  const saved = restore();
  order = [
    ...(saved?.order ?? []).filter((id) => views.has(id)),
    ...[...views.keys()].filter((id) => !saved?.order?.includes(id)),
  ];
  openTabs = (saved?.openTabs ?? []).filter((id) => views.has(id));
  if (!openTabs.length && order.length) openTabs = [order[0]];
  active = openTabs.includes(saved?.active ?? "")
    ? (saved?.active as string)
    : (openTabs[0] ?? "");
  document.body.classList.add("with-panel");
  setSide(saved?.sideCollapsed ?? false);
  try {
    modelChoices = await (await api("/api/engines")).json();
    const found = Object.keys(modelChoices);
    if (found.length) {
      engineList = found;
      engine = found[0];
    }
  } catch {
    // keep the claude default
  }
  if (active) {
    await Promise.all([...views.keys()].map(pollOne));
    renderAll();
  }
  await pollLoop();
}
await start();
