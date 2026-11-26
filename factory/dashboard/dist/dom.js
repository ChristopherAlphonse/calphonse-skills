// Generated from dom.ts by build.mjs. Do not edit.
export function createElement                                       (
  tag   ,
  className         ,
  text                ,
)                           {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

export function createChip(text        , className = "")                  {
  return createElement("span", `chip ${className}`, text);
}

export function requireElement(id        )              {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element #${id}`);
  return element;
}

export function createButton(
  label        ,
  className        ,
  onClick            ,
)                    {
  const button = createElement("button", className, label);
  button.type = "button";
  button.onclick = onClick;
  return button;
}

export function createChipRow(...chips               )                 {
  const row = createElement("div", "row");
  row.append(...chips);
  return row;
}
