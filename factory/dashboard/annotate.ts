import { el } from "/static/dom.js";

export type LineRef = { l1: number; l2: number; quote: string };
export type Target = { job: string; file: string };

const MAX_QUOTE = 600;
const POP_WIDTH = 300;

function blockOf(node: Node | null, root: HTMLElement): HTMLElement | null {
  const start = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  const hit = start?.closest<HTMLElement>("[data-l1]") ?? null;
  return hit && root.contains(hit) ? hit : null;
}

/** Source lines (1-based, inclusive) of the rendered blocks a selection touches, plus the quoted text. */
export function lineRef(sel: Selection, root: HTMLElement): LineRef | null {
  if (sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const first = blockOf(range.startContainer, root);
  let last = blockOf(range.endContainer, root);
  if (!first || !last) return null;
  // A triple-click ends at offset 0 of the next block; that block was not selected.
  if (range.endOffset === 0 && last !== first) {
    const prev = last.previousElementSibling;
    if (prev instanceof HTMLElement && prev.dataset.l1) last = prev;
  }
  const quote = sel.toString().trim().replace(/\s+/g, " ");
  if (!quote) return null;
  const lines = [first, last].flatMap((b) => [Number(b.dataset.l1), Number(b.dataset.l2)]);
  return { l1: Math.min(...lines), l2: Math.max(...lines), quote: quote.slice(0, MAX_QUOTE) };
}

const range = (r: LineRef): string => (r.l1 === r.l2 ? `${r.l1}` : `${r.l1}-${r.l2}`);

/** The text sent to the agent. The quote is the anchor; the line range is a hint that can drift after an edit. */
export function commentText(t: Target, r: LineRef, note: string): string {
  return [
    `Comment on .planning/factory/jobs/${t.job}/${t.file}, lines ${range(r)} (job ${t.job}):`,
    `> ${r.quote}`,
    note,
    "Re-find the quoted text in the file before acting, because line numbers may have moved.",
  ].join("\n");
}

function popover(): HTMLElement {
  const pop = el("div");
  pop.id = "cm";
  pop.hidden = true;
  document.body.append(pop);
  return pop;
}

/** Select text in a rendered markdown file to comment on it. `send` gets the finished message. */
export function attachAnnotate(
  target: () => Target | null,
  send: (text: string) => void,
  edit: (r: LineRef) => void,
): void {
  const pop = popover();
  const close = (): void => {
    pop.hidden = true;
    pop.replaceChildren();
  };

  const open = (r: LineRef, t: Target, rect: DOMRect): void => {
    const note = el("textarea");
    note.rows = 2;
    note.placeholder = "What should change here?";
    note.spellcheck = false;
    const go = el("button", "go", "Send");
    go.type = "button";
    const cancel = el("button", "", "Cancel");
    cancel.type = "button";
    const editLines = el("button", "", "Open in editor");
    editLines.type = "button";
    editLines.onclick = () => {
      close();
      getSelection()?.removeAllRanges();
      edit(r);
    };
    const submit = (): void => {
      const text = note.value.trim();
      if (!text) return;
      close();
      getSelection()?.removeAllRanges();
      send(commentText(t, r, text));
    };
    go.onclick = submit;
    cancel.onclick = close;
    note.onkeydown = (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
      else if (e.key === "Escape") close();
    };
    pop.replaceChildren(
      el("div", "ref", `${t.file}:${range(r)}`),
      el("div", "quote", r.quote),
      note,
      el("div", "row", ""),
    );
    pop.lastElementChild?.append(cancel, editLines, go);
    pop.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - POP_WIDTH - 8))}px`;
    pop.style.top = `${Math.min(rect.bottom + 8, innerHeight - 190)}px`;
    pop.hidden = false;
    note.focus();
  };

  document.addEventListener("mouseup", (e) => {
    if (e.target instanceof Node && pop.contains(e.target)) return;
    const body = document.getElementById("dbody");
    const sel = getSelection();
    const t = target();
    if (!body || !sel || !t || !body.classList.contains("md")) return close();
    const r = lineRef(sel, body);
    if (!r) return close();
    open(r, t, sel.getRangeAt(0).getBoundingClientRect());
  });
}
