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
const metaText = () => {
  const waiting = state.jobs.filter((j) => j.needs_human).length;
  return `${state.jobs.length} jobs${waiting ? `, ${waiting} waiting on you` : ""}, updated ${clock()}`;
};
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

  c.onclick = () => showDrawer(j.id);
  c.onkeydown = (e) => {
    if (e.target === c && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      showDrawer(j.id);
    }
  };
  return c;
}

function isRelevant(col, mine) {
  return col.always || col.you || mine.length || state.jobs.some((j) => col.kinds?.includes(j.kind));
}

function column(col, mine) {
  const section = el("section", `col${col.you ? " you" : ""}${col.always ? " end" : ""}${mine.length ? " busy" : ""}`);
  const h = el("h2");
  h.append(el("span", "", col.label), el("span", "", String(mine.length)));
  section.append(h, ...mine.map(card));
  return section;
}

function render() {
  const columns = [];
  for (const col of COLUMNS) {
    const mine = state.jobs.filter((j) => (col.you ? j.needs_human : col.stages.includes(j.stage) && !j.needs_human));
    if (isRelevant(col, mine)) columns.push(column(col, mine));
  }
  $("board").replaceChildren(...columns);

  setMeta(metaText());
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
      setMeta(metaText());
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

function needsPanel(n) {
  const box = el("div", "needs");
  const copy = el("button", "", "Copy");
  copy.onclick = () => {
    navigator.clipboard.writeText(n.command).then(() => {
      copy.textContent = "Copied";
    });
  };
  const cmd = el("div", "cmd");
  cmd.append(el("code", "", n.command), copy);
  box.append(
    el("h4", "", `Needs you: ${n.action}`),
    el("p", "", n.why),
    el("p", "", n.todo),
    cmd,
    el("p", "id", "Run this in your own terminal to get a link to the board with the buttons. This page is read-only."),
  );
  return box;
}

function renderDrawerHead() {
  const j = openJob();
  if (!j) return;
  $("dhead").replaceChildren(
    el("h3", "", j.title),
    el("div", "id", `${j.id} at ${j.stage}${j.branch ? `, ${j.branch}` : ""}`),
  );
  $("dneeds").replaceChildren(...(j.needs ? [needsPanel(j.needs)] : []));
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
        "Read-only view. Approve, commit, and unblock stay in the terminal board.";
    }
  } catch {
  }
}

const DRAWER_MIN = 320;
const DRAWER_KEY = "factory.drawerWidth";

function setDrawerWidth(px, save) {
  const w = Math.round(Math.min(Math.max(px, DRAWER_MIN), window.innerWidth));
  document.documentElement.style.setProperty("--drawer-w", w + "px");
  if (save) localStorage.setItem(DRAWER_KEY, w);
  return w;
}

const grip = $("grip");
grip.onpointerdown = (e) => {
  grip.setPointerCapture(e.pointerId);
  grip.classList.add("drag");
};
grip.onpointermove = (e) => {
  if (grip.hasPointerCapture(e.pointerId)) setDrawerWidth(window.innerWidth - e.clientX);
};
grip.onpointerup = (e) => {
  grip.classList.remove("drag");
  setDrawerWidth(window.innerWidth - e.clientX, true);
};
grip.onkeydown = (e) => {
  const dir = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
  if (!dir) return;
  e.preventDefault();
  setDrawerWidth($("drawer").offsetWidth + dir * 40, true);
};
function resetDrawerWidth() {
  localStorage.removeItem(DRAWER_KEY);
  document.documentElement.style.removeProperty("--drawer-w");
}
grip.ondblclick = resetDrawerWidth;
$("reset").onclick = resetDrawerWidth;
const saved = Number(localStorage.getItem(DRAWER_KEY));
if (saved) setDrawerWidth(saved);

$("close").onclick = closeDrawer;
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) poll();
});
applyMode();
pollLoop();
