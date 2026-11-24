import { el } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";
import { commentText } from "/static/annotate.js";

export type Snapshot = { text: string; base: string };
export type SaveResult = { ok: true; base: string } | { ok: false; error: string };
export type EditorDeps = {
  job: string;
  name: string;
  text: string;
  base: string;
  /** Lines (1-based, inclusive) to select when the editor opens. */
  select?: [number, number];
  load: () => Promise<Snapshot | null>;
  save: (text: string, base: string) => Promise<SaveResult>;
  /** Sends a comment to the agent and resolves with its answer. */
  comment: (text: string) => Promise<string>;
};

const GUARDED = /^[A-Z]{3,}:.*$/gm;
const POLL_MS = 3000;
const PREVIEW_MS = 150;
const MAX_QUOTE = 600;

const guarded = (text: string): string[] => text.match(GUARDED) ?? [];
const lineCount = (text: string): number => text.split("\n").length;
const label = (a: number, b: number): string => (a === b ? `${a}` : `${a}-${b}`);

function btn(text: string, cls: string, onclick: () => void): HTMLButtonElement {
  const b = el("button", cls, text);
  b.type = "button";
  b.onclick = onclick;
  return b;
}

/** A full-page, line-numbered text editor for one job file, with comments tied to line ranges. */
export function openEditor(d: EditorDeps): void {
  document.getElementById("ed")?.remove();
  let base = d.base;
  let saved = d.text;
  let sel: [number, number] = d.select ?? [1, 1];
  let anchor = sel[0];
  let shownLines = 0;
  let closing = false;

  const root = el("div");
  root.id = "ed";
  const state = el("span", "edstate");
  const banner = el("div", "edbanner");
  banner.hidden = true;
  const gutter = el("div", "gutter");
  const area = el("textarea");
  area.wrap = "off";
  area.spellcheck = false;
  area.value = d.text;
  const preview = el("div", "edprev");
  const main = el("div", "edmain");
  const wrap = el("div", "edwrap");
  wrap.append(gutter, area);
  main.append(wrap, preview);

  // Comments sidebar: a composer tied to the selected lines, then the comments sent so far with the agent's answers.
  type Thread = { l1: number; l2: number; quote: string; note: string; answer: string };
  const threads: Thread[] = [];
  const where = el("div", "edref");
  const picked = el("pre", "edpick");
  const note = el("textarea");
  note.placeholder = "Say what should change in these lines";
  note.rows = 4;
  note.spellcheck = false;
  const send = btn("Send to agent", "go", () => void sendComment());
  const hint = el("span", "edhint", "Cmd+Enter sends. Unsaved edits are saved first.");
  const composer = el("div", "edcompose");
  const sendRow = el("div", "edsend");
  sendRow.append(hint, send);
  composer.append(el("div", "edh", "Comment on lines"), where, picked, note, sendRow);
  const list = el("div", "edthreads");
  const side = el("aside", "edside");
  side.append(composer, list);
  main.append(side);

  const quoteOf = (l1: number, l2: number): string => area.value.split("\n").slice(l1 - 1, l2).join("\n");
  const commented = (n: number): boolean => threads.some((t) => n >= t.l1 && n <= t.l2);

  const dirty = (): boolean => area.value !== saved;

  const lineStart = (n: number): number => {
    let at = 0;
    for (let i = 1; i < n; i++) at = area.value.indexOf("\n", at) + 1;
    return at;
  };
  const lineAt = (pos: number): number => area.value.slice(0, pos).split("\n").length;

  function paintGutter(): void {
    const n = lineCount(area.value);
    const lockedAtOpen = new Set(
      saved.split("\n").flatMap((l, i) => (/^[A-Z]{3,}:/.test(l) ? [i + 1] : [])),
    );
    if (n !== shownLines) {
      shownLines = n;
      gutter.replaceChildren(
        ...Array.from({ length: n }, (_, i) => {
          const b = btn(String(i + 1), "ln", () => {});
          b.dataset.n = String(i + 1);
          if (lockedAtOpen.has(i + 1)) {
            b.classList.add("lock");
            b.title = "This line steers the board and cannot be changed here";
          }
          return b;
        }),
      );
    }
    for (const b of gutter.children) {
      const k = Number((b as HTMLElement).dataset.n);
      b.classList.toggle("on", k >= sel[0] && k <= sel[1]);
      b.classList.toggle("cmt", commented(k));
    }
    where.textContent = `${d.name}:${label(sel[0], sel[1])}`;
    picked.textContent = quoteOf(sel[0], sel[1]);
  }

  function paintThreads(): void {
    list.replaceChildren(
      ...threads.map((t) => {
        const card = el("div", "edthread");
        const jump = btn(`${d.name}:${label(t.l1, t.l2)}`, "edjump", () => selectLines(t.l1, t.l2, true));
        card.append(jump, el("div", "edq", t.quote), el("div", "edn", t.note), el("div", "eda", t.answer || "Asking the agent..."));
        return card;
      }),
    );
    paintGutter();
  }

  function paintState(text = ""): void {
    state.textContent = text || (dirty() ? "Unsaved changes" : "Saved");
    state.classList.toggle("dirty", dirty());
    paintGutter();
  }

  let previewTimer = 0;
  function paintPreview(): void {
    if (preview.hidden) return;
    clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => preview.replaceChildren(renderMarkdown(area.value)), PREVIEW_MS);
  }

  function selectLines(a: number, b: number, focus: boolean): void {
    sel = [Math.min(a, b), Math.max(a, b)];
    if (focus) {
      const end = lineStart(sel[1] + 1);
      area.setSelectionRange(lineStart(sel[0]), end > 0 ? end - 1 : area.value.length);
      area.focus();
    }
    paintGutter();
  }

  function fromCaret(): void {
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const last = end > start && area.value[end - 1] === "\n" ? end - 1 : end;
    sel = [lineAt(start), lineAt(last)];
    anchor = sel[0];
    paintGutter();
  }

  function showBanner(text: string, action?: HTMLButtonElement): void {
    banner.replaceChildren(el("span", "", text), ...(action ? [action] : []));
    banner.hidden = false;
  }

  function adopt(snap: Snapshot): void {
    area.value = snap.text;
    saved = snap.text;
    base = snap.base;
    banner.hidden = true;
    shownLines = 0;
    paintPreview();
    paintState();
  }

  async function save(): Promise<void> {
    const text = area.value;
    if (!dirty()) return;
    if (guarded(text).join("\n") !== guarded(saved).join("\n")) {
      return showBanner("Lines like STATUS: and VERDICT: steer the board. Put them back to save.");
    }
    const r = await d.save(text, base);
    if (!r.ok) return showBanner(r.error);
    saved = text;
    base = r.base;
    banner.hidden = true;
    shownLines = 0;
    paintState("Saved");
  }

  async function sendComment(): Promise<void> {
    const text = note.value.trim();
    if (!text) return;
    if (dirty()) await save();
    if (dirty()) return;
    const [l1, l2] = sel;
    const quote = quoteOf(l1, l2).trim().replace(/\s+/g, " ").slice(0, MAX_QUOTE);
    const thread: Thread = { l1, l2, quote, note: text, answer: "" };
    threads.unshift(thread);
    note.value = "";
    paintThreads();
    thread.answer = await d.comment(commentText({ job: d.job, file: d.name }, { l1, l2, quote }, text));
    paintThreads();
  }

  const close = (): void => {
    clearInterval(timer);
    root.remove();
  };
  const closeBtn = btn("Close", "", () => {
    if (dirty() && !closing) {
      closing = true;
      closeBtn.textContent = "Discard changes?";
      return;
    }
    close();
  });
  const previewBtn = btn("Preview", "on", () => {
    preview.hidden = !preview.hidden;
    main.classList.toggle("split", !preview.hidden);
    previewBtn.classList.toggle("on", !preview.hidden);
    paintPreview();
  });

  const head = el("div", "edhead");
  head.append(el("b", "edname", d.name), state, el("span", "grow"), previewBtn, btn("Save", "go", () => void save()), closeBtn);
  main.classList.add("split");
  root.append(head, banner, main);

  area.addEventListener("input", () => {
    closing = false;
    closeBtn.textContent = "Close";
    fromCaret();
    paintState();
    paintPreview();
  });
  for (const ev of ["click", "keyup", "select"]) area.addEventListener(ev, fromCaret);
  area.addEventListener("scroll", () => {
    gutter.scrollTop = area.scrollTop;
  });
  gutter.addEventListener("click", (e) => {
    const n = Number((e.target as HTMLElement).dataset?.n);
    if (!n) return;
    selectLines(e.shiftKey ? anchor : n, n, true);
    if (!e.shiftKey) anchor = n;
  });
  note.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendComment();
  });
  root.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") closeBtn.click();
  });

  // Pick up the agent's changes. Clean text is swapped in; unsaved text is kept and flagged.
  const timer = window.setInterval(async () => {
    if (!root.isConnected) return clearInterval(timer);
    const snap = await d.load();
    if (!snap || snap.base === base) return;
    if (!dirty()) {
      adopt(snap);
      paintState("Updated by the agent");
    } else {
      showBanner("The file changed on disk. Saving will be refused until you reload.", btn("Reload and discard mine", "", () => adopt(snap)));
    }
  }, POLL_MS);

  document.body.append(root);
  paintPreview();
  paintState();
  selectLines(sel[0], sel[1], true);
  area.scrollTop = Math.max(0, (sel[0] - 3) * 20);
  gutter.scrollTop = area.scrollTop;
}
