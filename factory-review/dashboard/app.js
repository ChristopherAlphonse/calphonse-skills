import { el, chip } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";

const COLUMNS = [
  { label: "Scope", stages: ["scope"] },
  { label: "Review", stages: ["review"] },
  { label: "Reconcile", stages: ["reconcile"] },
  { label: "Verify", stages: ["verify"] },
  { label: "Report", stages: ["report"] },
  { label: "Needs you", stages: ["needs-human"], you: true },
  { label: "Ready to land", stages: ["ready", "rejected"] },
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

function statusRows(j) {
  const rows = [row(chip(j.stage))];
  rows.push(el("div", "id", `${j.review.base_ref} .. ${j.review.head_ref}`));
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

  if (j.can_unblock) c.append(actionButton("Unblock, restore the reviewed commit", "/api/unblock", j));

  c.onclick = () => showDrawer(j.id);
  return c;
}

function column(col, mine) {
  const section = el("section", `col${col.you ? " you" : ""}`);
  const h = el("h2");
  h.append(el("span", "", col.label), el("span", "", String(mine.length)));
  section.append(h, ...mine.map(card));
  return section;
}

function render() {
  $("board").replaceChildren(...COLUMNS.map((col) => column(col, state.jobs.filter((j) => col.stages.includes(j.stage)))));

  const waiting = state.jobs.filter((j) => j.needs_human).length;
  setMeta(`${state.jobs.length} jobs${waiting ? `, ${waiting} waiting on you` : ""}, updated ${clock()}`);
  if (state.openId) renderDrawerHead();
}

async function poll() {
  try {
    const res = await api("/api/jobs");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const next = await res.json();
    const sig = JSON.stringify(next);
    state.jobs = next;
    if (sig === state.lastSig) {
      setMeta(`${next.length} jobs, updated ${clock()}`);
      return;
    }
    state.lastSig = sig;
    render();
    if (state.openId) loadFile();
  } catch {
    setMeta("offline, retrying");
  }
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
  if (!state.openFile) return showBody("raw", activityText(openJob()));

  const token = ++state.loadToken;
  const query = `job=${encodeURIComponent(state.openId)}&name=${encodeURIComponent(state.openFile)}`;
  const name = state.openFile;
  const res = await api(`/api/file?${query}`);
  const text = res.ok ? await res.text() : "not found";
  if (token !== state.loadToken) return;

  if (res.ok && /\.(md|markdown)$/i.test(name)) showBody("md", renderMarkdown(text));
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
        "read-only view: no unblock here. That stays in the terminal board";
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
applyMode();
poll();
setInterval(poll, POLL_MS);
