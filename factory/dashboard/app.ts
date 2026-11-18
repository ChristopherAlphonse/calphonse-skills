import { el, chip } from "/static/dom.js";
import { initDrawerResize } from "/static/drawer.js";
import { renderMarkdown } from "/static/markdown.js";
import type { Column, Job, Needs, State } from "/static/types.js";

const COLUMNS: Column[] = [
  { label: "Shape", stages: ["shape"], kinds: ["build"] },
  { label: "Spec", stages: ["spec"], kinds: ["build"] },
  { label: "Scope", stages: ["scope"], kinds: ["review"] },
  { label: "Build", stages: ["build", "gate"], kinds: ["build"] },
  { label: "Review", stages: ["review"], kinds: ["build", "review"] },
  { label: "Reconcile", stages: ["reconcile"], kinds: ["review"] },
  { label: "Polish", stages: ["polish"], kinds: ["build"] },
  { label: "Verify", stages: ["verify"], kinds: ["review"] },
  { label: "Prove", stages: ["prove"], kinds: ["build"] },
  { label: "Report", stages: ["report"], kinds: ["review"] },
  { label: "Ship", stages: ["ship"], kinds: ["build"] },
  { label: "Needs you", stages: ["needs-human"], you: true },
  { label: "Ready to land", stages: ["ready", "rejected"], always: true },
];
const POLL_MS = 2000;

const $ = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};
const state: State = { jobs: [], openId: null, openFile: null, lastSig: "", loadToken: 0 };

const api = (path: string, opts: { method?: string; body?: string; headers?: Record<string, string> } = {}) =>
  fetch(path, {
    ...opts,
    credentials: "same-origin",
    headers: { ...opts.headers, "X-Factory": "1" },
  });

const setMeta = (text: string): void => {
  $("meta").textContent = text;
};
const clock = (): string => new Date().toLocaleTimeString();
const metaText = (): string => {
  const waiting = state.jobs.filter((j) => j.needs_human).length;
  const waitingText = waiting ? `, ${waiting} waiting on you` : "";
  return `${state.jobs.length} jobs${waitingText}, updated ${clock()}`;
};
const openJob = (): Job | undefined => state.jobs.find((j) => j.id === state.openId);

async function post(path: string, body: unknown): Promise<void> {
  const name = path.split("/").pop();
  try {
    const res = await api(path, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) setMeta(`Refused: ${name} (${res.status})`);
  } catch {
    setMeta(`Failed: ${name} (offline)`);
  }
  await poll();
}

function actionButton(label: string, path: string, job: Job): HTMLButtonElement {
  const b = el("button", "", label);
  b.onclick = async (e) => {
    e.stopPropagation();
    await post(path, { id: job.id });
  };
  return b;
}

function row(...chips: HTMLElement[]): HTMLDivElement {
  const r = el("div", "row");
  r.append(...chips);
  return r;
}

function progressBar(done: number, total: number): [HTMLDivElement, HTMLDivElement] {
  const bar = el("div", "bar");
  const fill = el("i");
  fill.style.width = `${Math.round((100 * done) / total)}%`;
  bar.append(fill);
  return [bar, el("div", "id", `tasks ${done}/${total}`)];
}

function statusRows(j: Job): HTMLElement[] {
  const rows: HTMLElement[] = [];
  const stageChips = [chip(j.kind === "review" ? `review job: ${j.stage}` : j.stage)];
  if (j.round && j.kind !== "review") stageChips.push(chip(`round ${j.round}/${j.round_limit}`));
  if (j.stage === "gate" || j.gate) stageChips.push(chip(`gate ${j.gate || "pending"}`, j.gate || ""));
  if (j.commit) stageChips.push(chip(`committed locally ${j.commit.slice(0, 7)}`, "PASS"));
  rows.push(row(...stageChips));

  if (j.kind === "review" && j.review) rows.push(el("div", "id", `${j.review.base_ref} .. ${j.review.head_ref}`));
  if (j.stack?.length) rows.push(row(...j.stack.map((k) => chip(k))));

  if (j.report?.FINDINGS !== undefined) {
    const chips = [chip(`${j.report.FINDINGS} findings`)];
    if (j.report.BLOCKERS !== undefined) {
      chips.push(chip(`${j.report.BLOCKERS} blockers`, Number(j.report.BLOCKERS) ? "FAIL" : "PASS"));
    }
    rows.push(row(...chips));
  }
  if (j.stage === "review") {
    const verdicts: [string, string | null][] = Object.entries(j.reviews);
    rows.push(row(...verdicts.map(([name, v]) => chip(v ? `${name} ${v}` : `${name} ...`, v ?? ""))));
  }
  return rows;
}

function card(j: Job): HTMLDivElement {
  const c = el("div", `card${j.needs_human ? " hold" : ""}${j.stage === "rejected" ? " rejected" : ""}`);
  c.tabIndex = 0;
  c.append(el("div", "t", j.title), el("div", "id", j.id), ...statusRows(j));

  const last = j.activity?.at(-1);
  if (j.needs) c.append(el("div", "id", `waiting on you: ${j.needs.action.toLowerCase()}. Click for how.`));
  else if (last && j.stage !== "ready") c.append(el("div", "id", `now: ${last.text}`));

  const [done, total] = j.progress;
  if (total) c.append(...progressBar(done, total));

  if (j.can_approve) c.append(actionButton("Approve spec", "/api/approve", j));
  if (j.can_commit) c.append(actionButton("Commit locally", "/api/commit", j));
  if (j.stage === "needs-human") c.append(actionButton("Unblock, grant more rounds", "/api/unblock", j));

  c.onclick = async () => await showDrawer(j.id);
  c.onkeydown = async (e) => {
    if (e.target === c && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      await showDrawer(j.id);
    }
  };
  return c;
}

function isRelevant(col: Column, mine: Job[]) {
  return col.always || col.you || mine.length || state.jobs.some((j) => col.kinds?.includes(j.kind));
}

function column(col: Column, mine: Job[]): HTMLElement {
  const section = el("section", `col${col.you ? " you" : ""}${col.always ? " end" : ""}${mine.length ? " busy" : ""}`);
  const h = el("h2");
  h.append(el("span", "", col.label), el("span", "", String(mine.length)));
  section.append(h, ...mine.map(card));
  return section;
}

function render(): void {
  const columns: HTMLElement[] = [];
  for (const col of COLUMNS) {
    const mine = state.jobs.filter((j) => (col.you ? j.needs_human : col.stages.includes(j.stage) && !j.needs_human));
    if (isRelevant(col, mine)) columns.push(column(col, mine));
  }
  $("board").replaceChildren(...columns);

  setMeta(metaText());
  if (state.openId) renderDrawerHead();
}

let inflight: Promise<void> | null = null;

function poll(): Promise<void> {
  inflight ??= fetchJobs().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function fetchJobs(): Promise<void> {
  try {
    const res = await api("/api/jobs");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const text = await res.text();
    if (text === state.lastSig) {
      setMeta(metaText());
      return;
    }
    state.lastSig = text;
    // shortcut: the payload is trusted, not validated, upgrade if the server stops being ours
    state.jobs = JSON.parse(text) as Job[];
    render();
    if (state.openId) await loadFile();
  } catch {
    setMeta("offline, retrying");
  }
}

async function pollLoop(): Promise<void> {
  if (!document.hidden) await poll();
  setTimeout(pollLoop, POLL_MS);
}

function needsPanel(n: Needs): HTMLDivElement {
  const box = el("div", "needs");
  const copy = el("button", "", "Copy");
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(n.command);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Copy failed";
    }
  };
  const cmd = el("div", "cmd");
  cmd.append(el("code", "", n.command), copy);
  box.append(
    el("h4", "", `Needs you: ${n.action}`),
    el("p", "", n.why),
    el("p", "", n.todo),
    cmd,
    el("p", "id", "Run it in your own terminal. It prints a one-time link with the buttons. This read-only page cannot approve."),
  );
  return box;
}

function renderDrawerHead(): void {
  const j = openJob();
  if (!j) return;
  const branch = j.branch ? `, ${j.branch}` : "";
  $("dhead").replaceChildren(el("h3", "", j.title), el("div", "id", `${j.id} at ${j.stage}${branch}`));
  $("dneeds").replaceChildren(...(j.needs ? [needsPanel(j.needs)] : []));
  $("dfiles").replaceChildren(
    ...j.files.map((f) => {
      const c = chip(f, f === state.openFile ? "on" : "");
      c.onclick = async () => {
        state.openFile = f;
        renderDrawerHead();
        await loadFile();
      };
      return c;
    }),
  );
}

function activityText(j: Job | undefined): string {
  const log = j?.activity ?? [];
  if (!log.length) return "No files or notes yet. This job has not written anything.";
  return log
    .toReversed()
    .map((a) => `${a.ts.slice(11, 19)}  ${a.text}`)
    .join("\n");
}

function showBody(className: string, content: string | Node): void {
  const body = $("dbody");
  body.className = className;
  if (typeof content === "string") body.textContent = content;
  else body.replaceChildren(content);
}

async function loadFile(): Promise<void> {
  const token = ++state.loadToken;
  const name = state.openFile;
  if (!name) return showBody("raw", activityText(openJob()));

  let ok = false;
  let text: string;
  try {
    const res = await api(`/api/file?job=${encodeURIComponent(String(state.openId))}&name=${encodeURIComponent(name)}`);
    ok = res.ok;
    text = ok ? await res.text() : "not found";
  } catch {
    text = "offline, retrying";
  }
  if (token !== state.loadToken) return;

  if (ok && /\.(md|markdown)$/i.test(name)) showBody("md", renderMarkdown(text));
  else showBody("raw", text);
}

async function showDrawer(id: string): Promise<void> {
  state.openId = id;
  state.openFile = openJob()?.files.at(-1) ?? null;
  $("drawer").classList.add("open");
  renderDrawerHead();
  await loadFile();
}

function closeDrawer(): void {
  state.openId = null;
  state.loadToken++;
  $("drawer").classList.remove("open");
}

async function applyMode(): Promise<void> {
  try {
    const mode: { readonly: boolean } = await (await api("/api/mode")).json();
    const policy = document.querySelector(".policy");
    if (mode.readonly && policy) {
      policy.textContent = "Read-only view. Approve, commit, and unblock stay in the terminal board.";
    }
  } catch {
  }
}

initDrawerResize();

$("close").onclick = closeDrawer;
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) await poll();
});
await applyMode();
await pollLoop();
