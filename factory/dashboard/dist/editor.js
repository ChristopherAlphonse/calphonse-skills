// Generated from editor.ts by build.mjs. Do not edit.
import { createButton, createElement } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";
import { enhanceMermaid } from "/static/mermaid.js";

                                                      
                                                                                   
                                  
                
                   
               
               
                                       
                                                            
                                                                   
                                             
                                                                 
                   
                                                                
                      
                                        
                     
  

                            
                    
                       
                   
                   
                                                             
                           
  

                      
                    
                   
                
               
                 
  

                          
                       
                               
                         
                              
                                
                              
                                     
                                
                                    
                             
 

const GUARDED_LINE_PATTERN = /^[A-Z]{3,}:.*$/gm;
const GUARDED_LINE_START_PATTERN = /^[A-Z]{3,}:/;
const FILE_POLL_INTERVAL_MS = 3000;
const PREVIEW_DEBOUNCE_MS = 150;
const MAX_QUOTE_LENGTH = 600;

/** The text sent to the agent. The quote is the anchor; the line range is a hint that can drift after an edit. */
function buildCommentText(
  jobId        ,
  fileName        ,
  firstLine        ,
  lastLine        ,
  quotedText        ,
  noteText        ,
)         {
  return [
    `Comment on .planning/factory/jobs/${jobId}/${fileName}, lines ${formatLineRange(firstLine, lastLine)} (job ${jobId}):`,
    `> ${quotedText}`,
    noteText,
    "Re-find the quoted text in the file before acting, because line numbers may have moved.",
  ].join("\n");
}

function guardedLines(text        )           {
  return text.match(GUARDED_LINE_PATTERN) ?? [];
}

function lineCount(text        )         {
  return text.split("\n").length;
}

function formatLineRange(firstLine        , lastLine        )         {
  return firstLine === lastLine ? `${firstLine}` : `${firstLine}-${lastLine}`;
}

function lineStartOffset(text        , lineNumber        )         {
  let offset = 0;
  for (let line = 1; line < lineNumber; line++) offset = text.indexOf("\n", offset) + 1;
  return offset;
}

function lineAtPosition(text        , position        )         {
  return text.slice(0, position).split("\n").length;
}

function buildEditorElements(config                    , onSendComment            )                 {
  const root = createElement("div", "ed");
  root.hidden = true;
  const statusLabel = createElement("span", "edstate");
  const banner = createElement("div", "edbanner");
  banner.hidden = true;
  const lineNumbers = createElement("div", "gutter");
  const textArea = createElement("textarea");
  textArea.wrap = "off";
  textArea.spellcheck = false;
  textArea.value = config.text;
  const previewPane = createElement("div", "edprev");
  const wrap = createElement("div", "edwrap");
  wrap.append(lineNumbers, textArea);
  const main = createElement("div", "edmain split");
  main.append(wrap, previewPane);

  const selectedRangeLabel = createElement("div", "edref");
  const selectedQuote = createElement("pre", "edpick");
  const commentInput = createElement("textarea");
  commentInput.placeholder = "Say what should change in these lines";
  commentInput.rows = 4;
  commentInput.spellcheck = false;
  const sendRow = createElement("div", "edsend");
  sendRow.append(
    createElement("span", "edhint", "Cmd+Enter sends. Unsaved edits are saved first."),
    createButton("Send to agent", "go", onSendComment),
  );
  const composer = createElement("div", "edcompose");
  composer.append(createElement("div", "edh", "Comment on lines"), selectedRangeLabel, selectedQuote, commentInput, sendRow);
  const threadList = createElement("div", "edthreads");
  const sidebar = createElement("aside", "edside");
  sidebar.append(composer, threadList);
  main.append(sidebar);
  root.append(banner, main);
  return {
    root, statusLabel, banner, lineNumbers, textArea, previewPane,
    selectedRangeLabel, selectedQuote, commentInput, threadList,
  };
}

function createThreadCard(
  thread               ,
  fileName        ,
  onJump                                               ,
)                 {
  const card = createElement("div", "edthread");
  const jump = createButton(`${fileName}:${formatLineRange(thread.firstLine, thread.lastLine)}`, "edjump", () => {
    onJump(thread.firstLine, thread.lastLine);
  });
  card.append(
    jump,
    createElement("div", "edq", thread.quote),
    createElement("div", "edn", thread.note),
    createElement("div", "eda", thread.answer || "Asking the agent..."),
  );
  return card;
}

/** A line-numbered text editor for one job file, with the rendered file beside it and comments tied to line ranges. It lives in a tab. */
export function openEditor(dependencies                    )               {
  let base = dependencies.base;
  let savedText = dependencies.text;
  let selectedLines                   = [1, 1];
  let selectionAnchorLine = selectedLines[0];
  let visibleLineCount = 0;
  let wasDirty = false;
  let isClosed = false;

  const elements = buildEditorElements(dependencies, () => void sendCommentToAgent());
  const {
    root, statusLabel, banner, lineNumbers, textArea, previewPane,
    selectedRangeLabel, selectedQuote, commentInput, threadList,
  } = elements;
  const commentThreads                  = [];
  let previewTimeoutId = 0;

  const quoteForLines = (firstLine        , lastLine        )         =>
    textArea.value.split("\n").slice(firstLine - 1, lastLine).join("\n");
  const hasCommentOnLine = (lineNumber        )          =>
    commentThreads.some((thread) => lineNumber >= thread.firstLine && lineNumber <= thread.lastLine);
  const isDirty = ()          => textArea.value !== savedText;

  function renderLineNumbers()       {
    const currentLineCount = lineCount(textArea.value);
    const lockedAtOpen = new Set(
      savedText.split("\n").flatMap((line, index) => (GUARDED_LINE_START_PATTERN.test(line) ? [index + 1] : [])),
    );
    if (currentLineCount !== visibleLineCount) {
      visibleLineCount = currentLineCount;
      lineNumbers.replaceChildren(
        ...Array.from({ length: currentLineCount }, (_, index) => {
          const lineButton = createButton(String(index + 1), "ln", () => {});
          lineButton.dataset.n = String(index + 1);
          if (lockedAtOpen.has(index + 1)) {
            lineButton.classList.add("lock");
            lineButton.title = "This line steers the board and cannot be changed here";
          }
          return lineButton;
        }),
      );
    }
    for (const lineButton of lineNumbers.children) {
      const lineNumber = Number(lineButton instanceof HTMLElement ? lineButton.dataset.n : undefined);
      lineButton.classList.toggle("on", lineNumber >= selectedLines[0] && lineNumber <= selectedLines[1]);
      lineButton.classList.toggle("cmt", hasCommentOnLine(lineNumber));
    }
    selectedRangeLabel.textContent = `${dependencies.fileName}:${formatLineRange(selectedLines[0], selectedLines[1])}`;
    selectedQuote.textContent = quoteForLines(selectedLines[0], selectedLines[1]);
  }

  function renderThreads()       {
    threadList.replaceChildren(
      ...commentThreads.map((thread) => createThreadCard(thread, dependencies.fileName, (firstLine, lastLine) => {
        selectLineRange(firstLine, lastLine, true);
      })),
    );
    renderLineNumbers();
  }

  function renderStatus(text = "")       {
    statusLabel.textContent = text || (isDirty() ? "Unsaved changes" : "Saved");
    statusLabel.classList.toggle("dirty", isDirty());
    renderLineNumbers();
    if (isDirty() !== wasDirty) {
      wasDirty = isDirty();
      dependencies.changed();
    }
  }

  function renderPreview()       {
    const page = renderMarkdown(textArea.value);
    void enhanceMermaid(page);
    previewPane.replaceChildren(page);
  }

  function schedulePreview()       {
    window.clearTimeout(previewTimeoutId);
    previewTimeoutId = window.setTimeout(renderPreview, PREVIEW_DEBOUNCE_MS);
  }

  function selectLineRange(firstLine        , lastLine        , focus         )       {
    selectedLines = [Math.min(firstLine, lastLine), Math.max(firstLine, lastLine)];
    if (focus) {
      const end = lineStartOffset(textArea.value, selectedLines[1] + 1);
      textArea.setSelectionRange(lineStartOffset(textArea.value, selectedLines[0]), end > 0 ? end - 1 : textArea.value.length);
      textArea.focus();
    }
    renderLineNumbers();
  }

  function syncSelectionFromCaret()       {
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const last = end > start && textArea.value[end - 1] === "\n" ? end - 1 : end;
    selectedLines = [lineAtPosition(textArea.value, start), lineAtPosition(textArea.value, last)];
    selectionAnchorLine = selectedLines[0];
    renderLineNumbers();
  }

  function showMessageBanner(text        , ...actions                     )       {
    banner.replaceChildren(createElement("span", "", text), ...actions);
    banner.hidden = false;
  }

  function replaceFileContents(snapshot          )       {
    textArea.value = snapshot.text;
    savedText = snapshot.text;
    base = snapshot.base;
    banner.hidden = true;
    visibleLineCount = 0;
    schedulePreview();
    renderStatus();
  }

  async function saveFile()                {
    const text = textArea.value;
    if (!isDirty()) return;
    if (guardedLines(text).join("\n") !== guardedLines(savedText).join("\n")) {
      return showMessageBanner("Lines like STATUS: and VERDICT: steer the board. Put them back to save.");
    }
    const result = await dependencies.save(text, base);
    if (!result.ok) return showMessageBanner(result.error);
    savedText = text;
    base = result.base;
    banner.hidden = true;
    visibleLineCount = 0;
    renderStatus("Saved");
  }

  async function sendCommentToAgent()                {
    const text = commentInput.value.trim();
    if (!text) return;
    if (isDirty()) await saveFile();
    if (isDirty()) return;
    const [firstLine, lastLine] = selectedLines;
    const quotedText = quoteForLines(firstLine, lastLine).trim().replace(/\s+/g, " ").slice(0, MAX_QUOTE_LENGTH);
    const thread                = { firstLine, lastLine, quote: quotedText, note: text, answer: "" };
    commentThreads.unshift(thread);
    commentInput.value = "";
    renderThreads();
    thread.answer = await dependencies.comment(buildCommentText(dependencies.jobId, dependencies.fileName, firstLine, lastLine, quotedText, text));
    renderThreads();
  }

  function closeEditor()       {
    isClosed = true;
    window.clearTimeout(previewTimeoutId);
    window.clearInterval(filePollIntervalId);
    root.remove();
    dependencies.closed();
  }

  function requestEditorClose()       {
    if (!isDirty()) return closeEditor();
    showMessageBanner(
      "You have unsaved changes.",
      createButton("Discard and close", "", closeEditor),
      createButton("Keep editing", "", () => (banner.hidden = true)),
    );
  }

  const header = createElement("div", "edhead");
  header.append(
    createButton("← Board", "", dependencies.back),
    createElement("b", "edname", dependencies.fileName),
    statusLabel,
    createElement("span", "grow"),
    createButton("Save", "go", () => void saveFile()),
    createButton("Close", "", requestEditorClose),
  );
  root.prepend(header);

  textArea.addEventListener("input", () => {
    syncSelectionFromCaret();
    renderStatus();
    schedulePreview();
  });
  for (const eventName of ["click", "keyup", "select"]) textArea.addEventListener(eventName, syncSelectionFromCaret);
  textArea.addEventListener("scroll", () => {
    lineNumbers.scrollTop = textArea.scrollTop;
  });
  lineNumbers.addEventListener("click", (event) => {
    const lineNumber = Number((event.target instanceof HTMLElement ? event.target.dataset.n : undefined) ?? 0);
    if (!lineNumber) return;
    selectLineRange(event.shiftKey ? selectionAnchorLine : lineNumber, lineNumber, true);
    if (!event.shiftKey) selectionAnchorLine = lineNumber;
  });
  commentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void sendCommentToAgent();
  });
  root.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      void saveFile();
    }
  });

  // Pick up the agent's changes. Clean text is swapped in; unsaved text is kept and flagged.
  const filePollIntervalId = window.setInterval(async () => {
    if (isClosed) return;
    const snapshot = await dependencies.load();
    if (isClosed) return;
    if (!snapshot || snapshot.base === base) return;
    if (!isDirty()) {
      replaceFileContents(snapshot);
      renderStatus("Updated by the agent");
    } else {
      showMessageBanner("The file changed on disk. Saving will be refused until you reload.", createButton("Reload and discard mine", "", () => replaceFileContents(snapshot)));
    }
  }, FILE_POLL_INTERVAL_MS);

  document.body.append(root);
  schedulePreview();
  renderStatus();
  selectLineRange(selectedLines[0], selectedLines[1], false);

  return {
    root,
    dirty: isDirty,
    requestClose: requestEditorClose,
    hide: () => {
      root.hidden = true;
    },
    show: () => {
      root.hidden = false;
      textArea.focus();
    },
  };
}
