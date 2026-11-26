// Generated from ask.ts by build.mjs. Do not edit.
import { createButton, createElement, requireElement } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";
import { parseAskResponse, parseChatTurns,                } from "/static/payloads.js";
                                                  

                           
                     
                           
                                         
                                                
 

                                      
                                                   

                   
                
                        
                     
 

                    
                             
                                           
                         
                                   
 

let dependencies                         = null;

const state           = {
  availableEngines: ["claude"],
  modelsByEngine: {},
  selectedEngine: "claude",
  interactionMode: "chat",
};

const ENGINE_LABELS                         = {
  claude: "Claude Code",
  opencode: "OpenCode",
  kiro: "Kiro",
};

// Simple drawn marks, not the official logos: the page may not load outside images.
const ENGINE_ICONS                         = {
  claude:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#d97757" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></g></svg>',
  kiro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#9046ff" d="M12 2.5c-4.4 0-7.5 3.3-7.5 7.9v8.6c0 1.2 1.3 1.8 2.2 1l1.5-1.3c.5-.4 1.2-.4 1.7 0l1.1 1c.6.5 1.4.5 2 0l1.1-1c.5-.4 1.2-.4 1.7 0l1.5 1.3c.9.8 2.2.2 2.2-1v-8.6c0-4.6-3.1-7.9-7.5-7.9z"/><circle cx="9.2" cy="10.5" r="1.3" fill="#fff"/><circle cx="14.8" cy="10.5" r="1.3" fill="#fff"/></svg>',
  opencode:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5 3h14v18H5V3zm4 4v10h6V7H9z"/></svg>',
};

const BOT_DISPLAY_NAME = "Factory Bot";
const MODE_STORAGE_KEY = "factory-ask-mode";
const MODE_DESCRIPTIONS                                  = {
  chat: "Chat: answers questions. Changes it prepares wait for your Apply click.",
  act: "Act: Factory Bot changes the board for you, such as adding or moving a stage.",
};
const EFFORT_BAR_COUNT                         = {
  "": 0,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
  max: 4,
};
const openMenuCloseCallbacks = new Set            ();

function requireDependencies()                  {
  if (!dependencies) throw new Error("ask is not initialized");
  return dependencies;
}

function appendChatBubble(
  className        ,
  text        ,
  revealSheet = true,
  author = "",
)       {
  const sheet = requireElement("ask-sheet");
  if (revealSheet) sheet.hidden = false;
  const line = createElement("div", className);
  if (author) line.append(createElement("div", "botname", author));
  // The agent writes markdown. What you typed, and errors, stay as text.
  if (className === "bot") line.append(renderMarkdown(text));
  else line.textContent = text;
  requireElement("ask-log").append(line);
  sheet.scrollTop = sheet.scrollHeight;
}

// Bring back the saved chat after a reload. The log stays closed until you open it.
export async function restoreChat()                {
  try {
    const response = await requireDependencies().request("/api/chat");
    if (!response.ok) return;
    const savedTurns          = await response.json();
    for (const turn of parseChatTurns(savedTurns)) {
      appendChatBubble("me", turn.question, false);
      if (turn.answer || turn.error) {
        appendChatBubble(
          turn.error ? "err" : "bot",
          turn.error || turn.answer,
          false,
          turn.mode === "act" && !turn.error ? BOT_DISPLAY_NAME : "",
        );
      }
    }
  } catch {
    // the log is a convenience; the board works without it
  }
}

function createMenu(
  menuId        ,
  placeholder        ,
  options              ,
  onSelectionChange            ,
)          {
  const triggerButton = requireElement(`${menuId}-btn`);
  const popup = requireElement(`${menuId}-pop`);
  const label = requireElement(`${menuId}-label`);
  const menu          = { value: "", options, render };
  const closeMenu = ()       => {
    popup.hidden = true;
    triggerButton.setAttribute("aria-expanded", "false");
    openMenuCloseCallbacks.delete(closeMenu);
  };
  function render()       {
    const currentOption = menu.options.find((option) => option.value === menu.value);
    label.textContent = currentOption && menu.value ? currentOption.label : placeholder;
    popup.replaceChildren(
      ...[{ value: "", label: "Default" }, ...menu.options].map((option) => {
        const optionButton = createButton("", `popitem${option.value === menu.value ? " on" : ""}`, () => {
          menu.value = option.value;
          render();
          closeMenu();
          onSelectionChange();
        });
        optionButton.setAttribute("role", "option");
        optionButton.setAttribute("aria-selected", String(option.value === menu.value));
        optionButton.append(
          createElement("span", "", option.label),
          createElement("span", "tick", option.value === menu.value ? "✓" : ""),
        );
        return optionButton;
      }),
    );
  }
  triggerButton.onclick = (event) => {
    event.stopPropagation();
    const wasMenuOpen = !popup.hidden;
    for (const closeCallback of [...openMenuCloseCallbacks]) closeCallback();
    if (wasMenuOpen) return;
    render();
    popup.hidden = false;
    triggerButton.setAttribute("aria-expanded", "true");
    openMenuCloseCallbacks.add(closeMenu);
  };
  render();
  return menu;
}

const selectMenus = {
  model: createMenu("model", "model", [], () => undefined),
  effort: createMenu(
    "effort",
    "effort",
    [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "xhigh", label: "Extra high" },
      { value: "max", label: "Max" },
    ],
    () => updateEffortBars(),
  ),
};

function updateEffortBars()       {
  const barCount = EFFORT_BAR_COUNT[selectMenus.effort.value] ?? 0;
  document
    .querySelectorAll("#effort-icon .b")
    .forEach((bar, index) => bar.classList.toggle("on", index < barCount));
}

updateEffortBars();

function registerAskEvents()       {
  requireElement("ask-history").onclick = () => {
    const sheet = requireElement("ask-sheet");
    sheet.hidden = !sheet.hidden;
    sheet.scrollTop = sheet.scrollHeight;
  };
  requireElement("ask-close").onclick = () => {
    requireElement("ask-sheet").hidden = true;
  };

  const composerElement = requireElement("ask-input");
  if (!(composerElement instanceof HTMLTextAreaElement)) throw new Error("ask-input is not a textarea");
  const formElement = requireElement("ask-form");
  if (!(formElement instanceof HTMLFormElement)) throw new Error("ask-form is not a form");

  composerElement.addEventListener("input", () => {
    composerElement.style.height = "auto";
    composerElement.style.height = `${composerElement.scrollHeight}px`;
  });
  composerElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      formElement.requestSubmit();
    }
  });
  formElement.onsubmit = (event) => {
    event.preventDefault();
    const question = composerElement.value.trim();
    if (!question) return;
    composerElement.value = "";
    composerElement.style.height = "auto";
    void requestAnswer(question);
  };

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.closest(".menu")) {
      for (const closeCallback of [...openMenuCloseCallbacks]) closeCallback();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (openMenuCloseCallbacks.size) {
      for (const closeCallback of [...openMenuCloseCallbacks]) closeCallback();
      return;
    }
    requireElement("ask-sheet").hidden = true;
  });
}

export function initializeAsk(newDependencies                 )       {
  dependencies = newDependencies;
  registerAskEvents();
}

export async function requestAnswer(question        )                  {
  const askDependencies = requireDependencies();
  const boardView = askDependencies.getView();
  requireElement("ask-q").textContent = `${boardView.definition.label}: ${question.split("\n")[0]}`;
  appendChatBubble("me", question);
  try {
    const requestBody = {
      board: boardView.definition.id,
      id: boardView.openId ?? "",
      question,
      session: boardView.session,
      engine: state.selectedEngine,
      model: selectMenus.model.value,
      effort: selectMenus.effort.value,
      mode: state.interactionMode,
    };
    const response = await askDependencies.request("/api/ask", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    const payload          = await response.json();
    const reply = parseAskResponse(payload);
    boardView.session = reply.session ?? boardView.session;
    const answerText = reply.error ?? reply.answer ?? "";
    const isActAnswer = state.interactionMode === "act" && !reply.error;
    appendChatBubble(reply.error ? "err" : "bot", answerText, true, isActAnswer ? BOT_DISPLAY_NAME : "");
    await askDependencies.pollBoard(boardView.definition.id);
    return answerText;
  } catch {
    appendChatBubble("err", "offline");
    return "offline";
  }
}

export function showMode()       {
  requireElement("modes").replaceChildren(
    ...(["chat", "act"]                     ).map((mode) => {
      const modeButton = createButton(mode === "chat" ? "Chat" : "Act", `mode${mode === state.interactionMode ? " on" : ""}`, () => {
        state.interactionMode = mode;
        try {
          localStorage.setItem(MODE_STORAGE_KEY, mode);
        } catch {
          // the choice just is not remembered
        }
        showMode();
      });
      modeButton.title = MODE_DESCRIPTIONS[mode];
      modeButton.setAttribute("role", "radio");
      modeButton.setAttribute("aria-checked", String(mode === state.interactionMode));
      return modeButton;
    }),
  );
  const composer = requireElement("ask-input");
  if (composer instanceof HTMLTextAreaElement) {
    composer.placeholder = state.interactionMode === "act"
      ? "Tell Factory Bot what to change on the board"
      : "Ask anything. Say: skip qa-review, or turn off simplify";
  }
}

export function showEngine()       {
  const askDependencies = requireDependencies();
  requireElement("engines").replaceChildren(
    ...state.availableEngines.map((engineName) => {
      const engineButton = createElement("button", `eng${engineName === state.selectedEngine ? " on" : ""}`);
      engineButton.type = "button";
      engineButton.title = ENGINE_LABELS[engineName] ?? engineName;
      engineButton.setAttribute("role", "radio");
      engineButton.setAttribute("aria-checked", String(engineName === state.selectedEngine));
      const engineIcon = createElement("span");
      engineIcon.innerHTML = ENGINE_ICONS[engineName] ?? "";
      engineButton.append(
        engineIcon,
        ...(engineName === state.selectedEngine
          ? [createElement("span", "", ENGINE_LABELS[engineName] ?? engineName)]
          : []),
      );
      engineButton.onclick = () => {
        state.selectedEngine = engineName;
        for (const boardView of askDependencies.viewsByBoardId.values()) boardView.session = "";
        showEngine();
      };
      return engineButton;
    }),
  );
  selectMenus.model.options = (state.modelsByEngine[state.selectedEngine] ?? []).map((modelName) => ({
    value: modelName,
    label: modelName,
  }));
  if (!selectMenus.model.options.some((option) => option.value === selectMenus.model.value)) {
    selectMenus.model.value = "";
  }
  selectMenus.model.render();
  requireElement("model-wrap").hidden = !state.modelsByEngine[state.selectedEngine]?.length;
}

export function setAvailableEngines(engineNames          , modelsByEngine                          )       {
  state.modelsByEngine = modelsByEngine;
  if (engineNames.length) {
    state.availableEngines = engineNames;
    state.selectedEngine = engineNames[0];
  }
}

// Read the persisted mode once, before any event can change it.
state.interactionMode = (()                  => {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "act" ? "act" : "chat";
  } catch {
    return "chat";
  }
})();
