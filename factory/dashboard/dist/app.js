// Generated from app.ts by build.mjs. Do not edit.
import { el, chip } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";
                                                          

                 
             
                
                
 
const BUILD          = [
  { id: "shape", label: "Shape", blurb: "Decide what to build, or reject it." },
  { id: "spec", label: "Spec", blurb: "Write the plan. You approve it here." },
  { id: "build", label: "Build", blurb: "Write the code, then the checks run." },
  { id: "review", label: "Review", blurb: "Independent reviewers read the change." },
  { id: "polish", label: "Polish", blurb: "Strip comments and workarounds." },
  { id: "prove", label: "Prove", blurb: "Run it for real and write the UAT." },
  { id: "ship", label: "Ship", blurb: "PR body and commit message. You commit." },
  { id: "ready", label: "Ready", blurb: "Committed locally." },
];
const REVIEW          = [
  { id: "scope", label: "Scope", blurb: "Find the diff and the repo's own checks." },
  { id: "review", label: "Review", blurb: "Reviewers read the diff in parallel." },
  { id: "reconcile", label: "Reconcile", blurb: "Merge the reviews into one ranked list." },
  { id: "verify", label: "Verify", blurb: "Rerun the evidence, drop what fails." },
  { id: "report", label: "Report", blurb: "Write the report and paste-ready comments." },
  { id: "ready", label: "Ready", blurb: "Report written." },
];
const POLL_MS = 2000;
                                    

const $ = (id        )              => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};
const state        = { jobs: [], openId: null, openFile: null, lastSig: "", loadToken: 0 };
let tab      = "all";
let session = "";
let engineList           = ["claude"];
let modelChoices                           = {};
let engine = "claude";
const ENGINE_LABEL                         = { claude: "Claude Code", opencode: "OpenCode", kiro: "Kiro" };

const api = (path        , opts                                     = {}) =>
  fetch(path, { ...opts, credentials: "same-origin", headers: { "X-Factory": "1" } });

const openJob = ()                  => state.jobs.find((j) => j.id === state.openId);
const stageOf = (j     )         => {
  const s = j.stage === "needs-human" ? (j.parked_from ?? (j.kind === "review" ? "scope" : "build")) : j.stage;
  return s === "gate" ? "build" : s === "rejected" ? "ready" : s;
};
const visible = (j     )          =>
  tab === "needs" ? j.needs_human : tab === "done" ? ["ready", "rejected"].includes(j.stage) : true;

async function post(path        , body         )                {
  try {
    const res = await api(path, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) $("meta").textContent = `Refused: ${path.split("/").pop()} (${res.status})`;
  } catch {
    $("meta").textContent = "offline";
  }
  await poll();
}

function button(label        , cls        , onclick            )                    {
  const b = el("button", cls, label);
  b.type = "button";
  b.onclick = onclick;
  return b;
}
function row(...chips               )                 {
  const r = el("div", "row");
  r.append(...chips);
  return r;
}

// ---- top bar
function renderTabs()       {
  const waiting = state.jobs.filter((j) => j.needs_human).length;
  const done = state.jobs.filter((j) => ["ready", "rejected"].includes(j.stage)).length;
  const defs                                  = [
    ["all", "Pipeline", 0, ""],
    ["needs", "Needs you", waiting, ""],
    ["done", "Ready to land", done, "ok"],
  ];
  $("tabs").replaceChildren(
    ...defs.map(([id, label, n, cls]) => {
      const b = button(label, `tab${tab === id ? " on" : ""}`, () => {
        tab = id;
        render();
      });
      if (n) b.append(el("span", `badge ${cls}`, String(n)));
      return b;
    }),
  );
  $("meta").textContent = `${state.jobs.length} jobs, updated ${new Date().toLocaleTimeString()}`;
}

// ---- canvas
function node(s       , jobs       )              {
  const hold = jobs.some((j) => j.needs_human);
  const n = el("section", `node${jobs.length ? " lit" : ""}${hold ? " hold" : ""}`);
  n.dataset.stage = s.id;
  const h = el("h3", "", s.label);
  h.append(el("span", "", jobs.length ? String(jobs.length) : ""));
  const list = el("div", "jobs");
  for (const j of jobs) {
    const c = el("button", `jobchip${j.needs_human ? " hold" : ""}${j.gate === "FAIL" ? " FAIL" : ""}${j.id === state.openId ? " on" : ""}`);
    c.type = "button";
    c.append(el("i"), el("span", "", j.title));
    c.onclick = () => openJobPanel(j.id);
    list.append(c);
  }
  n.append(h, el("p", "", s.blurb), list);
  return n;
}

function render()       {
  renderTabs();
  const rows                = [];
  const kinds                                   = [["build", "Build jobs", BUILD], ["review", "Review jobs", REVIEW]];
  for (const [kind, label, stages] of kinds) {
    if (kind === "review" && !state.jobs.some((j) => j.kind === "review")) continue;
    const mine = state.jobs.filter((j) => j.kind === kind && visible(j));
    const wrap = el("div", "lane");
    const nodes = el("div", "nodes");
    nodes.append(...stages.map((s) => node(s, mine.filter((j) => stageOf(j) === s.id))));
    wrap.append(el("div", "rowlabel", label), nodes);
    rows.push(wrap);
  }
  $("rows").replaceChildren(...rows);
  drawWires();
  renderPanel();
}

function drawWires()       {
  const svg = $("wires");
  const base = $("rows").getBoundingClientRect();
  const ns = "http://www.w3.org/2000/svg";
  const paths                   = [];
  for (const nodes of document.querySelectorAll             (".nodes")) {
    const cards = [...nodes.children]                 ;
    for (let i = 0; i + 1 < cards.length; i++) {
      const a = cards[i].getBoundingClientRect();
      const b = cards[i + 1].getBoundingClientRect();
      const x1 = a.right - base.left;
      const y1 = a.top + 28 - base.top;
      const x2 = b.left - base.left;
      const y2 = b.top + 28 - base.top;
      const mid = (x1 + x2) / 2;
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`);
      if (cards[i].classList.contains("lit")) p.classList.add("lit");
      paths.push(p);
    }
  }
  svg.setAttribute("width", String(base.width));
  svg.setAttribute("height", String(base.height));
  svg.style.left = `${$("rows").offsetLeft}px`;
  svg.style.top = `${$("rows").offsetTop}px`;
  svg.replaceChildren(...paths);
}

// ---- side panel
function overview()                {
  const waiting = state.jobs.filter((j) => j.needs_human).length;
  const done = state.jobs.filter((j) => ["ready", "rejected"].includes(j.stage)).length;
  const stat = (n        , label        ) => {
    const d = el("div");
    d.append(el("b", "", String(n)), el("span", "", label));
    return d;
  };
  const stats = el("div", "stats");
  stats.append(stat(state.jobs.length, "jobs"), stat(waiting, "need you"), stat(done, "ready"));
  const list = state.jobs.filter(visible).map((j) => {
    const r = el("button", "listrow", j.title);
    r.type = "button";
    r.append(el("small", "", `${j.id} at ${j.stage}${j.needs_human ? ", waiting on you" : ""}`));
    r.onclick = () => openJobPanel(j.id);
    return r;
  });
  const empty = state.jobs.length ? [] : [el("p", "sub", "No jobs yet. Ask an agent to run the factory, or type below.")];
  return [el("h2", "", "Factory"), el("p", "sub", "Local only. Nothing is pushed, and nothing is committed until you click."), stats, el("h4", "", "Jobs"), ...list, ...empty];
}

function needsBox(n       , j     )              {
  const box = el("div", "needs");
  box.append(el("h4", "", `Needs you: ${n.action}`), el("p", "", n.why), el("p", "", n.todo));
  const path = j.can_approve ? "/api/approve" : j.can_commit ? "/api/commit" : "/api/unblock";
  box.append(button(n.action, "btn", () => post(path, { id: j.id })));
  return box;
}

function toolsBox(j     )              {
  const box = el("div", "tools");
  const off = new Set(j.skills_off ?? []);
  const chips = j.skills.map((name) => {
    const c = chip(off.has(name) ? `${name} (off)` : name, off.has(name) ? "FAIL" : "");
    c.title = off.has(name) ? "Click to use this skill again" : "Click to stop using this skill on this job";
    c.onclick = () => post("/api/skill", { id: j.id, name, off: !off.has(name) });
    return c;
  });
  const note = el("textarea");
  note.rows = 2;
  note.placeholder = `Note for the ${j.stage} stage. The next agent follows it.`;
  note.value = j.briefs?.[j.stage] ?? "";
  box.append(el("h4", "", "Skills on this job"), row(...chips), note, button("Save note", "btn ghost", () => post("/api/brief", { id: j.id, stage: j.stage, text: note.value })));
  return box;
}

function statusRows(j     )                {
  const rows                = [];
  const chips = [chip(j.kind === "review" ? `review job: ${j.stage}` : j.stage)];
  if (j.round && j.kind !== "review") chips.push(chip(`round ${j.round}/${j.round_limit}`));
  if (j.stage === "gate" || j.gate) chips.push(chip(`gate ${j.gate || "pending"}`, j.gate || ""));
  if (j.commit) chips.push(chip(`committed locally ${j.commit.slice(0, 7)}`, "PASS"));
  rows.push(row(...chips));
  if (j.kind === "review" && j.review) rows.push(el("div", "sub", `${j.review.base_ref} .. ${j.review.head_ref}`));
  if (j.stack?.length) rows.push(row(...j.stack.map((k) => chip(k))));
  if (j.report?.FINDINGS !== undefined) {
    const c = [chip(`${j.report.FINDINGS} findings`)];
    if (j.report.BLOCKERS !== undefined) c.push(chip(`${j.report.BLOCKERS} blockers`, Number(j.report.BLOCKERS) ? "FAIL" : "PASS"));
    rows.push(row(...c));
  }
  if (j.stage === "review") rows.push(row(...Object.entries(j.reviews).map(([name, v]) => chip(v ? `${name} ${v}` : `${name} ...`, v ?? ""))));
  const [done, total] = j.progress;
  if (total) {
    const bar = el("div", "bar");
    const fill = el("i");
    fill.style.width = `${Math.round((100 * done) / total)}%`;
    bar.append(fill);
    rows.push(bar, el("div", "sub", `tasks ${done}/${total}`));
  }
  return rows;
}

function jobView(j     )                {
  const files = j.files.map((f) => {
    const c = chip(f, f === state.openFile ? "on" : "");
    c.onclick = async () => {
      state.openFile = f;
      renderPanel();
      await loadFile();
    };
    return c;
  });
  const body = el("div");
  body.id = "dbody";
  return [
    button("← All jobs", "btn ghost", closeJob),
    el("h2", "", j.title),
    el("div", "sub", `${j.id}${j.branch ? `, ${j.branch}` : ""}`),
    ...statusRows(j),
    ...(j.needs ? [needsBox(j.needs, j)] : []),
    toolsBox(j),
    el("h4", "", "Files"),
    row(...files),
    body,
  ];
}

function renderPanel()       {
  const j = openJob();
  if (document.activeElement?.tagName === "TEXTAREA") return;
  $("panel").replaceChildren(...(j ? jobView(j) : overview()));
  if (j) void loadFile();
}

function showBody(className        , content               )       {
  const body = document.getElementById("dbody");
  if (!body) return;
  body.className = className;
  if (typeof content === "string") body.textContent = content;
  else body.replaceChildren(content);
}

async function loadFile()                {
  const token = ++state.loadToken;
  const name = state.openFile;
  if (!name) {
    const log = openJob()?.activity ?? [];
    return showBody("raw", log.length ? log.toReversed().map((a) => `${a.ts.slice(11, 19)}  ${a.text}`).join("\n") : "No files or notes yet.");
  }
  let ok = false;
  let text        ;
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

function openJobPanel(id        )       {
  state.openId = id;
  state.openFile = openJob()?.files.at(-1) ?? null;
  document.body.classList.add("with-panel");
  render();
}
function closeJob()       {
  state.openId = null;
  state.loadToken++;
  render();
}

// ---- polling
let inflight                       = null;
const poll = ()                => (inflight ??= fetchJobs().finally(() => (inflight = null)));

async function fetchJobs()                {
  try {
    const res = await api("/api/jobs");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const text = await res.text();
    if (text === state.lastSig) return renderTabs();
    state.lastSig = text;
    // shortcut: the payload is trusted, not validated, upgrade if the server stops being ours
    state.jobs = JSON.parse(text)         ;
    render();
  } catch {
    $("meta").textContent = "offline, retrying";
  }
}
async function pollLoop()                {
  if (!document.hidden) await poll();
  setTimeout(pollLoop, POLL_MS);
}

// ---- ask bar
const bubble = (cls        , text        )       => {
  $("ask-sheet").hidden = false;
  $("ask-log").append(el("div", cls, text));
  $("ask-sheet").scrollTop = $("ask-sheet").scrollHeight;
};
$("ask-close").onclick = () => {
  $("ask-sheet").hidden = true;
};
const composer = $("ask-input")                       ;
composer.addEventListener("input", () => {
  composer.style.height = "auto";
  composer.style.height = `${composer.scrollHeight}px`;
});
composer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    ($("ask-form")                   ).requestSubmit();
  }
});
$("ask-form").onsubmit = async (e) => {
  e.preventDefault();
  const input = $("ask-input")                       ;
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  input.style.height = "auto";
  $("ask-q").textContent = question;
  bubble("me", question);
  try {
    const res = await api("/api/ask", { method: "POST", body: JSON.stringify({ id: state.openId ?? "", question, session, engine, model: ($("model")                    ).value.trim(), effort: ($("effort")                     ).value }) });
    const out                                                        = await res.json();
    session = out.session ?? session;
    bubble(out.error ? "err" : "bot", out.error ?? out.answer ?? "");
  } catch {
    bubble("err", "offline");
  }
  await poll();
};

$("engine").onclick = () => {
  engine = engineList[(engineList.indexOf(engine) + 1) % engineList.length];
  session = "";
  showEngine();
};
function showEngine()       {
  $("engine-name").textContent = ENGINE_LABEL[engine] ?? engine;
  ($("model")                    ).value = "";
  $("models").replaceChildren(...(modelChoices[engine] ?? []).map((m) => {
    const o = el("option");
    o.value = m;
    return o;
  }));
}
try {
  modelChoices = await (await api("/api/engines")).json();
  const found = Object.keys(modelChoices);
  if (found.length) {
    engineList = found;
    engine = found[0];
    showEngine();
  }
} catch {
  // keep the claude default
}

$("panel-toggle").onclick = () => {
  document.body.classList.toggle("with-panel");
  drawWires();
};
document.body.classList.add("with-panel");
window.addEventListener("resize", drawWires);
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) await poll();
});
await pollLoop();
