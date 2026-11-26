export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string | null): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const chip = (text: string, cls = ""): HTMLSpanElement => el("span", `chip ${cls}`, text);

export const $ = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};

export function button(
  label: string,
  cls: string,
  onclick: () => void,
): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.onclick = onclick;
  return b;
}
export function row(...chips: HTMLElement[]): HTMLDivElement {
  const r = el("div", "row");
  r.append(...chips);
  return r;
}
