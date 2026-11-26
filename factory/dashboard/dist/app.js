// Generated from app.ts by build.mjs. Do not edit.
import { DEFS } from "/static/boards.js";
import { el, chip } from "/static/dom.js";
import { openEditor,                   } from "/static/editor.js";
import { renderMarkdown } from "/static/markdown.js";
import { drawWires } from "/static/wires.js";
             
         
      
        
        
                
       
                          

const POLL_MS = 2000;
const STORE = "factory.board";
const SIDE_OPEN = 240;
const SIDE_RAIL = 56;

const $ = (id        )              => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};

// ---- state: one View per board, plus which boards are open as tabs
const views = new Map              ();
let order           = [];
let openTabs           = [];
let active = "";
// Editors are tabs beside the boards. One stays alive while you look at a board, so nothing is lost.
const editors = new Map                                         ();
let activeEditor                = null;
let scale = 1;


let sideCollapsed = false;

const view = ()       => {
  const v = views.get(active);
  if (!v) throw new Error("no active board");
  return v;
};
const openJob = ()                  =>
  view().jobs.find((j) => j.id === view().openId);

function save()       {
  try {
    localStorage.setItem(
      STORE,
      JSON.stringify({ order, openTabs, active, sideCollapsed }),
    );
  } catch {
    // private window or blocked storage: the layout just is not remembered
  }
}
function restore()   
                  
                     
                 
                         
         {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
}

const api = (path        , opts                                     = {}) =>
  fetch(path, {
    ...opts,
    credentials: "same-origin",
    headers: { "X-Factory": "1" },
  });

async function post(
  action        ,
  body                         ,
)                {
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

const stageOf = (v      , j     )         =>
  j.stage === "needs-human"
    ? (j.parked_from ?? v.def.homeStage)
    : j.stage === "gate"
      ? "build"
      : j.stage === "rejected"
        ? "ready"
        : j.stage;
const finished = (j     )          => ["ready", "rejected"].includes(j.stage);
const visible = (v      , j     )          =>
  v.filter === "needs"
    ? j.needs_human
    : v.filter === "done"
      ? finished(j)
      : true;
const waitingCount = (v      )         =>
  v.jobs.filter((j) => j.needs_human).length;

function button(
  label        ,
  cls        ,
  onclick            ,
)                    {
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

// ---- left sidebar: every board, draggable into the tab strip
function boardIcon(id        )              {
  const i = el("span", "bico");
  i.innerHTML = DEFS[id]?.icon ?? "";
  return i;
}

function renderSidebar()       {
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

function setSide(collapsed         )       {
  sideCollapsed = collapsed;
  document.body.classList.toggle("side-collapsed", collapsed);
  $("side-toggle").setAttribute("aria-expanded", String(!collapsed));
  save();
  applyScale();
}

// ---- drag and drop
function dragStart(e           , id        )       {
  e.dataTransfer?.setData("text/plain", id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  document.body.classList.add("dragging");
  (e.target               ).classList.add("drag");
}
function dragEnd(e           )       {
  document.body.classList.remove("dragging");
  (e.target               ).classList.remove("drag");
  $("boardtabs").classList.remove("over");
}
function dropIndex(x        )         {
  const tabs = [...$("boardtabs").querySelectorAll             (".btab")];
  const i = tabs.findIndex(
    (t) => x < t.getBoundingClientRect().left + t.offsetWidth / 2,
  );
  return i < 0 ? tabs.length : i;
}
function dropOnTabs(e           )       {
  e.preventDefault();
  document.body.classList.remove("dragging");
  const id = e.dataTransfer?.getData("text/plain") ?? "";
  if (!views.has(id)) return;
  const at = dropIndex(e.clientX);
  const was = openTabs.indexOf(id);
  openTabs = openTabs.filter((b) => b !== id);
  openTabs.splice(was >= 0 && was < at ? at - 1 : at, 0, id);
  active = id;
  activeEditor = null;
  save();
  renderAll();
}

// ---- tabs and filters
function openBoard(id        )       {
  if (!views.has(id)) return;
  if (!openTabs.includes(id)) openTabs.push(id);
  active = id;
  activeEditor = null;
  save();
  renderAll();
}
function closeBoard(id        )       {
  if (openTabs.length < 2) return;
  const at = openTabs.indexOf(id);
  openTabs = openTabs.filter((b) => b !== id);
  if (active === id) active = openTabs[Math.min(at, openTabs.length - 1)];
  activeEditor = null;
  save();
  renderAll();
}

function renderTabs()       {
  const strip = $("boardtabs");
  strip.replaceChildren(
    ...openTabs.map((id) => {
      const v = views.get(id);
      if (!v) return el("span");
      const t = el("div", `btab${id === active && !activeEditor ? " on" : ""}`);
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
    ...[...editors].map(([key, h]) => editorTab(key, h)),
  );
  for (const [key, h] of editors) {
    if (key === activeEditor) continue;
    h.hide();
  }
  const v = view();
  const done = v.jobs.filter(finished).length;
  const defs                                     = [
    ["all", "Pipeline", 0, ""],
    ["needs", "Needs you", waitingCount(v), ""],
    ["done", v.def.doneLabel, done, "ok"],
  ];
  $("filters").replaceChildren(
    ...defs.map(([id, label, n, cls]) => {
      const b = button(label, `tab${v.filter === id ? " on" : ""}`, () => {
        activeEditor = null;
        v.filter = id;
        renderAll();
      });
      if (n) b.append(el("span", `badge ${cls}`, String(n)));
      return b;
    }),
  );
  $("meta").textContent =
    `updated ${new Date().toLocaleTimeString()}`;
  showIcon();
}

function editorTab(key        , h                                 )              {
  const t = el("div", `btab etab${key === activeEditor ? " on" : ""}`);
  t.title = `Editing ${h.name}`;
  t.append(el("span", "ename", h.name));
  if (h.dirty()) t.append(el("span", "edot"));
  const x = button("×", "tabx", () => h.requestClose());
  x.setAttribute("aria-label", `Close ${h.name}`);
  x.onclick = (e) => {
    e.stopPropagation();
    focusEditor(key);
    h.requestClose();
  };
  t.append(x);
  t.onclick = () => focusEditor(key);
  return t;
}

function focusEditor(key        )       {
  const h = editors.get(key);
  if (!h) return;
  activeEditor = key;
  renderTabs();
  h.show();
}

// The tab icon follows the active board; an amber dot and a count in the title mean something waits on you.
function showIcon()       {
  const waiting = [...views.values()].reduce((n, v) => n + waitingCount(v), 0);
  const href = `/favicon-${active || "factory"}.svg?dot=${waiting ? 1 : 0}`;
  const link = document.getElementById("favicon");
  if (link && link.getAttribute("href") !== href)
    link.setAttribute("href", href);
  document.title = `${waiting ? `(${waiting}) ` : ""}Factory${active ? ` · ${view().def.label}` : ""}`;
}

// ---- canvas
function node(v      , s       , jobs       )              {
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
    const text = el("div");
    text.append(el("span", "", j.title));
    const now = j.activity?.at(-1)?.text;
    if (now) text.append(el("small", "", now));
    c.append(el("i"), text);
    c.onclick = () => openJobPanel(j.id);
    list.append(c);
  }
  n.append(h, el("p", "", s.blurb), list);
  return n;
}

const repoName = (j     )         => j.repo?.split("/").pop() ?? "";

// One lane per repo, each a single row of stages, so every repo's agent shows on its own.
// Jobs with no --repo share one lane, laid out as before.
function renderCanvas()       {
  const v = view();
  const repos = v.jobs.length ? [...new Set(v.jobs.map(repoName))].sort() : [""];
  const multi = repos.some(Boolean);
  const lanes = repos.map((repo) => {
    const mine = v.jobs.filter((j) => repoName(j) === repo && visible(v, j));
    const nodes = el("div", multi ? "nodes compact" : `nodes cols${v.def.columns}`);
    if (multi) nodes.style.gridTemplateColumns = `repeat(${v.def.stages.length}, 180px)`;
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
    lane.append(el("div", multi ? "rowlabel repo" : "rowlabel", repo || v.def.lane), nodes);
    return lane;
  });
  $("lanes").replaceChildren(...lanes);
  applyScale();
}

function renderAll()       {
  renderSidebar();
  renderTabs();
  renderCanvas();
  renderPanel();
  showEngine();
}

function applyScale()       {
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
  drawWires($("wires"), $("lanes"), scale);
}

// ---- side panel (Floorplan's structure: header, title, description, stats, titled sections)
const sec = (...kids                        )              => {
  const s = el("div", "sec");
  s.append(...kids.filter((k)                   => k !== null));
  return s;
};
const heading = (text        , count         )              => {
  const h = el("h3", "", text);
  if (count !== undefined) h.append(el("span", "c", String(count)));
  return h;
};
const stats = (...pairs                             )              => {
  const box = el("div", "stats");
  for (const [n, label] of pairs) {
    const d = el("div");
    d.append(el("b", "", String(n)), el("span", "", label));
    box.append(d);
  }
  return box;
};
const dotClass = (j     )         =>
  j.needs_human
    ? "warn"
    : j.gate === "FAIL" || Number(j.report?.BLOCKERS) > 0
      ? "bad"
      : finished(j)
        ? "done"
        : "ok";

function listRow(j     )                    {
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

// A change to the custom stages that an agent prepared. Nothing happens until the user clicks Apply.
function proposalBox(v      , p                               )              {
  const box = el("div", "callout");
  const order = el("div", "porder");
  for (const id of p.order[v.def.id] ?? []) {
    const label = v.baseStages.find((s) => s.id === id)?.label ?? id;
    order.append(el("span", `pchip${p.changed.includes(id) ? " new" : ""}`, label));
  }
  const msg = el("p", "pmsg", p.stale ? "The pipeline changed after this was prepared. Discard it and ask again." : "Nothing changes until you click Apply.");
  const act = async (action                             )                => {
    try {
      const res = await api(`/api/${v.def.id}/${action}`, { method: "POST", body: JSON.stringify({ id: "" }) });
      msg.textContent = res.ok ? "" : "Refused: the pipeline changed, or a job sits in a stage this removes.";
    } catch {
      msg.textContent = "offline";
    }
    await pollOne(v.def.id);
  };
  const apply = button("Apply", "btn go", () => void act("applypipe"));
  apply.disabled = p.stale;
  box.append(el("b", "", "Waiting for you"), ...p.ops.map((o) => el("p", "", o)), order, msg, row(apply, button("Discard", "btn", () => void act("discardpipe"))));
  return box;
}

function overview()                {
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
        [waiting.length, "need you"],
        [v.jobs.filter(finished).length, "done"],
      ),
    ),
    ...(v.proposal ? [sec(heading("Pipeline change"), proposalBox(v, v.proposal))] : []),
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
      heading("Jobs"),
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

function needsBox(n       , j     )              {
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

function skillsSection(j     )              {
  const v = view();
  const off = new Set(j.skills_off ?? []);
  const tag = (name        ) => {
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

function noteSection(j     )              {
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

const GIT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9c0 5-12 3-12 8"/></svg>';

function placeBox(where        )              {
  const box = el("div", "pp");
  const icon = el("span");
  icon.innerHTML = GIT_ICON;
  box.append(icon, el("span", "", where));
  return box;
}

function jobView(j     )                {
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
    const r = el("button", `lrow${editors.has(editorKey(v.def.id, j.id, f)) ? " on" : ""}`);
    r.type = "button";
    r.title = "Open in the editor";
    const t = el("div", "rt");
    t.append(el("div", "rn", f));
    r.append(el("span", "dot file"), t);
    r.onclick = () => void openFileEditor(f);
    return r;
  });
  const fileList = el("div", "list");
  fileList.append(...files);
  return [
    sec(
      ph,
      el("h2", "pt", j.title),
      el("p", `pd${last ? "" : " empty"}`, last ? `now: ${last.text}` : j.id),
      where ? placeBox(where) : null,
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
    sec(heading("Files", j.files.length), fileList),
  ];
}

function renderPanel()       {
  if (document.activeElement?.tagName === "TEXTAREA") return;
  const j = openJob();
  $("panel").replaceChildren(...(j ? jobView(j) : overview()));
}

                                               
async function readFile(board        , job        , name        )                           {
  try {
    const res = await api(
      `/api/${board}/file?job=${encodeURIComponent(job)}&name=${encodeURIComponent(name)}`,
    );
    return res.ok ? { text: await res.text(), base: res.headers.get("X-Base") ?? "" } : null;
  } catch {
    return null;
  }
}

const SAVE_ERRORS                         = {
  409: "The file changed on disk after you opened it. Reload, then edit again.",
  422: "Lines like STATUS: and VERDICT: steer the board. They cannot be edited here.",
  400: "That edit was refused.",
};

const editorKey = (board        , job        , name        )         => `${board}/${job}/${name}`;

async function openFileEditor(name        )                {
  const v = view();
  const board = v.def.id;
  const job = String(v.openId);
  const key = editorKey(board, job, name);
  if (editors.has(key)) return focusEditor(key);
  const file = await readFile(board, job, name);
  if (!file) return;
  const handle = openEditor({
    job,
    name,
    ...file,
    load: () => readFile(board, job, name),
    save: async (text, base) => {
      try {
        const res = await api(`/api/${board}/save`, {
          method: "POST",
          body: JSON.stringify({ id: job, name, base, text }),
        });
        if (!res.ok) return { ok: false, error: SAVE_ERRORS[res.status] ?? `Refused (${res.status}).` };
        return { ok: true, base: (await readFile(board, job, name))?.base ?? "" };
      } catch {
        return { ok: false, error: "offline" };
      }
    },
    comment: (text) => ask(text),
    back: () => {
      activeEditor = null;
      renderAll();
    },
    changed: renderTabs,
    closed: () => {
      editors.delete(key);
      if (activeEditor === key) activeEditor = null;
      renderAll();
    },
  });
  editors.set(key, { ...handle, name });
  focusEditor(key);
}

function openJobPanel(id        )       {
  const v = view();
  v.openId = id;
  document.body.classList.add("with-panel");
  renderAll();
}
function closeJob()       {
  view().openId = null;
  renderAll();
}

// ---- polling: every board, so the sidebar and tab badges stay live
const inflight = new Map                       ();
function pollOne(id        )                {
  const v = views.get(id);
  if (!v) return Promise.resolve();
  const p = inflight.get(id) ?? fetchJobs(v).finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

// Built-in stages keep their text from BUILD and REVIEW. A custom stage brings its own label and blurb.
function applyStages(v      , p               )       {
  const base = new Map(v.baseStages.map((s) => [s.id, s]));
  v.def.stages = p.order.flatMap((id) => {
    const custom = p.custom[id];
    const stage = base.get(id) ?? (custom ? { id, label: custom.label, blurb: custom.blurb } : null);
    return stage ? [stage] : [];
  });
  v.proposal = p.proposal;
}

async function fetchJobs(v      )                {
  try {
    const [res, sres] = await Promise.all([api(`/api/${v.def.id}/jobs`), api(`/api/${v.def.id}/stages`)]);
    if (!res.ok || !sres.ok) throw new Error(`status ${res.status}/${sres.status}`);
    const [text, stagesText] = [await res.text(), await sres.text()];
    const sig = `${text}\n${stagesText}`;
    if (sig === v.sig)
      return v.def.id === active ? renderTabs() : renderSidebar();
    v.sig = sig;
    // shortcut: the payloads are trusted, not validated, upgrade if the server stops being ours
    v.jobs = JSON.parse(text)         ;
    applyStages(v, JSON.parse(stagesText)                 );
    if (v.def.id === active) renderAll();
    else {
      renderSidebar();
      renderTabs();
    }
  } catch {
    $("meta").textContent = "offline, retrying";
  }
}
async function pollLoop()                {
  if (!document.hidden) await Promise.all([...views.keys()].map(pollOne));
  setTimeout(pollLoop, POLL_MS);
}

// ---- ask bar
let engineList           = ["claude"];
let modelChoices                           = {};
let engine = "claude";
const ENGINE_LABEL                         = {
  claude: "Claude Code",
  opencode: "OpenCode",
  kiro: "Kiro",
};
// Simple drawn marks, not the official logos: the page may not load outside images.
const ENGINE_ICON                         = {
  claude:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#d97757" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></g></svg>',
  kiro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#9046ff" d="M12 2.5c-4.4 0-7.5 3.3-7.5 7.9v8.6c0 1.2 1.3 1.8 2.2 1l1.5-1.3c.5-.4 1.2-.4 1.7 0l1.1 1c.6.5 1.4.5 2 0l1.1-1c.5-.4 1.2-.4 1.7 0l1.5 1.3c.9.8 2.2.2 2.2-1v-8.6c0-4.6-3.1-7.9-7.5-7.9z"/><circle cx="9.2" cy="10.5" r="1.3" fill="#fff"/><circle cx="14.8" cy="10.5" r="1.3" fill="#fff"/></svg>',
  opencode:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5 3h14v18H5V3zm4 4v10h6V7H9z"/></svg>',
};

const bubble = (cls        , text        , open = true, who = "")       => {
  if (open) $("ask-sheet").hidden = false;
  const line = el("div", cls);
  if (who) line.append(el("div", "botname", who));
  // The agent writes markdown. What you typed, and errors, stay as text.
  if (cls === "bot") line.append(renderMarkdown(text));
  else line.textContent = text;
  $("ask-log").append(line);
  $("ask-sheet").scrollTop = $("ask-sheet").scrollHeight;
};
// Bring back the saved chat after a reload. The log stays closed until you open it.
async function restoreChat()                {
  try {
    const turns                                                                                                   = await (await api("/api/chat")).json();
    for (const t of turns) {
      bubble("me", t.question, false);
      if (t.answer || t.error) bubble(t.error ? "err" : "bot", t.error || t.answer, false, t.mode === "act" && !t.error ? BOT_NAME : "");
    }
  } catch {
    // the log is a convenience; the board works without it
  }
}
$("ask-history").onclick = () => {
  $("ask-sheet").hidden = !$("ask-sheet").hidden;
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
$("ask-form").onsubmit = (e) => {
  e.preventDefault();
  const question = composer.value.trim();
  if (!question) return;
  composer.value = "";
  composer.style.height = "auto";
  void ask(question);
};

async function ask(question        )                  {
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
      mode,
    };
    const res = await api("/api/ask", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const out                                                        =
      await res.json();
    v.session = out.session ?? v.session;
    const reply = out.error ?? out.answer ?? "";
    bubble(out.error ? "err" : "bot", reply, true, mode === "act" && !out.error ? BOT_NAME : "");
    await pollOne(v.def.id);
    return reply;
  } catch {
    bubble("err", "offline");
    return "offline";
  }
}

// Chat answers and proposes. Act also applies the pipeline change it prepared, because choosing Act is the click.
                           
const BOT_NAME = "Factory Bot";
const MODE_KEY = "factory-ask-mode";
let mode       = (()       => {
  try {
    return localStorage.getItem(MODE_KEY) === "act" ? "act" : "chat";
  } catch {
    return "chat";
  }
})();
const MODE_HELP                       = {
  chat: "Chat: answers questions. Changes it prepares wait for your Apply click.",
  act: "Act: Factory Bot changes the board for you, such as adding or moving a stage.",
};

function showMode()       {
  $("modes").replaceChildren(
    ...(["chat", "act"]          ).map((m) => {
      const b = button(m === "chat" ? "Chat" : "Act", `mode${m === mode ? " on" : ""}`, () => {
        mode = m;
        try {
          localStorage.setItem(MODE_KEY, m);
        } catch {
          // the choice just is not remembered
        }
        showMode();
      });
      b.title = MODE_HELP[m];
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(m === mode));
      return b;
    }),
  );
  ($("ask-input")                       ).placeholder =
    mode === "act" ? "Tell Factory Bot what to change on the board" : "Ask anything. Say: skip qa-review, or turn off simplify";
}

function showEngine()       {
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

const EFFORT_BARS                         = {
  "": 0,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
  max: 4,
};

// A popup menu that opens above its button. Our own markup, so it never flickers the way a native select does.
                
                
                                              
                     
 
const openMenus = new Set            ();

function makeMenu(
  id        ,
  placeholder        ,
  options                                    ,
  onPick            ,
)       {
  const btn = $(`${id}-btn`);
  const pop = $(`${id}-pop`);
  const label = $(`${id}-label`);
  const menu       = { value: "", options, render };
  const close = ()       => {
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    openMenus.delete(close);
  };
  function render()       {
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

const showEffort = ()       => {
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
  if (!(e.target               ).closest(".menu"))
    for (const c of [...openMenus]) c();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (openMenus.size) {
    for (const c of [...openMenus]) c();
    return;
  }
  if (!$("ask-sheet").hidden) $("ask-sheet").hidden = true;
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
// The editor covers the board, so a board control first takes you back to the board.
const leaveEditor = ()          => {
  if (!activeEditor) return false;
  activeEditor = null;
  renderAll();
  return true;
};
$("panel-toggle").onclick = () => {
  if (leaveEditor()) return;
  document.body.classList.toggle("with-panel");
  applyScale();
};
$("side-toggle").onclick = () => {
  if (!leaveEditor()) setSide(!sideCollapsed);
};
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
async function start()                {
  try {
    const boards                                  = await (
      await api("/api/boards")
    ).json();
    for (const b of boards) {
      const def = DEFS[b.id];
      if (def)
        views.set(b.id, {
          def: { ...def, id: b.id, label: b.label },
          jobs: [],
          openId: null,
          filter: "all",
          userZoom: null,
          sig: "",
          session: "",
          skillsOpen: false,
          baseStages: def.stages,
          proposal: null,
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
    ? (saved?.active          )
    : (openTabs[0] ?? "");
  document.body.classList.add("with-panel");
  setSide(saved?.sideCollapsed ?? false);
  showMode();
  void restoreChat();
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
