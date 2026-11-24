// Generated from editor.ts by build.mjs. Do not edit.
import { el } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";
import { enhanceMermaid } from "/static/mermaid.js";

                                                      
                                                                                   
                          
              
               
               
               
                                       
                                                            
                                                                   
                                             
                                                                 
                   
                                                                
                      
                                        
                     
  

                            
                    
                       
                   
                   
                                                             
                           
  

const GUARDED = /^[A-Z]{3,}:.*$/gm;
const POLL_MS = 3000;
const PREVIEW_MS = 150;
const MAX_QUOTE = 600;

/** The text sent to the agent. The quote is the anchor; the line range is a hint that can drift after an edit. */
function commentText(job        , file        , l1        , l2        , quote        , note        )         {
  return [
    `Comment on .planning/factory/jobs/${job}/${file}, lines ${label(l1, l2)} (job ${job}):`,
    `> ${quote}`,
    note,
    "Re-find the quoted text in the file before acting, because line numbers may have moved.",
  ].join("\n");
}

const guarded = (text        )           => text.match(GUARDED) ?? [];
const lineCount = (text        )         => text.split("\n").length;
const label = (a        , b        )         => (a === b ? `${a}` : `${a}-${b}`);

function btn(text        , cls        , onclick            )                    {
  const b = el("button", cls, text);
  b.type = "button";
  b.onclick = onclick;
  return b;
}

/** A line-numbered text editor for one job file, with the rendered file beside it and comments tied to line ranges. It lives in a tab. */
export function openEditor(d            )               {
  let base = d.base;
  let saved = d.text;
  let sel                   = [1, 1];
  let anchor = sel[0];
  let shownLines = 0;
  let wasDirty = false;

  const root = el("div", "ed");
  root.hidden = true;
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
                                                                                        
  const threads           = [];
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

  const quoteOf = (l1        , l2        )         => area.value.split("\n").slice(l1 - 1, l2).join("\n");
  const commented = (n        )          => threads.some((t) => n >= t.l1 && n <= t.l2);

  const dirty = ()          => area.value !== saved;

  const lineStart = (n        )         => {
    let at = 0;
    for (let i = 1; i < n; i++) at = area.value.indexOf("\n", at) + 1;
    return at;
  };
  const lineAt = (pos        )         => area.value.slice(0, pos).split("\n").length;

  function paintGutter()       {
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
      const k = Number((b               ).dataset.n);
      b.classList.toggle("on", k >= sel[0] && k <= sel[1]);
      b.classList.toggle("cmt", commented(k));
    }
    where.textContent = `${d.name}:${label(sel[0], sel[1])}`;
    picked.textContent = quoteOf(sel[0], sel[1]);
  }

  function paintThreads()       {
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

  function paintState(text = "")       {
    state.textContent = text || (dirty() ? "Unsaved changes" : "Saved");
    state.classList.toggle("dirty", dirty());
    paintGutter();
    if (dirty() !== wasDirty) {
      wasDirty = dirty();
      d.changed();
    }
  }

  let previewTimer = 0;
  function paintPreview()       {
    clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      const page = renderMarkdown(area.value);
      void enhanceMermaid(page);
      preview.replaceChildren(page);
    }, PREVIEW_MS);
  }

  function selectLines(a        , b        , focus         )       {
    sel = [Math.min(a, b), Math.max(a, b)];
    if (focus) {
      const end = lineStart(sel[1] + 1);
      area.setSelectionRange(lineStart(sel[0]), end > 0 ? end - 1 : area.value.length);
      area.focus();
    }
    paintGutter();
  }

  function fromCaret()       {
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const last = end > start && area.value[end - 1] === "\n" ? end - 1 : end;
    sel = [lineAt(start), lineAt(last)];
    anchor = sel[0];
    paintGutter();
  }

  function showBanner(text        , ...actions                     )       {
    banner.replaceChildren(el("span", "", text), ...actions);
    banner.hidden = false;
  }

  function adopt(snap          )       {
    area.value = snap.text;
    saved = snap.text;
    base = snap.base;
    banner.hidden = true;
    shownLines = 0;
    paintPreview();
    paintState();
  }

  async function save()                {
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

  async function sendComment()                {
    const text = note.value.trim();
    if (!text) return;
    if (dirty()) await save();
    if (dirty()) return;
    const [l1, l2] = sel;
    const quote = quoteOf(l1, l2).trim().replace(/\s+/g, " ").slice(0, MAX_QUOTE);
    const thread         = { l1, l2, quote, note: text, answer: "" };
    threads.unshift(thread);
    note.value = "";
    paintThreads();
    thread.answer = await d.comment(commentText(d.job, d.name, l1, l2, quote, text));
    paintThreads();
  }

  const destroy = ()       => {
    clearInterval(timer);
    root.remove();
    d.closed();
  };
  const requestClose = ()       => {
    if (!dirty()) return destroy();
    showBanner(
      "You have unsaved changes.",
      btn("Discard and close", "", destroy),
      btn("Keep editing", "", () => (banner.hidden = true)),
    );
  };

  const head = el("div", "edhead");
  head.append(
    btn("\u2190 Board", "", d.back),
    el("b", "edname", d.name),
    state,
    el("span", "grow"),
    btn("Save", "go", () => void save()),
    btn("Close", "", requestClose),
  );
  main.classList.add("split");
  root.append(head, banner, main);

  area.addEventListener("input", () => {
    fromCaret();
    paintState();
    paintPreview();
  });
  for (const ev of ["click", "keyup", "select"]) area.addEventListener(ev, fromCaret);
  area.addEventListener("scroll", () => {
    gutter.scrollTop = area.scrollTop;
  });
  gutter.addEventListener("click", (e) => {
    const n = Number((e.target               ).dataset?.n);
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
    }
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
  selectLines(sel[0], sel[1], false);

  return {
    root,
    dirty,
    requestClose,
    hide: () => {
      root.hidden = true;
    },
    show: () => {
      root.hidden = false;
      area.focus();
    },
  };
}
