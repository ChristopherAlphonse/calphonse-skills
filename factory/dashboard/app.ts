import {
  initializeAsk,
  requestAnswer,
  restoreChat,
  setAvailableEngines,
  showEngine,
  showMode,
} from "/static/ask.js";
import { BOARD_DEFINITIONS } from "/static/boards.js";
import { createButton, createChip, createChipRow, createElement, requireElement } from "/static/dom.js";
import { openEditor, type EditorHandle } from "/static/editor.js";
import {
  isRecord,
  isStringArray,
  parseBoards,
  parseEngines,
  parseJobs,
  parseJson,
  parseStages,
  request,
} from "/static/payloads.js";
import { drawWires } from "/static/wires.js";
import type {
  BoardView,
  Filter,
  Job,
  Needs,
  Stage,
  StagesPayload,
} from "/static/types.js";

const POLL_INTERVAL_MS = 2000;
const LAYOUT_STORAGE_KEY = "factory.board";
const CANVAS_HORIZONTAL_PADDING = 56;
const CANVAS_VERTICAL_PADDING = 200;

// ---- state: one View per board, plus which boards are open as tabs
const viewsByBoardId = new Map<string, BoardView>();
let boardOrder: string[] = [];
let openBoardIds: string[] = [];
let activeBoardId: string | null = null;
type TabbedEditor = EditorHandle & { fileName: string };
const editorsByKey = new Map<string, TabbedEditor>();
let activeEditorKey: string | null = null;
let currentScale = 1;
let sidebarCollapsed = false;

function currentView(): BoardView {
  if (!activeBoardId) throw new Error("no active board");
  const boardView = viewsByBoardId.get(activeBoardId);
  if (!boardView) throw new Error(`unknown active board: ${activeBoardId}`);
  return boardView;
}

function currentJob(): Job | undefined {
  const boardView = currentView();
  return boardView.jobs.find((job) => job.id === boardView.openId);
}

// The persisted keys stay terse so a layout saved by an older page still loads.
interface StoredLayout {
  order: string[];
  openTabs: string[];
  active: string;
  sideCollapsed: boolean;
}

function saveLayout(): void {
  const layout: StoredLayout = {
    order: boardOrder,
    openTabs: openBoardIds,
    active: activeBoardId ?? "",
    sideCollapsed: sidebarCollapsed,
  };
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // private window or blocked storage: the layout just is not remembered
  }
}

function restoreLayout(): StoredLayout | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "null");
    if (!isRecord(raw)
      || !isStringArray(raw.order)
      || !isStringArray(raw.openTabs)
      || typeof raw.active !== "string"
      || typeof raw.sideCollapsed !== "boolean") return null;
    return {
      order: raw.order,
      openTabs: raw.openTabs,
      active: raw.active,
      sideCollapsed: raw.sideCollapsed,
    };
  } catch {
    return null;
  }
}

async function postAction(action: string, body: Record<string, unknown>): Promise<void> {
  try {
    const response = await request(`/api/${activeBoardId}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok) requireElement("meta").textContent = `Refused: ${action} (${response.status})`;
  } catch {
    requireElement("meta").textContent = "offline";
  }
  await pollBoard(activeBoardId);
}

function stageIdFor(boardView: BoardView, job: Job): string {
  if (job.stage === "needs-human") return job.parkedFrom ?? boardView.definition.homeStage;
  if (job.stage === "gate") return "build";
  if (job.stage === "rejected") return "ready";
  return job.stage;
}

function isFinished(job: Job): boolean {
  return job.stage === "ready" || job.stage === "rejected";
}

function isVisible(boardView: BoardView, job: Job): boolean {
  if (boardView.filter === "needs") return job.needs !== null;
  if (boardView.filter === "done") return isFinished(job);
  return true;
}

function needsHumanCount(boardView: BoardView): number {
  return boardView.jobs.filter((job) => job.needs !== null).length;
}

// ---- left sidebar: every board, draggable into the tab strip
function boardIcon(boardId: string): HTMLElement {
  const icon = createElement("span", "bico");
  icon.innerHTML = BOARD_DEFINITIONS[boardId]?.icon ?? "";
  return icon;
}

function renderSidebar(): void {
  const list = requireElement("boardlist");
  list.replaceChildren(
    ...boardOrder.map((boardId) => {
      const boardView = viewsByBoardId.get(boardId);
      if (!boardView) return createElement("span");
      const rowButton = createElement(
        "button",
        `boardrow${boardId === activeBoardId ? " on" : ""}${openBoardIds.includes(boardId) ? " open" : ""}`,
      );
      rowButton.type = "button";
      rowButton.draggable = true;
      rowButton.dataset.board = boardId;
      rowButton.title = `${boardView.definition.label}: ${boardView.definition.blurb}`;
      const labelBox = createElement("span", "btext");
      labelBox.append(
        createElement("b", "", boardView.definition.label),
        createElement("small", "", boardView.definition.blurb),
      );
      rowButton.append(boardIcon(boardId), labelBox);
      const waitingJobCount = needsHumanCount(boardView);
      if (waitingJobCount) rowButton.append(createElement("span", "badge", String(waitingJobCount)));
      rowButton.onclick = () => openBoard(boardId);
      rowButton.ondragstart = (event) => dragStart(event, boardId);
      rowButton.ondragend = dragEnd;
      rowButton.ondragover = (event) => event.preventDefault();
      rowButton.ondrop = (event) => {
        event.preventDefault();
        const fromBoardId = event.dataTransfer?.getData("text/plain") ?? "";
        if (fromBoardId && fromBoardId !== boardId && viewsByBoardId.has(fromBoardId)) {
          boardOrder = boardOrder.filter((id) => id !== fromBoardId);
          boardOrder.splice(boardOrder.indexOf(boardId), 0, fromBoardId);
          saveLayout();
          renderSidebar();
        }
      };
      return rowButton;
    }),
  );
}

function setSidebarCollapsed(collapsed: boolean): void {
  sidebarCollapsed = collapsed;
  document.body.classList.toggle("side-collapsed", collapsed);
  requireElement("side-toggle").setAttribute("aria-expanded", String(!collapsed));
  saveLayout();
  applyScale();
}

// ---- drag and drop
function dragStart(event: DragEvent, boardId: string): void {
  event.dataTransfer?.setData("text/plain", boardId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  document.body.classList.add("dragging");
  if (event.target instanceof HTMLElement) event.target.classList.add("drag");
}

function dragEnd(event: DragEvent): void {
  document.body.classList.remove("dragging");
  if (event.target instanceof HTMLElement) event.target.classList.remove("drag");
  requireElement("boardtabs").classList.remove("over");
}

function dropTabIndex(clientX: number): number {
  const tabs = [...requireElement("boardtabs").querySelectorAll<HTMLElement>(".btab")];
  const index = tabs.findIndex((tab) => clientX < tab.getBoundingClientRect().left + tab.offsetWidth / 2);
  return index < 0 ? tabs.length : index;
}

function dropOnTabs(event: DragEvent): void {
  event.preventDefault();
  document.body.classList.remove("dragging");
  const boardId = event.dataTransfer?.getData("text/plain") ?? "";
  if (!viewsByBoardId.has(boardId)) return;
  const targetIndex = dropTabIndex(event.clientX);
  const previousIndex = openBoardIds.indexOf(boardId);
  openBoardIds = openBoardIds.filter((id) => id !== boardId);
  openBoardIds.splice(previousIndex >= 0 && previousIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, boardId);
  activeBoardId = boardId;
  activeEditorKey = null;
  saveLayout();
  renderAll();
}

// ---- tabs and filters
function openBoard(boardId: string): void {
  if (!viewsByBoardId.has(boardId)) return;
  if (!openBoardIds.includes(boardId)) openBoardIds.push(boardId);
  activeBoardId = boardId;
  activeEditorKey = null;
  saveLayout();
  renderAll();
}

function closeBoard(boardId: string): void {
  if (openBoardIds.length < 2) return;
  const closedIndex = openBoardIds.indexOf(boardId);
  openBoardIds = openBoardIds.filter((id) => id !== boardId);
  if (activeBoardId === boardId) activeBoardId = openBoardIds[Math.min(closedIndex, openBoardIds.length - 1)];
  activeEditorKey = null;
  saveLayout();
  renderAll();
}

function renderEditorTab(key: string, handle: TabbedEditor): HTMLElement {
  const tab = createElement("div", `btab etab${key === activeEditorKey ? " on" : ""}`);
  tab.title = `Editing ${handle.fileName}`;
  tab.append(createElement("span", "ename", handle.fileName));
  if (handle.dirty()) tab.append(createElement("span", "edot"));
  const closeButton = createButton("×", "tabx", () => handle.requestClose());
  closeButton.setAttribute("aria-label", `Close ${handle.fileName}`);
  closeButton.onclick = (event) => {
    event.stopPropagation();
    focusEditor(key);
    handle.requestClose();
  };
  tab.append(closeButton);
  tab.onclick = () => focusEditor(key);
  return tab;
}

function renderTabs(): void {
  const strip = requireElement("boardtabs");
  strip.replaceChildren(
    ...openBoardIds.map((boardId) => {
      const boardView = viewsByBoardId.get(boardId);
      if (!boardView) return createElement("span");
      const tab = createElement("div", `btab${boardId === activeBoardId && !activeEditorKey ? " on" : ""}`);
      tab.draggable = true;
      tab.dataset.board = boardId;
      tab.append(boardIcon(boardId), createElement("span", "", boardView.definition.label));
      const waitingJobCount = needsHumanCount(boardView);
      if (waitingJobCount) tab.append(createElement("span", "badge", String(waitingJobCount)));
      if (openBoardIds.length > 1) {
        const closeButton = createButton("×", "tabx", () => closeBoard(boardId));
        closeButton.setAttribute("aria-label", `Close ${boardView.definition.label}`);
        closeButton.onclick = (event) => {
          event.stopPropagation();
          closeBoard(boardId);
        };
        tab.append(closeButton);
      }
      tab.onclick = () => openBoard(boardId);
      tab.ondragstart = (event) => dragStart(event, boardId);
      tab.ondragend = dragEnd;
      return tab;
    }),
    ...[...editorsByKey].map(([key, handle]) => renderEditorTab(key, handle)),
  );
  for (const [key, handle] of editorsByKey) {
    if (key === activeEditorKey) continue;
    handle.hide();
  }
  const boardView = currentView();
  const finishedJobCount = boardView.jobs.filter(isFinished).length;
  const filterDefinitions: [Filter, string, number, string][] = [
    ["all", "Pipeline", 0, ""],
    ["needs", "Needs you", needsHumanCount(boardView), ""],
    ["done", boardView.definition.doneLabel, finishedJobCount, "ok"],
  ];
  requireElement("filters").replaceChildren(
    ...filterDefinitions.map(([id, label, count, className]) => {
      const filterButton = createButton(label, `tab${boardView.filter === id ? " on" : ""}`, () => {
        activeEditorKey = null;
        boardView.filter = id;
        renderAll();
      });
      if (count) filterButton.append(createElement("span", `badge ${className}`, String(count)));
      return filterButton;
    }),
  );
  requireElement("meta").textContent = `updated ${new Date().toLocaleTimeString()}`;
  updateFaviconAndTitle();
}

function focusEditor(key: string): void {
  const handle = editorsByKey.get(key);
  if (!handle) return;
  activeEditorKey = key;
  renderTabs();
  handle.show();
}

// The tab icon follows the active board; an amber dot and a count in the title mean something waits on you.
function updateFaviconAndTitle(): void {
  const waitingJobCount = [...viewsByBoardId.values()].reduce(
    (total, boardView) => total + needsHumanCount(boardView),
    0,
  );
  const faviconHref = `/favicon-${activeBoardId || "factory"}.svg?dot=${waitingJobCount ? 1 : 0}`;
  const faviconLink = document.getElementById("favicon");
  if (faviconLink && faviconLink.getAttribute("href") !== faviconHref) faviconLink.setAttribute("href", faviconHref);
  document.title = `${waitingJobCount ? `(${waitingJobCount}) ` : ""}Factory${activeBoardId ? ` · ${currentView().definition.label}` : ""}`;
}

// ---- canvas
function renderStageNode(boardView: BoardView, stage: Stage, jobs: Job[]): HTMLElement {
  const hasWaitingJob = jobs.some((job) => job.needs !== null);
  const node = createElement("section", `node${jobs.length ? " lit" : ""}${hasWaitingJob ? " hold" : ""}`);
  node.dataset.stage = stage.id;
  const heading = createElement("h3", "", stage.label);
  heading.append(createElement("span", "", jobs.length ? String(jobs.length) : ""));
  const jobList = createElement("div", "jobs");
  for (const job of jobs) {
    const hasFailure = Number(job.report.BLOCKERS) > 0 || job.gate === "FAIL";
    const jobButton = createElement(
      "button",
      `jobchip${job.needs !== null ? " hold" : ""}${hasFailure ? " FAIL" : ""}${job.id === boardView.openId ? " on" : ""}`,
    );
    jobButton.type = "button";
    const jobText = createElement("div");
    jobText.append(createElement("span", "", job.title));
    const latestActivity = job.activity?.at(-1)?.text;
    if (latestActivity) jobText.append(createElement("small", "", latestActivity));
    jobButton.append(createElement("i"), jobText);
    jobButton.onclick = () => selectJob(job.id);
    jobList.append(jobButton);
  }
  node.append(heading, createElement("p", "", stage.blurb), jobList);
  return node;
}

function repoLabel(job: Job): string {
  return job.repo?.split("/").pop() ?? "";
}

// One lane per repo, each a single row of stages, so every repo's agent shows on its own.
// Jobs with no --repo share one lane, laid out as before.
function renderCanvas(): void {
  const boardView = currentView();
  const repoNames = boardView.jobs.length ? [...new Set(boardView.jobs.map(repoLabel))].sort() : [""];
  const showRepoLabels = repoNames.some(Boolean);
  const lanes = repoNames.map((repoName) => {
    const repoJobs = boardView.jobs.filter((job) => repoLabel(job) === repoName && isVisible(boardView, job));
    const stageRow = createElement("div", showRepoLabels ? "nodes compact" : `nodes cols${boardView.definition.columns}`);
    if (showRepoLabels) stageRow.style.gridTemplateColumns = `repeat(${boardView.definition.stages.length}, 180px)`;
    stageRow.append(
      ...boardView.definition.stages.map((stage) =>
        renderStageNode(boardView, stage, repoJobs.filter((job) => stageIdFor(boardView, job) === stage.id)),
      ),
    );
    const lane = createElement("div", "lane");
    lane.append(
      createElement("div", showRepoLabels ? "rowlabel repo" : "rowlabel", repoName || boardView.definition.lane),
      stageRow,
    );
    return lane;
  });
  requireElement("lanes").replaceChildren(...lanes);
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
  if (!activeBoardId) return;
  const boardView = currentView();
  const lanes = requireElement("lanes");
  const canvas = requireElement("canvas");
  const rows = requireElement("rows");
  rows.style.transform = "none";
  const contentWidth = lanes.offsetWidth;
  const contentHeight = lanes.offsetHeight;
  const fitScale = Math.min(
    1,
    (canvas.clientWidth - CANVAS_HORIZONTAL_PADDING) / contentWidth,
    (canvas.clientHeight - CANVAS_VERTICAL_PADDING) / contentHeight,
  );
  currentScale = boardView.zoomOverride ?? Math.max(0.3, fitScale);
  rows.style.transform = `scale(${currentScale})`;
  requireElement("stage").style.width = `${contentWidth * currentScale}px`;
  requireElement("stage").style.height = `${contentHeight * currentScale}px`;
  drawWires(requireElement("wires"), lanes, currentScale);
}

// ---- side panel (Floorplan's structure: header, title, description, stats, titled sections)
function createSection(...children: (HTMLElement | null)[]): HTMLElement {
  const section = createElement("div", "sec");
  section.append(...children.filter((child): child is HTMLElement => child !== null));
  return section;
}

function createHeading(text: string, count?: number): HTMLElement {
  const heading = createElement("h3", "", text);
  if (count !== undefined) heading.append(createElement("span", "c", String(count)));
  return heading;
}

function createStats(...pairs: [string | number, string][]): HTMLElement {
  const box = createElement("div", "stats");
  for (const [value, label] of pairs) {
    const stat = createElement("div");
    stat.append(createElement("b", "", String(value)), createElement("span", "", label));
    box.append(stat);
  }
  return box;
}

function stateClass(job: Job): string {
  if (job.needs !== null) return "warn";
  if (job.gate === "FAIL" || Number(job.report.BLOCKERS) > 0) return "bad";
  if (isFinished(job)) return "done";
  return "ok";
}

function createListRow(job: Job): HTMLButtonElement {
  const rowButton = createElement("button", "lrow");
  rowButton.type = "button";
  const text = createElement("div", "rt");
  text.append(
    createElement("div", "rn", job.title),
    createElement("div", "rd", `${job.id} at ${job.stage}${job.needs !== null ? ", waiting on you" : ""}`),
  );
  rowButton.append(
    createElement("span", `dot ${stateClass(job)}`),
    text,
    createElement("span", "rc", `${job.files.length} files`),
  );
  rowButton.onclick = () => selectJob(job.id);
  return rowButton;
}

// A change to the custom stages that an agent prepared. Nothing happens until the user clicks Apply.
function createProposalBox(boardView: BoardView, proposal: NonNullable<BoardView["proposal"]>): HTMLElement {
  const box = createElement("div", "callout");
  const orderStrip = createElement("div", "porder");
  for (const stageId of proposal.stageOrderByBoard[boardView.definition.id] ?? []) {
    const label = boardView.builtInStages.find((stage) => stage.id === stageId)?.label ?? stageId;
    orderStrip.append(createElement("span", `pchip${proposal.changedStageIds.includes(stageId) ? " new" : ""}`, label));
  }
  const message = createElement("p", "pmsg", proposal.isStale
    ? "The pipeline changed after this was prepared. Discard it and ask again."
    : "Nothing changes until you click Apply.");
  const runAction = async (action: "applypipe" | "discardpipe"): Promise<void> => {
    try {
      const response = await request(`/api/${boardView.definition.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ id: "" }),
      });
      message.textContent = response.ok ? "" : "Refused: the pipeline changed, or a job sits in a stage this removes.";
    } catch {
      message.textContent = "offline";
    }
    await pollBoard(boardView.definition.id);
  };
  const applyButton = createButton("Apply", "btn go", () => void runAction("applypipe"));
  applyButton.disabled = proposal.isStale;
  box.append(
    createElement("b", "", "Waiting for you"),
    ...proposal.operations.map((operation) => createElement("p", "", operation)),
    orderStrip,
    message,
    createChipRow(applyButton, createButton("Discard", "btn", () => void runAction("discardpipe"))),
  );
  return box;
}

function renderOverview(): HTMLElement[] {
  const boardView = currentView();
  const waitingJobs = boardView.jobs.filter((job) => job.needs !== null);
  const header = createElement("div", "ph");
  header.append(boardIcon(boardView.definition.id), createElement("span", "kindlabel", "Board"));
  const jobList = createElement("div", "list");
  const visibleJobs = boardView.jobs.filter((job) => isVisible(boardView, job));
  jobList.append(...visibleJobs.map(createListRow));
  return [
    createSection(
      header,
      createElement("h2", "pt", boardView.definition.label),
      createElement("p", "pd", boardView.definition.intro),
      createElement("div", "gap"),
      createStats(
        [waitingJobs.length, "need you"],
        [boardView.jobs.filter(isFinished).length, "done"],
      ),
    ),
    ...(boardView.proposal
      ? [createSection(createHeading("Pipeline change"), createProposalBox(boardView, boardView.proposal))]
      : []),
    ...(waitingJobs.length
      ? [
          createSection(
            createHeading("Needs you", waitingJobs.length),
            ...waitingJobs.map((job) => {
              const callout = createElement("button", "callout");
              callout.type = "button";
              callout.append(
                createElement("b", "", job.title),
                createElement("span", "", job.needs?.action ?? "Open"),
              );
              callout.onclick = () => selectJob(job.id);
              return callout;
            }),
          ),
        ]
      : []),
    createSection(
      createHeading("Jobs"),
      visibleJobs.length
        ? jobList
        : createElement("p", "pd empty", "No jobs yet. Ask an agent to run it, or type below."),
    ),
  ];
}

function createNeedsCallout(needs: Needs, job: Job): HTMLElement {
  const box = createElement("div", "callout amber");
  box.append(
    createElement("b", "", `Needs you: ${needs.action}`),
    createElement("p", "", needs.why),
    createElement("p", "", needs.todo),
  );
  box.append(
    createButton(needs.action, "btn", () => void postAction(currentView().definition.humanActionPath(job), { id: job.id })),
  );
  return box;
}

function renderSkillsSection(job: Job): HTMLElement {
  const boardView = currentView();
  const disabledSkills = new Set(job.skillsOff ?? []);
  const createTag = (skillName: string): HTMLButtonElement => {
    const tagButton = createElement("button", `tag${disabledSkills.has(skillName) ? " off" : ""}`, skillName);
    tagButton.type = "button";
    tagButton.title = disabledSkills.has(skillName)
      ? "Off for this job. Click to use it again."
      : "Click to stop using this skill on this job.";
    tagButton.onclick = () => void postAction("skill", { id: job.id, name: skillName, off: !disabledSkills.has(skillName) });
    return tagButton;
  };
  const tagContainer = createElement("div", "tags");
  tagContainer.append(
    ...(boardView.showAllSkills ? job.skills : job.skills.filter((name) => disabledSkills.has(name))).map(createTag),
  );
  if (!boardView.showAllSkills && !disabledSkills.size) {
    tagContainer.append(createElement("span", "pd empty", "All skills on"));
  }
  const actionRow = createElement("div", "actions");
  actionRow.append(
    createButton(
      boardView.showAllSkills ? "Hide list" : "Choose skills",
      "btn ghost small",
      () => {
        boardView.showAllSkills = !boardView.showAllSkills;
        renderPanel();
      },
    ),
  );
  return createSection(createHeading("Skills", disabledSkills.size), tagContainer, actionRow);
}

function renderStageNote(job: Job): HTMLElement {
  const noteInput = createElement("textarea");
  noteInput.rows = 2;
  noteInput.placeholder = `Note for the ${job.stage} stage. The next agent follows it.`;
  noteInput.value = job.briefs?.[job.stage] ?? "";
  const actionRow = createElement("div", "actions");
  actionRow.append(
    createButton("Save note", "btn ghost", () =>
      void postAction("brief", { id: job.id, stage: job.stage, text: noteInput.value }),
    ),
  );
  return createSection(createHeading("Stage note"), noteInput, actionRow);
}

const GIT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9c0 5-12 3-12 8"/></svg>';

function createPlaceBox(where: string): HTMLElement {
  const box = createElement("div", "pp");
  const icon = createElement("span");
  icon.innerHTML = GIT_ICON;
  box.append(icon, createElement("span", "", where));
  return box;
}

function renderJobView(job: Job): HTMLElement[] {
  const boardView = currentView();
  const header = createElement("div", "ph");
  header.append(
    createButton("←", "iconbtn", closeJob),
    createElement("span", "kindlabel", boardView.definition.kind),
  );
  const latestActivity = job.activity?.at(-1);
  const placeText = boardView.definition.place(job);
  const statusRows = boardView.definition.statusBits(job).filter((bits) => bits.length);
  const fileButtons = job.files.map((fileName) => {
    const fileButton = createElement("button", `lrow${editorsByKey.has(editorKeyFor(boardView.definition.id, job.id, fileName)) ? " on" : ""}`);
    fileButton.type = "button";
    fileButton.title = "Open in the editor";
    const fileText = createElement("div", "rt");
    fileText.append(createElement("div", "rn", fileName));
    fileButton.append(createElement("span", "dot file"), fileText);
    fileButton.onclick = () => void openFileEditor(fileName);
    return fileButton;
  });
  const fileList = createElement("div", "list");
  fileList.append(...fileButtons);
  return [
    createSection(
      header,
      createElement("h2", "pt", job.title),
      createElement("p", `pd${latestActivity ? "" : " empty"}`, latestActivity ? `now: ${latestActivity.text}` : job.id),
      placeText ? createPlaceBox(placeText) : null,
      createElement("div", "gap"),
      createStats(...boardView.definition.stats(job)),
    ),
    ...(job.needs ? [createSection(createNeedsCallout(job.needs, job))] : []),
    ...(statusRows.length
      ? [
          createSection(
            createHeading("Status"),
            ...statusRows.map((bits) => createChipRow(...bits.map((bit) => createChip(bit.text, bit.cls ?? "")))),
          ),
        ]
      : []),
    renderSkillsSection(job),
    renderStageNote(job),
    createSection(createHeading("Files", job.files.length), fileList),
  ];
}

function renderPanel(): void {
  if (document.activeElement?.tagName === "TEXTAREA") return;
  const job = currentJob();
  requireElement("panel").replaceChildren(...(job ? renderJobView(job) : renderOverview()));
}

type FileRead = { text: string; base: string };

async function readFileSnapshot(boardId: string, jobId: string, fileName: string): Promise<FileRead | null> {
  try {
    const response = await request(
      `/api/${boardId}/file?job=${encodeURIComponent(jobId)}&name=${encodeURIComponent(fileName)}`,
    );
    return response.ok
      ? { text: await response.text(), base: response.headers.get("X-Base") ?? "" }
      : null;
  } catch {
    return null;
  }
}

const SAVE_ERROR_MESSAGES: Record<number, string> = {
  409: "The file changed on disk after you opened it. Reload, then edit again.",
  422: "Lines like STATUS: and VERDICT: steer the board. They cannot be edited here.",
  400: "That edit was refused.",
};

const editorKeyFor = (boardId: string, jobId: string, fileName: string): string => `${boardId}/${jobId}/${fileName}`;

async function openFileEditor(fileName: string): Promise<void> {
  const boardView = currentView();
  if (!boardView.openId) return;
  const boardId = boardView.definition.id;
  const jobId = boardView.openId;
  const key = editorKeyFor(boardId, jobId, fileName);
  if (editorsByKey.has(key)) return focusEditor(key);
  const snapshot = await readFileSnapshot(boardId, jobId, fileName);
  if (!snapshot) return;
  const editorHandle = openEditor({
    jobId,
    fileName,
    ...snapshot,
    load: () => readFileSnapshot(boardId, jobId, fileName),
    save: async (text, base) => {
      try {
        const response = await request(`/api/${boardId}/save`, {
          method: "POST",
          body: JSON.stringify({ id: jobId, name: fileName, base, text }),
        });
        if (!response.ok) {
          return { ok: false, error: SAVE_ERROR_MESSAGES[response.status] ?? `Refused (${response.status}).` };
        }
        const reloaded = await readFileSnapshot(boardId, jobId, fileName);
        return { ok: true, base: reloaded?.base ?? "" };
      } catch {
        return { ok: false, error: "offline" };
      }
    },
    comment: (text) => requestAnswer(text),
    back: () => {
      activeEditorKey = null;
      renderAll();
    },
    changed: renderTabs,
    closed: () => {
      editorsByKey.delete(key);
      if (activeEditorKey === key) activeEditorKey = null;
      renderAll();
    },
  });
  editorsByKey.set(key, { ...editorHandle, fileName });
  focusEditor(key);
}

function selectJob(jobId: string): void {
  const boardView = currentView();
  boardView.openId = jobId;
  document.body.classList.add("with-panel");
  renderAll();
}

function closeJob(): void {
  currentView().openId = null;
  renderAll();
}

// ---- polling: every board, so the sidebar and tab badges stay live
const inflightByBoardId = new Map<string, Promise<void>>();

function pollBoard(boardId: string | null): Promise<void> {
  if (!boardId) return Promise.resolve();
  const boardView = viewsByBoardId.get(boardId);
  if (!boardView) return Promise.resolve();
  const existing = inflightByBoardId.get(boardId);
  if (existing) return existing;
  const pending = fetchJobs(boardView).finally(() => inflightByBoardId.delete(boardId));
  inflightByBoardId.set(boardId, pending);
  return pending;
}

// Built-in stages keep their text from BUILD and REVIEW. A custom stage brings its own label and blurb.
function applyStages(boardView: BoardView, payload: StagesPayload): void {
  const builtInById = new Map(boardView.builtInStages.map((stage) => [stage.id, stage]));
  boardView.definition.stages = payload.stageOrder.flatMap((stageId) => {
    const custom = payload.customStages[stageId];
    const stage = builtInById.get(stageId) ?? (custom ? { id: stageId, label: custom.label, blurb: custom.blurb } : null);
    return stage ? [stage] : [];
  });
  boardView.proposal = payload.proposal;
}

async function fetchJobs(boardView: BoardView): Promise<void> {
  try {
    const [jobsResponse, stagesResponse] = await Promise.all([
      request(`/api/${boardView.definition.id}/jobs`),
      request(`/api/${boardView.definition.id}/stages`),
    ]);
    if (!jobsResponse.ok || !stagesResponse.ok) {
      throw new Error(`status ${jobsResponse.status}/${stagesResponse.status}`);
    }
    const [jobsText, stagesText] = await Promise.all([jobsResponse.text(), stagesResponse.text()]);
    const payloadSignature = `${jobsText}\n${stagesText}`;
    if (payloadSignature === boardView.payloadSignature) {
      if (boardView.definition.id === activeBoardId) renderTabs();
      else renderSidebar();
      return;
    }
    boardView.payloadSignature = payloadSignature;
    boardView.jobs = parseJobs(parseJson(jobsText, "jobs"));
    applyStages(boardView, parseStages(parseJson(stagesText, "stages")));
    if (boardView.definition.id === activeBoardId) {
      renderAll();
    } else {
      renderSidebar();
      renderTabs();
    }
  } catch {
    requireElement("meta").textContent = "offline, retrying";
  }
}

// The poll is meant to run for the life of the page; pagehide is its explicit cleanup path.
let pollTimeoutId = 0;
let pollingStopped = false;

function pollLoop(): void {
  if (pollingStopped) return;
  if (!document.hidden) void Promise.all([...viewsByBoardId.keys()].map(pollBoard));
  pollTimeoutId = window.setTimeout(pollLoop, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  pollingStopped = true;
  window.clearTimeout(pollTimeoutId);
}

window.addEventListener("pagehide", stopPolling, { once: true });

// ---- chrome: zoom, panel, sidebar, drop zones
requireElement("zoom-in").onclick = () => {
  currentView().zoomOverride = Math.min(2, currentScale * 1.2);
  applyScale();
};
requireElement("zoom-out").onclick = () => {
  currentView().zoomOverride = Math.max(0.3, currentScale / 1.2);
  applyScale();
};
requireElement("zoom-fit").onclick = () => {
  currentView().zoomOverride = null;
  applyScale();
};

// The editor covers the board, so a board control first takes you back to the board.
function leaveEditorIfOpen(): boolean {
  if (!activeEditorKey) return false;
  activeEditorKey = null;
  renderAll();
  return true;
}

requireElement("panel-toggle").onclick = () => {
  if (leaveEditorIfOpen()) return;
  document.body.classList.toggle("with-panel");
  applyScale();
};
requireElement("side-toggle").onclick = () => {
  if (!leaveEditorIfOpen()) setSidebarCollapsed(!sidebarCollapsed);
};

for (const zone of [requireElement("boardtabs"), requireElement("canvas")]) {
  zone.ondragover = (event) => {
    event.preventDefault();
    zone.classList.add("over");
  };
  zone.ondragleave = () => zone.classList.remove("over");
  zone.ondrop = (event) => {
    zone.classList.remove("over");
    document.body.classList.remove("dragging");
    if (zone.id === "canvas") {
      event.preventDefault();
      const boardId = event.dataTransfer?.getData("text/plain") ?? "";
      if (viewsByBoardId.has(boardId)) openBoard(boardId);
    } else {
      dropOnTabs(event);
    }
  };
}

window.addEventListener("resize", applyScale);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void Promise.all([...viewsByBoardId.keys()].map(pollBoard));
});

// ---- start
async function start(): Promise<void> {
  initializeAsk({ request, getView: currentView, viewsByBoardId, pollBoard });
  try {
    const response = await request("/api/boards");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const boards = parseBoards(await response.json() as unknown);
    for (const board of boards) {
      const definition = BOARD_DEFINITIONS[board.id];
      if (!definition) continue;
      viewsByBoardId.set(board.id, {
        definition: { ...definition, id: board.id, label: board.label },
        jobs: [],
        openId: null,
        filter: "all",
        zoomOverride: null,
        payloadSignature: "",
        session: "",
        showAllSkills: false,
        builtInStages: definition.stages,
        proposal: null,
      });
    }
  } catch {
    requireElement("meta").textContent = "offline, retrying";
  }
  const savedLayout = restoreLayout();
  boardOrder = [
    ...(savedLayout?.order ?? []).filter((id) => viewsByBoardId.has(id)),
    ...[...viewsByBoardId.keys()].filter((id) => !savedLayout?.order?.includes(id)),
  ];
  openBoardIds = (savedLayout?.openTabs ?? []).filter((id) => viewsByBoardId.has(id));
  if (!openBoardIds.length && boardOrder.length) openBoardIds = [boardOrder[0]];
  activeBoardId = savedLayout && openBoardIds.includes(savedLayout.active)
    ? savedLayout.active
    : (openBoardIds[0] ?? null);
  document.body.classList.add("with-panel");
  setSidebarCollapsed(savedLayout?.sideCollapsed ?? false);
  showMode();
  void restoreChat();
  try {
    const response = await request("/api/engines");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const modelsByEngine = parseEngines(await response.json() as unknown);
    setAvailableEngines(Object.keys(modelsByEngine), modelsByEngine);
  } catch {
    // keep the claude default
  }
  if (activeBoardId) {
    await Promise.all([...viewsByBoardId.keys()].map(pollBoard));
    renderAll();
  }
  pollLoop();
}

void start();
