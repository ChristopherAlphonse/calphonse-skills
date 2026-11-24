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
const POLL_MS = 2000;
                                    

const $ = (id        )              => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};
const state        = { jobs: [], openId: null, openFile: null, lastSig: "", loadToken: 0 };
let tab      = "all";
let userZoom                = null;
let scale = 1;
let session = "";
let engineList           = ["claude"];
let modelChoices                           = {};
let engine = "claude";
const ENGINE_LABEL                         = { claude: "Claude Code", opencode: "OpenCode", kiro: "Kiro" };
// Simple drawn marks, not the official logos: the page may not load outside images.
const ENGINE_ICON                         = {
  claude:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#d97757" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></g></svg>',
  kiro:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#9046ff" d="M12 2.5c-4.4 0-7.5 3.3-7.5 7.9v8.6c0 1.2 1.3 1.8 2.2 1l1.5-1.3c.5-.4 1.2-.4 1.700 0l1.100 1c.6.5 1.400.5 2 0l1.100-1c.5-.4 1.200-.4 1.700 0l1.500 1.300c.9.800 2.200.2 2.200-1v-8.600c0-4.600-3.100-7.900-7.500-7.900z"/><circle cx="9.200" cy="10.500" r="1.300" fill="#fff"/><circle cx="14.800" cy="10.500" r="1.300" fill="#fff"/></svg>',
  opencode:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5 3h14v18H5V3zm4 4v10h6V7H9z"/></svg>',
};

const api = (path        , opts                                     = {}) =>
  fetch(path, { ...opts, credentials: "same-origin", headers: { "X-Factory": "1" } });

const openJob = ()                  => state.jobs.find((j) => j.id === state.openId);
const stageOf = (j     )         => {
  const s = j.stage === "needs-human" ? (j.parked_from ?? "build") : j.stage;
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
  const mine = state.jobs.filter(visible);
  const wrap = el("div", "lane");
  const nodes = el("div", "nodes");
  nodes.append(...BUILD.map((s) => node(s, mine.filter((j) => stageOf(j) === s.id))));
  wrap.append(el("div", "rowlabel", "Build jobs"), nodes);
  const rows                = [wrap];
  $("lanes").replaceChildren(...rows);
  applyScale();
  renderPanel();
}

function applyScale()       {
  const lanes = $("lanes");
  const canvas = $("canvas");
  const rowsEl = $("rows");
  rowsEl.style.transform = "none";
  const w = lanes.offsetWidth;
  const h = lanes.offsetHeight;
  const fit = Math.min(1, (canvas.clientWidth - 56) / w, (canvas.clientHeight - 200) / h);
  scale = userZoom ?? Math.max(0.3, fit);
  rowsEl.style.transform = `scale(${scale})`;
  $("stage").style.width = `${w * scale}px`;
  $("stage").style.height = `${h * scale}px`;
  drawWires();
}

                           
// A right-angle route with rounded corners, like Floorplan's connectors.
function routed(pts      , radius = 12)         {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const r = Math.min(radius, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2);
    const inLen = Math.hypot(cx - px, cy - py) || 1;
    const outLen = Math.hypot(nx - cx, ny - cy) || 1;
    d += ` L${cx - ((cx - px) / inLen) * r},${cy - ((cy - py) / inLen) * r} Q${cx},${cy} ${cx + ((nx - cx) / outLen) * r},${cy + ((ny - cy) / outLen) * r}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

function drawWires()       {
  const svg = $("wires");
  const base = $("lanes").getBoundingClientRect();
  const ns = "http://www.w3.org/2000/svg";
  const at = (r         ) => ({ l: (r.left - base.left) / scale, r: (r.right - base.left) / scale, t: (r.top - base.top) / scale, b: (r.bottom - base.top) / scale });
  const shapes               = [];
  const mk =                                       (tag   , attrs                        , cls        )                          => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.setAttribute("class", cls);
    return e;
  };
  for (const nodes of document.querySelectorAll             (".nodes")) {
    const cards = [...nodes.children]                 ;
    for (let i = 0; i + 1 < cards.length; i++) {
      const a = at(cards[i].getBoundingClientRect());
      const b = at(cards[i + 1].getBoundingClientRect());
      const lit = cards[i].classList.contains("lit") ? " lit" : "";
      const y1 = (a.t + a.b) / 2;
      const y2 = (b.t + b.b) / 2;
      const wrap = b.t > a.b;
      const route       = wrap
        ? [[a.r, y1], [a.r + 28, y1], [a.r + 28, (a.b + b.t) / 2], [b.l - 28, (a.b + b.t) / 2], [b.l - 28, y2], [b.l, y2]]
        : [[a.r, y1], [(a.r + b.l) / 2, y1], [(a.r + b.l) / 2, y2], [b.l, y2]];
      shapes.push(mk("path", { d: routed(route) }, `wire${lit}`));
      for (const [cx, cy] of [route[0], route[route.length - 1]]) shapes.push(mk("circle", { cx: String(cx), cy: String(cy), r: "4.5" }, `port${lit}`));
    }
  }
  svg.setAttribute("width", String(base.width / scale));
  svg.setAttribute("height", String(base.height / scale));
  svg.replaceChildren(...shapes);
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
const finished = (j     )          => ["ready", "rejected"].includes(j.stage);
const dotClass = (j     )         => (j.needs_human ? "warn" : j.gate === "FAIL" ? "bad" : finished(j) ? "done" : "ok");

function listRow(j     )                    {
  const r = el("button", "lrow");
  r.type = "button";
  const t = el("div", "rt");
  t.append(el("div", "rn", j.title), el("div", "rd", `${j.id} at ${j.stage}${j.needs_human ? ", waiting on you" : ""}`));
  r.append(el("span", `dot ${dotClass(j)}`), t, el("span", "rc", `${j.files.length} files`));
  r.onclick = () => openJobPanel(j.id);
  return r;
}

function overview()                {
  const waiting = state.jobs.filter((j) => j.needs_human);
  const ph = el("div", "ph");
  ph.append(el("span", "ico", "▦"), el("span", "kindlabel", "Pipeline"));
  const list = state.jobs.filter(visible).map(listRow);
  const jobList = el("div", "list");
  jobList.append(...list);
  return [
    sec(
      ph,
      el("h2", "pt", "Factory"),
      el("p", "pd", "Local only. Nothing is pushed, and nothing is committed until you click."),
      el("div", "gap"),
      stats([state.jobs.length, "jobs"], [waiting.length, "need you"], [state.jobs.filter(finished).length, "ready"]),
    ),
    ...(waiting.length
      ? [sec(heading("Needs you", waiting.length), ...waiting.map((j) => {
          const c = el("button", "callout");
          c.type = "button";
          c.append(el("b", "", j.title), el("span", "", j.needs?.action ?? "Open"));
          c.onclick = () => openJobPanel(j.id);
          return c;
        }))]
      : []),
    sec(heading("Jobs", list.length), list.length ? jobList : el("p", "pd empty", "No jobs yet. Ask an agent to run the factory, or type below.")),
  ];
}

function needsBox(n       , j     )              {
  const box = el("div", "callout amber");
  box.append(el("b", "", `Needs you: ${n.action}`), el("p", "", n.why), el("p", "", n.todo));
  const path = j.can_approve ? "/api/approve" : j.can_commit ? "/api/commit" : "/api/unblock";
  box.append(button(n.action, "btn", () => post(path, { id: j.id })));
  return box;
}

let skillsOpen = false;
function skillsSection(j     )              {
  const off = new Set(j.skills_off ?? []);
  const tag = (name        ) => {
    const t = el("button", `tag${off.has(name) ? " off" : ""}`, name);
    t.type = "button";
    t.title = off.has(name) ? "Off for this job. Click to use it again." : "Click to stop using this skill on this job.";
    t.onclick = () => post("/api/skill", { id: j.id, name, off: !off.has(name) });
    return t;
  };
  const tagBox = el("div", "tags");
  tagBox.append(...(skillsOpen ? j.skills : j.skills.filter((n) => off.has(n))).map(tag));
  if (!skillsOpen && !off.size) tagBox.append(el("span", "pd empty", "All skills on"));
  const toggle = button(skillsOpen ? "Hide list" : "Choose skills", "btn ghost small", () => {
    skillsOpen = !skillsOpen;
    renderPanel();
  });
  return sec(heading("Skills", off.size), tagBox, el("div", "actions").appendChild(toggle).parentElement               );
}

function noteSection(j     )              {
  const note = el("textarea");
  note.rows = 2;
  note.placeholder = `Note for the ${j.stage} stage. The next agent follows it.`;
  note.value = j.briefs?.[j.stage] ?? "";
  const actions = el("div", "actions");
  actions.append(button("Save note", "btn ghost", () => post("/api/brief", { id: j.id, stage: j.stage, text: note.value })));
  return sec(heading("Stage note"), note, actions);
}

function statusChips(j     )                {
  const rows                = [];
  const chips                = [];
  if (j.stage === "gate" || j.gate) chips.push(chip(`gate ${j.gate || "pending"}`, j.gate || ""));
  if (j.commit) chips.push(chip(`committed locally ${j.commit.slice(0, 7)}`, "PASS"));
  if (chips.length) rows.push(row(...chips));
  if (j.stack?.length) rows.push(row(...j.stack.map((k) => chip(k))));
  if (j.stage === "review") rows.push(row(...Object.entries(j.reviews).map(([name, v]) => chip(v ? `${name} ${v}` : `${name} ...`, v ?? ""))));
  return rows;
}

function jobView(j     )                {
  const ph = el("div", "ph");
  ph.append(button("←", "iconbtn", closeJob), el("span", "kindlabel", "Build job"));
  const [done, total] = j.progress;
  const last = j.activity?.at(-1);
  const where = j.branch ?? j.worktree;
  const pp = where ? el("div", "pp", where) : null;
  const files = j.files.map((f) => {
    const r = el("button", `lrow${f === state.openFile ? " on" : ""}`);
    r.type = "button";
    const t = el("div", "rt");
    t.append(el("div", "rn", f));
    r.append(el("span", "dot file"), t);
    r.onclick = () => {
      state.openFile = f;
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
      pp,
      el("div", "gap"),
      stats([!j.round ? "-" : `${j.round}/${j.round_limit}`, "round"], [total ? `${done}/${total}` : "-", "tasks"], [j.files.length, "files"]),
    ),
    ...(j.needs ? [sec(needsBox(j.needs, j))] : []),
    ...(statusChips(j).length ? [sec(heading("Status"), ...statusChips(j))] : []),
    skillsSection(j),
    noteSection(j),
    sec(heading("Files", j.files.length), fileList, body),
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
    const res = await api("/api/ask", { method: "POST", body: JSON.stringify({ id: state.openId ?? "", question, session, engine, model: ($("model")                     ).value, effort: ($("effort")                     ).value }) });
    const out                                                        = await res.json();
    session = out.session ?? session;
    bubble(out.error ? "err" : "bot", out.error ?? out.answer ?? "");
  } catch {
    bubble("err", "offline");
  }
  await poll();
};

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
      b.append(icon, ...(name === engine ? [el("span", "", ENGINE_LABEL[name] ?? name)] : []));
      b.onclick = () => {
        engine = name;
        session = "";
        showEngine();
      };
      return b;
    }),
  );
  const model = $("model")                     ;
  model.replaceChildren(...["", ...(modelChoices[engine] ?? [])].map((m) => {
    const o = el("option", "", m || "model");
    o.value = m;
    return o;
  }));
  $("model-wrap").hidden = !modelChoices[engine]?.length;
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

$("zoom-in").onclick = () => {
  userZoom = Math.min(2, scale * 1.2);
  applyScale();
};
$("zoom-out").onclick = () => {
  userZoom = Math.max(0.3, scale / 1.2);
  applyScale();
};
$("zoom-fit").onclick = () => {
  userZoom = null;
  applyScale();
};
const EFFORT_BARS                         = { "": 0, low: 1, medium: 2, high: 3, xhigh: 4, max: 4 };
const showEffort = ()       => {
  const level = EFFORT_BARS[($("effort")                     ).value] ?? 0;
  document.querySelectorAll("#effort-icon .b").forEach((bar, i) => bar.classList.toggle("on", i < level));
};
$("effort").onchange = showEffort;
showEffort();

$("panel-toggle").onclick = () => {
  document.body.classList.toggle("with-panel");
  applyScale();
};
document.body.classList.add("with-panel");
window.addEventListener("resize", applyScale);
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) await poll();
});
await pollLoop();
