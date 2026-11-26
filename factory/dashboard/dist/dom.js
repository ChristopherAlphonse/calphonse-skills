// Generated from dom.ts by build.mjs. Do not edit.
export const el =                                        (tag   , cls         , text                )                           => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const chip = (text        , cls = "")                  => el("span", `chip ${cls}`, text);

export const $ = (id        )              => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};

export function button(
  label        ,
  cls        ,
  onclick            ,
)                    {
  const b = el("button", cls, label);
  b.type = "button";
  b.onclick = onclick;
  return b;
}
export function row(...chips               )                 {
  const r = el("div", "row");
  r.append(...chips);
  return r;
}
