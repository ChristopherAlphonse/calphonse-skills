import { el, chip } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";

const COLUMNS = [
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

const $ = (id) => document.getElementById(id);
const state = { jobs: [], openId: null, openFile: null, lastSig: "", loadToken: 0 };

const api = (path, opts = {}) =>
  fetch(path, {
    ...opts,
    credentials: "same-origin",
    headers: { ...opts.headers, "X-Factory": "1" },
  });

const setMeta = (text) => {
  $("meta").textContent = text;
};
const clock = () => new Date().toLocaleTimeString();
const openJob = () => state.jobs.find((j) => j.id === state.openId);

async function post(path, body) {
  const res = await api(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) setMeta(`Refused: ${path.split("/").pop()} (${res.status})`);
  poll();
}

function actionButton(label, path, job) {
  const b = el("button", "", label);
  b.onclick = (e) => {
    e.stopPropagation();
    post(path, { id: job.id });
  };
  return b;
}

function row(...chips) {
  const r = el("div", "row");
  r.append(...chips);
  return r;
}

function progressBar(done, total) {
  const bar = el("div", "bar");
  const fill = el("i");
  fill.style.width = `${Math.round((100 * done) / total)}%`;
  bar.append(fill);
  return [bar, el("div", "id", `tasks ${done}/${total}`)];
}

function statusRows(j) {
  const rows = [];
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
    rows.push(row(...Object.entries(j.reviews).map(([name, v]) => chip(v ? `${name} ${v}` : `${name} ...`, v || ""))));
  }
  return rows;
}

function card(j) {
  const c = el("div", `card${j.needs_human ? " hold" : ""}`);
  c.append(el("div", "t", j.title), el("div", "id", j.id), ...statusRows(j));

  const last = j.activity?.at(-1);
  if (last && j.stage !== "ready") c.append(el("div", "id", `now: ${last.text}`));

  const [done, total] = j.progress;
  if (total) c.append(...progressBar(done, total));

  if (j.can_approve) c.append(actionButton("Approve spec", "/api/approve", j));
  if (j.can_commit) c.append(actionButton("Commit locally", "/api/commit", j));
  if (j.stage === "needs-human") c.append(actionButton("Unblock, grant more rounds", "/api/unblock", j));

  c.onclick = () => showDrawer(j.id);
  return c;
}

function isRelevant(col, mine) {
  return col.always || col.you || mine.length || state.jobs.some((j) => col.kinds?.includes(j.kind));
}

function column(col, mine) {
  const section = el("section", `col${col.you ? " you" : ""}`);
  const h = el("h2");
  h.append(el("span", "", col.label), el("span", "", String(mine.length)));
  section.append(h, ...mine.map(card));
  return section;
}

function render() {
  const columns = [];
  for (const col of COLUMNS) {
    const mine = state.jobs.filter((j) => col.stages.includes(j.stage));
    if (isRelevant(col, mine)) columns.push(column(col, mine));
  }
  $("board").replaceChildren(...columns);

  const waiting = state.jobs.filter((j) => j.needs_human).length;
  setMeta(`${state.jobs.length} jobs${waiting ? `, ${waiting} waiting on you` : ""}, updated ${clock()}`);
  if (state.openId) renderDrawerHead();
}

let inflight = null;

function poll() {
  inflight ??= fetchJobs().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function fetchJobs() {
  try {
    const res = await api("/api/jobs");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const text = await res.text();
    if (text === state.lastSig) {
      setMeta(`${state.jobs.length} jobs, updated ${clock()}`);
      return;
    }
    state.lastSig = text;
    state.jobs = JSON.parse(text);
    render();
    if (state.openId) loadFile();
  } catch {
    setMeta("offline, retrying");
  }
}

async function pollLoop() {
  if (!document.hidden) await poll();
  setTimeout(pollLoop, POLL_MS);
}

function renderDrawerHead() {
  const j = openJob();
  if (!j) return;
  $("dhead").replaceChildren(
    el("h3", "", j.title),
    el("div", "id", `${j.id} at ${j.stage}${j.branch ? `, ${j.branch}` : ""}`),
  );
  $("dfiles").replaceChildren(
    ...j.files.map((f) => {
      const c = chip(f, f === state.openFile ? "on" : "");
      c.onclick = () => {
        state.openFile = f;
        renderDrawerHead();
        loadFile();
      };
      return c;
    }),
  );
}

function activityText(j) {
  const log = j?.activity ?? [];
  if (!log.length) return "No files or notes yet. This job has not written anything.";
  return log
    .toReversed()
    .map((a) => `${a.ts.slice(11, 19)}  ${a.text}`)
    .join("\n");
}

function showBody(className, content) {
  const body = $("dbody");
  body.className = className;
  if (typeof content === "string") body.textContent = content;
  else body.replaceChildren(content);
}

async function loadFile() {
  const token = ++state.loadToken;
  const name = state.openFile;
  if (!name) return showBody("raw", activityText(openJob()));

  let ok = false;
  let text;
  try {
    const res = await api(`/api/file?job=${encodeURIComponent(state.openId)}&name=${encodeURIComponent(name)}`);
    ok = res.ok;
    text = ok ? await res.text() : "not found";
  } catch {
    text = "offline, retrying";
  }
  if (token !== state.loadToken) return;

  if (ok && /\.(md|markdown)$/i.test(name)) showBody("md", renderMarkdown(text));
  else showBody("raw", text);
}

function showDrawer(id) {
  state.openId = id;
  state.openFile = openJob()?.files.at(-1) ?? null;
  $("drawer").classList.add("open");
  renderDrawerHead();
  loadFile();
}

function closeDrawer() {
  state.openId = null;
  state.loadToken++;
  $("drawer").classList.remove("open");
}

async function applyMode() {
  try {
    const mode = await (await api("/api/mode")).json();
    if (mode.readonly) {
      document.querySelector(".policy").textContent =
        "read-only view: no approve, commit, or unblock here. Those stay in the terminal board";
    }
  } catch {
  }
}

$("close").onclick = closeDrawer;
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) poll();
});
applyMode();
pollLoop();
