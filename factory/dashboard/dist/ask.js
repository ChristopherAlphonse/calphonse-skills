// Generated from ask.ts by build.mjs. Do not edit.
import { $, button, el } from "/static/dom.js";
import { renderMarkdown } from "/static/markdown.js";
                                             

                                                                                          
let api     ;
let view            ;
let views                   ;
let pollOne                               ;

export function configureAsk(deps   
           
                   
                           
                                         
 )       {
  api = deps.api;
  view = deps.view;
  views = deps.views;
  pollOne = deps.pollOne;
}

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
export async function restoreChat()                {
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

export async function ask(question        )                  {
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

export function showMode()       {
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

export function showEngine()       {
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

export function setEngines(list          , choices                          )       {
  modelChoices = choices;
  if (list.length) {
    engineList = list;
    engine = list[0];
  }
}
