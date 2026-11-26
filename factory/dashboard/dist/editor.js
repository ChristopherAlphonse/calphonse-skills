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

/** One editor's state and behavior. Each method stays small; `openEditor` only starts the session. */
class EditorSession {
                   dependencies                    ;
                   elements                ;
                   root                ;
                   statusLabel                 ;
                   banner                ;
                   lineNumbers                ;
                   textArea                     ;
                   previewPane                ;
                   selectedRangeLabel                ;
                   selectedQuote                ;
                   commentInput                     ;
                   threadList                ;
                   commentThreads                  = [];
          base        ;
          savedText        ;
          selectedLines                   = [1, 1];
          selectionAnchorLine = 1;
          visibleLineCount = 0;
          wasDirty = false;
          isClosed = false;
          previewTimeoutId = 0;
          filePollIntervalId = 0;

  constructor(dependencies                    ) {
    this.dependencies = dependencies;
    this.base = dependencies.base;
    this.savedText = dependencies.text;
    this.elements = buildEditorElements(dependencies, () => void this.sendCommentToAgent());
    this.root = this.elements.root;
    this.statusLabel = this.elements.statusLabel;
    this.banner = this.elements.banner;
    this.lineNumbers = this.elements.lineNumbers;
    this.textArea = this.elements.textArea;
    this.previewPane = this.elements.previewPane;
    this.selectedRangeLabel = this.elements.selectedRangeLabel;
    this.selectedQuote = this.elements.selectedQuote;
    this.commentInput = this.elements.commentInput;
    this.threadList = this.elements.threadList;
    this.wireHeader();
    this.wireEvents();
    this.startFilePoll();
    document.body.append(this.root);
    this.schedulePreview();
    this.renderStatus();
    this.selectLineRange(this.selectedLines[0], this.selectedLines[1], false);
  }

  handle()               {
    return {
      root: this.root,
      dirty: () => this.isDirty(),
      requestClose: () => this.requestEditorClose(),
      hide: () => {
        this.root.hidden = true;
      },
      show: () => {
        this.root.hidden = false;
        this.textArea.focus();
      },
    };
  }

          wireHeader()       {
    const header = createElement("div", "edhead");
    header.append(
      createButton("← Board", "", () => this.dependencies.back()),
      createElement("b", "edname", this.dependencies.fileName),
      this.statusLabel,
      createElement("span", "grow"),
      createButton("Save", "go", () => void this.saveFile()),
      createButton("Close", "", () => this.requestEditorClose()),
    );
    this.root.prepend(header);
  }

          wireEvents()       {
    this.textArea.addEventListener("input", () => {
      this.syncSelectionFromCaret();
      this.renderStatus();
      this.schedulePreview();
    });
    for (const eventName of ["click", "keyup", "select"]) {
      this.textArea.addEventListener(eventName, () => this.syncSelectionFromCaret());
    }
    this.textArea.addEventListener("scroll", () => {
      this.lineNumbers.scrollTop = this.textArea.scrollTop;
    });
    this.lineNumbers.addEventListener("click", (event) => this.handleLineClick(event));
    this.commentInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void this.sendCommentToAgent();
    });
    this.root.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void this.saveFile();
      }
    });
  }

          handleLineClick(event            )       {
    const lineNumber = Number((event.target instanceof HTMLElement ? event.target.dataset.n : undefined) ?? 0);
    if (!lineNumber) return;
    this.selectLineRange(event.shiftKey ? this.selectionAnchorLine : lineNumber, lineNumber, true);
    if (!event.shiftKey) this.selectionAnchorLine = lineNumber;
  }

          quoteForLines(firstLine        , lastLine        )         {
    return this.textArea.value.split("\n").slice(firstLine - 1, lastLine).join("\n");
  }

          hasCommentOnLine(lineNumber        )          {
    return this.commentThreads.some(
      (thread) => lineNumber >= thread.firstLine && lineNumber <= thread.lastLine,
    );
  }

          isDirty()          {
    return this.textArea.value !== this.savedText;
  }

          createLineButtons()                      {
    const lockedAtOpen = new Set(
      this.savedText.split("\n").flatMap((line, index) => (GUARDED_LINE_START_PATTERN.test(line) ? [index + 1] : [])),
    );
    return Array.from({ length: lineCount(this.textArea.value) }, (_, index) => {
      const lineButton = createButton(String(index + 1), "ln", () => {});
      lineButton.dataset.n = String(index + 1);
      if (lockedAtOpen.has(index + 1)) {
        lineButton.classList.add("lock");
        lineButton.title = "This line steers the board and cannot be changed here";
      }
      return lineButton;
    });
  }

          renderLineNumbers()       {
    const currentLineCount = lineCount(this.textArea.value);
    if (currentLineCount !== this.visibleLineCount) {
      this.visibleLineCount = currentLineCount;
      this.lineNumbers.replaceChildren(...this.createLineButtons());
    }
    for (const lineButton of this.lineNumbers.children) {
      const lineNumber = Number(lineButton instanceof HTMLElement ? lineButton.dataset.n : undefined);
      lineButton.classList.toggle("on", lineNumber >= this.selectedLines[0] && lineNumber <= this.selectedLines[1]);
      lineButton.classList.toggle("cmt", this.hasCommentOnLine(lineNumber));
    }
    const [firstLine, lastLine] = this.selectedLines;
    this.selectedRangeLabel.textContent = `${this.dependencies.fileName}:${formatLineRange(firstLine, lastLine)}`;
    this.selectedQuote.textContent = this.quoteForLines(firstLine, lastLine);
  }

          renderThreads()       {
    this.threadList.replaceChildren(
      ...this.commentThreads.map((thread) =>
        createThreadCard(thread, this.dependencies.fileName, (firstLine, lastLine) => {
          this.selectLineRange(firstLine, lastLine, true);
        }),
      ),
    );
    this.renderLineNumbers();
  }

          renderStatus(text = "")       {
    this.statusLabel.textContent = text || (this.isDirty() ? "Unsaved changes" : "Saved");
    this.statusLabel.classList.toggle("dirty", this.isDirty());
    this.renderLineNumbers();
    if (this.isDirty() !== this.wasDirty) {
      this.wasDirty = this.isDirty();
      this.dependencies.changed();
    }
  }

          renderPreview()       {
    const page = renderMarkdown(this.textArea.value);
    void enhanceMermaid(page);
    this.previewPane.replaceChildren(page);
  }

          schedulePreview()       {
    window.clearTimeout(this.previewTimeoutId);
    this.previewTimeoutId = window.setTimeout(() => this.renderPreview(), PREVIEW_DEBOUNCE_MS);
  }

          selectLineRange(firstLine        , lastLine        , focus         )       {
    this.selectedLines = [Math.min(firstLine, lastLine), Math.max(firstLine, lastLine)];
    if (focus) {
      const [selectedStart, selectedEnd] = this.selectedLines;
      const end = lineStartOffset(this.textArea.value, selectedEnd + 1);
      this.textArea.setSelectionRange(
        lineStartOffset(this.textArea.value, selectedStart),
        end > 0 ? end - 1 : this.textArea.value.length,
      );
      this.textArea.focus();
    }
    this.renderLineNumbers();
  }

          syncSelectionFromCaret()       {
    const start = this.textArea.selectionStart;
    const end = this.textArea.selectionEnd;
    const last = end > start && this.textArea.value[end - 1] === "\n" ? end - 1 : end;
    this.selectedLines = [lineAtPosition(this.textArea.value, start), lineAtPosition(this.textArea.value, last)];
    this.selectionAnchorLine = this.selectedLines[0];
    this.renderLineNumbers();
  }

          showMessageBanner(text        , ...actions                     )       {
    this.banner.replaceChildren(createElement("span", "", text), ...actions);
    this.banner.hidden = false;
  }

          replaceFileContents(snapshot          )       {
    this.textArea.value = snapshot.text;
    this.savedText = snapshot.text;
    this.base = snapshot.base;
    this.banner.hidden = true;
    this.visibleLineCount = 0;
    this.schedulePreview();
    this.renderStatus();
  }

          async saveFile()                {
    const text = this.textArea.value;
    if (!this.isDirty()) return;
    if (guardedLines(text).join("\n") !== guardedLines(this.savedText).join("\n")) {
      return this.showMessageBanner("Lines like STATUS: and VERDICT: steer the board. Put them back to save.");
    }
    const result = await this.dependencies.save(text, this.base);
    if (!result.ok) return this.showMessageBanner(result.error);
    this.savedText = text;
    this.base = result.base;
    this.banner.hidden = true;
    this.visibleLineCount = 0;
    this.renderStatus("Saved");
  }

          async sendCommentToAgent()                {
    const text = this.commentInput.value.trim();
    if (!text) return;
    if (this.isDirty()) await this.saveFile();
    if (this.isDirty()) return;
    const [firstLine, lastLine] = this.selectedLines;
    const quotedText = this.quoteForLines(firstLine, lastLine).trim().replace(/\s+/g, " ").slice(0, MAX_QUOTE_LENGTH);
    const thread                = { firstLine, lastLine, quote: quotedText, note: text, answer: "" };
    this.commentThreads.unshift(thread);
    this.commentInput.value = "";
    this.renderThreads();
    const commentText = buildCommentText(this.dependencies.jobId, this.dependencies.fileName, firstLine, lastLine, quotedText, text);
    thread.answer = await this.dependencies.comment(commentText);
    this.renderThreads();
  }

          startFilePoll()       {
    this.filePollIntervalId = window.setInterval(() => void this.pollFile(), FILE_POLL_INTERVAL_MS);
  }

          async pollFile()                {
    if (this.isClosed) return;
    const snapshot = await this.dependencies.load();
    if (this.isClosed) return;
    if (!snapshot || snapshot.base === this.base) return;
    if (this.isDirty()) {
      this.showMessageBanner(
        "The file changed on disk. Saving will be refused until you reload.",
        createButton("Reload and discard mine", "", () => this.replaceFileContents(snapshot)),
      );
      return;
    }
    this.replaceFileContents(snapshot);
    this.renderStatus("Updated by the agent");
  }

          closeEditor()       {
    this.isClosed = true;
    window.clearTimeout(this.previewTimeoutId);
    window.clearInterval(this.filePollIntervalId);
    this.root.remove();
    this.dependencies.closed();
  }

          requestEditorClose()       {
    if (!this.isDirty()) return this.closeEditor();
    this.showMessageBanner(
      "You have unsaved changes.",
      createButton("Discard and close", "", () => this.closeEditor()),
      createButton("Keep editing", "", () => {
        this.banner.hidden = true;
      }),
    );
  }
}

/** A line-numbered text editor for one job file, with the rendered file beside it and comments tied to line ranges. It lives in a tab. */
export function openEditor(dependencies                    )               {
  return new EditorSession(dependencies).handle();
}
