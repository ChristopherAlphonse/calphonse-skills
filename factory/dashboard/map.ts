import { chip, el } from "/static/dom.js";
import { initDrawerResize } from "/static/drawer.js";
import { renderMarkdown } from "/static/markdown.js";
import type { Job } from "/static/types.js";

type Kind = "agent" | "script" | "human" | "end";
type Side = "left" | "right" | "top" | "bottom";
interface MapNode { id: string; label: string; sub: string; kind: Kind; col: number; row: number; span?: number }
interface Edge { from: string; to: string; label: string }
interface Box { x: number; y: number; w: number; h: number; col: number; row: number }
interface Pt { x: number; y: number }
interface Chip { text: string; x: number; y: number; kind: "up" | "down"; start?: boolean }
interface Route { fromSide: Side; toSide: Side; fromFrac: number; toFrac: number; kind: "up" | "down"; label: string; from: string; to: string }

const NS = "http://www.w3.org/2000/svg";
const W = 136;
const H = 62;
const X0 = 20;
const COL_STEP = 176;
const Y0 = 115;
const ROW_STEP = 132;
const MAX_PUSH = 90;
const POLL_MS = 2000;
const SLOT_SPREAD = 0.65;

const HEADS = ["Shape", "Spec", "Build", "Gate", "Review", "Polish", "Prove", "Ship", "Land"];
// Stage names and the agents behind them mirror HINT in bin/job. Edges mirror TRANSITIONS, plus the user's three clicks.
const NODES: MapNode[] = [
  { id: "shape", label: "Shape", sub: "lets-talk-about-it", kind: "agent", col: 0, row: 0 },
  { id: "rejected", label: "Rejected", sub: "rejection.md", kind: "end", col: 0, row: 1 },
  { id: "spec", label: "Spec", sub: "prd-mode", kind: "agent", col: 1, row: 0 },
  { id: "approve", label: "Approve spec", sub: "board click", kind: "human", col: 1, row: 1 },
  { id: "build", label: "Build", sub: "swe + stack skills", kind: "agent", col: 2, row: 0 },
  { id: "gate", label: "Gate", sub: "JOB gate (checks)", kind: "script", col: 3, row: 0 },
  { id: "review", label: "Review", sub: "reviewers", kind: "agent", col: 4, row: 0 },
  { id: "polish", label: "Polish", sub: "comment-sicko", kind: "agent", col: 5, row: 0 },
  { id: "prove", label: "Prove", sub: "prove-it-works", kind: "agent", col: 6, row: 0 },
  { id: "ship", label: "Ship", sub: "pr-body-style", kind: "agent", col: 7, row: 0 },
  { id: "commit", label: "Commit locally", sub: "board click", kind: "human", col: 8, row: 0 },
  { id: "ready", label: "Ready", sub: "commit + PR body", kind: "end", col: 8, row: 1 },
  { id: "needs-human", label: "Needs you", sub: "Unblock on the board", kind: "human", col: 3, row: 2, span: 3 },
];
const EDGES: Edge[] = [
  { from: "shape", to: "spec", label: "shape.md READY" },
  { from: "shape", to: "rejected", label: "rejection.md" },
  { from: "spec", to: "approve", label: "spec.md + tasks" },
  { from: "approve", to: "build", label: "approved, worktree made" },
  { from: "build", to: "gate", label: "build.md READY" },
  { from: "build", to: "needs-human", label: "BLOCKED" },
  { from: "gate", to: "review", label: "PASS" },
  { from: "gate", to: "prove", label: "PASS after polish" },
  { from: "gate", to: "build", label: "FAIL" },
  { from: "gate", to: "needs-human", label: "rounds used up" },
  { from: "review", to: "polish", label: "all PASS" },
  { from: "review", to: "build", label: "CHANGES" },
  { from: "review", to: "needs-human", label: "stuck" },
  { from: "polish", to: "gate", label: "DONE, rerun gate" },
  { from: "polish", to: "build", label: "REWORK" },
  { from: "polish", to: "needs-human", label: "stuck" },
  { from: "prove", to: "ship", label: "uat PASS" },
  { from: "prove", to: "build", label: "uat FAIL" },
  { from: "prove", to: "needs-human", label: "stuck" },
  { from: "ship", to: "commit", label: "pr-body.md, commit.md" },
  { from: "ship", to: "build", label: "rework" },
  { from: "ship", to: "needs-human", label: "stuck" },
  { from: "commit", to: "ready", label: "JOB commit" },
  { from: "needs-human", to: "build", label: "Unblock, more rounds" },
];

const $ = <T extends Element>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as unknown as T;
};
const svg = $<SVGSVGElement>("map");
const gNodes = $<SVGGElement>("nodes");
const gEdges = $<SVGGElement>("edges");
const gLabels = $<SVGGElement>("labels");
const mk = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
};

const boxes = new Map<string, Box>();
const nodeEls = new Map<string, SVGGElement>();
const badges = new Map<string, SVGTextElement>();

function drawStatic(): void {
  HEADS.forEach((h, i) => $<SVGGElement>("heads").append(mk("text", { x: X0 + i * COL_STEP + W / 2, y: 24, class: "head-label", "text-anchor": "middle" }, h)));
  for (const n of NODES) {
    const w = n.span ? (n.span - 1) * COL_STEP + W : W;
    const b = { x: X0 + n.col * COL_STEP, y: Y0 + n.row * ROW_STEP, w, h: H, col: n.col, row: n.row };
    boxes.set(n.id, b);
    const g = mk("g", { class: `node ${n.kind}`, tabindex: 0, "data-id": n.id, role: "img", "aria-label": `${n.label}, ${n.sub}` });
    g.append(
      mk("rect", { x: b.x, y: b.y, width: b.w, height: H, rx: 6 }),
      mk("text", { x: b.x + b.w / 2, y: b.y + 26, class: "name", "text-anchor": "middle" }, n.label),
      mk("text", { x: b.x + b.w / 2, y: b.y + 47, class: "sub", "text-anchor": "middle" }, n.sub),
    );
    const badge = mk("text", { x: b.x + b.w - 6, y: b.y - 6, class: "badge", "text-anchor": "end" });
    g.append(badge);
    badges.set(n.id, badge);
    nodeEls.set(n.id, g);
    gNodes.append(g);
    g.addEventListener("mouseenter", () => show(n.id));
    g.addEventListener("mouseleave", clear);
    g.addEventListener("focus", () => show(n.id));
    g.addEventListener("blur", clear);
    g.addEventListener("click", () => openNode(n.id));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openNode(n.id);
      }
    });
  }
}

const anchor = (id: string, side: Side, frac: number): Pt => {
  const b = boxes.get(id) as Box;
  if (side === "left") return { x: b.x, y: b.y + b.h * frac };
  if (side === "right") return { x: b.x + b.w, y: b.y + b.h * frac };
  if (side === "top") return { x: b.x + b.w * frac, y: b.y };
  return { x: b.x + b.w * frac, y: b.y + b.h };
};
const normal = (s: Side): Pt => ({ left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } })[s];

// Needs-you sits below the line, so its edges leave from bottoms and land on its top. A column neighbour links vertically and an
// adjacent column side to side, with the two directions of a pair on different heights so they do not overlap. A longer hop arcs over row 0.
function classify(e: Edge): Pick<Route, "fromSide" | "toSide" | "fromFrac" | "toFrac"> {
  const a = boxes.get(e.from) as Box;
  const b = boxes.get(e.to) as Box;
  const dc = b.col - a.col;
  if (e.to === "needs-human") return { fromSide: "bottom", toSide: "top", fromFrac: 0.5, toFrac: 0.5 };
  if (e.from === "needs-human") return { fromSide: "top", toSide: "bottom", fromFrac: 0.5, toFrac: 0.5 };
  if (dc === 0) return b.row > a.row ? { fromSide: "bottom", toSide: "top", fromFrac: 0.5, toFrac: 0.5 } : { fromSide: "top", toSide: "bottom", fromFrac: 0.5, toFrac: 0.5 };
  if (dc === 1) return { fromSide: "right", toSide: "left", fromFrac: 0.35, toFrac: 0.35 };
  if (dc === -1) return { fromSide: "left", toSide: "right", fromFrac: 0.65, toFrac: 0.65 };
  return { fromSide: "top", toSide: "top", fromFrac: 0.5, toFrac: 0.5 };
}

const push = (s: Side, dx: number): number =>
  s === "left" || s === "right" ? Math.max(40, Math.abs(dx) * 0.4) : Math.min(MAX_PUSH, 40 + Math.abs(dx) * 0.15);

function controls(p1: Pt, s1: Side, p2: Pt, s2: Side): [Pt, Pt] {
  const n1 = normal(s1);
  const n2 = normal(s2);
  const dx = p2.x - p1.x;
  const k1 = push(s1, dx);
  const k2 = push(s2, dx);
  return [{ x: p1.x + n1.x * k1, y: p1.y + n1.y * k1 }, { x: p2.x + n2.x * k2, y: p2.y + n2.y * k2 }];
}

const curve = (p1: Pt, s1: Side, p2: Pt, s2: Side): string => {
  const [c1, c2] = controls(p1, s1, p2, s2);
  return `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
};

const mid = (p1: Pt, s1: Side, p2: Pt, s2: Side): Pt => {
  const [c1, c2] = controls(p1, s1, p2, s2);
  return { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
};

function clear(): void {
  gEdges.replaceChildren();
  gLabels.replaceChildren();
  svg.classList.remove("hover-mode");
  svg.querySelectorAll(".related, .hovered").forEach((n) => n.classList.remove("related", "hovered"));
}

function show(id: string): void {
  clear();
  const routes: Route[] = [];
  for (const e of EDGES) {
    if (e.from !== id && e.to !== id) continue;
    routes.push({ ...classify(e), kind: e.to === id ? "up" : "down", label: e.label, from: e.from, to: e.to });
  }
  svg.classList.add("hover-mode");
  nodeEls.get(id)?.classList.add("hovered", "related");
  for (const r of routes) nodeEls.get(r.from === id ? r.to : r.from)?.classList.add("related");

  // Spread the arrowheads that share a side of the hovered node, ordered by where the other end sits.
  const groups = new Map<Side, Route[]>();
  for (const r of routes) {
    const side = r.to === id ? r.toSide : r.fromSide;
    groups.set(side, [...(groups.get(side) ?? []), r]);
  }
  for (const [side, group] of groups) {
    if (group.length < 2) continue;
    const key = (r: Route): number => {
      const o = boxes.get(r.to === id ? r.from : r.to) as Box;
      return side === "top" || side === "bottom" ? o.x : o.y;
    };
    group.sort((a, b) => key(a) - key(b));
    group.forEach((r, i) => {
      const f = 0.5 - SLOT_SPREAD / 2 + (i / (group.length - 1)) * SLOT_SPREAD;
      if (r.to === id) r.toFrac = f;
      else r.fromFrac = f;
    });
  }

  const chips: Chip[] = [];
  for (const r of routes) {
    const p1 = anchor(r.from, r.fromSide, r.fromFrac);
    const p2 = anchor(r.to, r.toSide, r.toFrac);
    const path = mk("path", { d: curve(p1, r.fromSide, p2, r.toSide), class: `edge ${r.kind}`, "marker-end": `url(#head-${r.kind})` });
    gEdges.append(path);
    path.getBBox(); // force layout so the fade-in transition runs
    path.classList.add("visible");
    const m = mid(p1, r.fromSide, p2, r.toSide);
    // Side-by-side neighbours leave a narrow gap, so their labels ride above (forward) or below (back) the row instead.
    const gap = r.fromSide === "right" ? -36 : r.fromSide === "left" ? H + 22 : null;
    const y = gap === null ? m.y : (boxes.get(r.fromSide === "right" ? r.from : r.to) as Box).y + gap;
    // A label on a short vertical arrow would hide it, so it sits to the right of the line.
    const beside = boxes.get(r.from)?.col === boxes.get(r.to)?.col;
    chips.push({ text: r.label, x: beside ? m.x + 12 : m.x, y, kind: r.kind, start: beside });
  }
  placeLabels(chips);
}

// Draw each label on an opaque chip and push it down in steps until it clears every chip already placed.
function placeLabels(chips: Chip[]): void {
  // Nodes and job badges count as already placed, so a nudged label never lands on one.
  const placed = [...boxes.values()].map((b) => ({ x1: b.x, y1: b.y - 4, x2: b.x + b.w, y2: b.y + b.h + 4 }));
  for (const t of badges.values()) {
    if (!t.textContent) continue;
    const b = t.getBBox();
    placed.push({ x1: b.x - 4, y1: b.y - 2, x2: b.x + b.width + 4, y2: b.y + b.height + 2 });
  }
  for (const c of chips.sort((a, b) => a.y - b.y)) {
    const t = mk("text", { x: c.x, y: c.y, class: `label ${c.kind}`, "text-anchor": c.start ? "start" : "middle" }, c.text);
    gLabels.append(t);
    const bb = t.getBBox();
    const box = (dy: number) => ({ x1: bb.x - 8, y1: bb.y - 4 + dy, x2: bb.x + bb.width + 8, y2: bb.y + bb.height + 4 + dy });
    const hit = (a: ReturnType<typeof box>) => placed.some((p) => a.x1 < p.x2 && a.x2 > p.x1 && a.y1 < p.y2 && a.y2 > p.y1);
    let dy = 0;
    for (let i = 1; hit(box(dy)) && i <= 16; i++) dy = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 18;
    const b = box(dy);
    placed.push(b);
    t.setAttribute("y", String(c.y + dy));
    gLabels.insertBefore(mk("rect", { x: b.x1, y: b.y1, width: b.x2 - b.x1, height: b.y2 - b.y1, rx: 3, class: "label-bg" }), t);
  }
}

// Which node a job lights: the board's two click gates get their own node, every other stage is the node of the same name.
const liveNode = (j: Job): string => (j.can_approve ? "approve" : j.can_commit ? "commit" : j.stage);

const api = (path: string): Promise<Response> => fetch(path, { credentials: "same-origin", headers: { "X-Factory": "1" } });

// The files each node's stage writes, matched against a job's file list (paths relative to the job folder).
const FILE_MATCH: Record<string, RegExp> = {
  shape: /^shape\.md$/,
  spec: /^spec\.md$/,
  approve: /^spec\.md$/,
  build: /^build\.md$/,
  gate: /^round-\d+\/checks\.md$/,
  review: /^(round-\d+\/review-[a-z]+|reconcile)\.md$/,
  polish: /^polish\.md$/,
  prove: /^uat\.md$/,
  ship: /^(pr-body|commit)\.md$/,
  commit: /^commit\.md$/,
  ready: /^(pr-body|commit)\.md$/,
  rejected: /^rejection\.md$/,
};

const view: { jobs: Job[]; node: string | null; job: string | null; file: string | null; token: number; sig: string } = { jobs: [], node: null, job: null, file: null, token: 0, sig: "" };
const drawer = $<HTMLElement>("drawer");
const filesFor = (j: Job, node: string): string[] => j.files.filter((f) => FILE_MATCH[node]?.test(f));

function openNode(id: string): void {
  view.node = id;
  // Jobs sitting at this node come first, so the likeliest file opens by default.
  const here = view.jobs.filter((j) => liveNode(j) === id);
  const withFiles = view.jobs.filter((j) => filesFor(j, id).length);
  view.job = (here[0] ?? withFiles[0] ?? view.jobs[0])?.id ?? null;
  view.file = null;
  renderDrawer();
}

function closeNode(): void {
  view.node = null;
  view.token++;
  drawer.classList.remove("open");
  nodeEls.forEach((g) => g.classList.remove("selected"));
}

function renderDrawer(): void {
  const node = NODES.find((n) => n.id === view.node);
  if (!node) return;
  drawer.classList.add("open");
  nodeEls.forEach((g, id) => g.classList.toggle("selected", id === node.id));
  const job = view.jobs.find((j) => j.id === view.job);
  const files = job ? filesFor(job, node.id) : [];
  if (job && !files.includes(view.file ?? "")) view.file = files.at(-1) ?? null;

  $("dhead").replaceChildren(el("h3", "", node.label), el("div", "id", `${node.sub}, ${view.jobs.length} build jobs`));
  $("djobs").replaceChildren(
    ...view.jobs.map((j) => {
      const c = chip(`${j.title} (${j.stage})`, j.id === view.job ? "on" : "");
      c.onclick = () => {
        view.job = j.id;
        view.file = null;
        renderDrawer();
      };
      return c;
    }),
  );
  $("dfiles").replaceChildren(
    ...files.map((f) => {
      const c = chip(f, f === view.file ? "on" : "");
      c.onclick = () => {
        view.file = f;
        renderDrawer();
      };
      return c;
    }),
  );
  void loadFile(node, job);
}

function body(cls: string, content: string | Node): void {
  const b = $("dbody");
  b.className = cls;
  if (typeof content === "string") b.textContent = content;
  else b.replaceChildren(content);
}

async function loadFile(node: MapNode, job: Job | undefined): Promise<void> {
  const token = ++view.token;
  if (!job) return body("raw", "No build jobs yet.");
  if (view.file) {
    let text = "offline, retrying";
    let ok = false;
    try {
      const res = await api(`/api/file?job=${encodeURIComponent(job.id)}&name=${encodeURIComponent(view.file)}`);
      ok = res.ok;
      text = ok ? await res.text() : "not found";
    } catch {}
    if (token === view.token) ok ? body("md", renderMarkdown(text)) : body("raw", text);
    return;
  }
  // No file: say what the node is, and for the user's gate show what the job waits on.
  const n = job.needs;
  if (node.id === "needs-human" && n) return body("raw", `${n.action}\n\n${n.why}\n\n${n.todo}\n\n${n.command}`);
  if (node.id === "needs-human") return body("raw", `${job.title} is not waiting on you.`);
  const kinds: Record<string, string> = { human: "A click on the board, so it writes no file.", end: "An end state.", script: "A script, not an agent. Its result is in the gate file of each round." };
  body("raw", `${job.title} has no ${node.label.toLowerCase()} file yet.${kinds[node.kind] ? "\n\n" + kinds[node.kind] : ""}`);
}

async function poll(): Promise<void> {
  try {
    const res = await api("/api/jobs");
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    const jobs: Job[] = (JSON.parse(text) as Job[]).filter((j) => j.kind === "build");
    const changed = text !== view.sig;
    view.sig = text;
    view.jobs = jobs;
    if (changed && view.node) renderDrawer();
    const counts = new Map<string, number>();
    for (const j of jobs) counts.set(liveNode(j), (counts.get(liveNode(j)) ?? 0) + 1);
    for (const [id, g] of nodeEls) {
      const n = counts.get(id) ?? 0;
      g.classList.toggle("live", n > 0);
      (badges.get(id) as SVGTextElement).textContent = n ? `${n} job${n > 1 ? "s" : ""}` : "";
    }
    $("meta").textContent = `${jobs.length} build jobs, updated ${new Date().toLocaleTimeString()}`;
  } catch {
    $("meta").textContent = "offline";
  }
}

// Text keeps a readable screen size: the svg scales with the window, so counter-scale fonts, within a clamp so they still fit the nodes.
const fitFonts = () => {
  const s = svg.clientWidth / svg.viewBox.baseVal.width;
  if (s > 0) svg.style.setProperty("--k", String(Math.min(Math.max(s, 0.7), 1.15) / s));
};
new ResizeObserver(fitFonts).observe(svg);
fitFonts();

initDrawerResize();
$("close").onclick = closeNode;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNode();
});
drawStatic();
poll();
setInterval(poll, POLL_MS);
