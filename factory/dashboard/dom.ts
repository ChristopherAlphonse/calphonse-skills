export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string | null): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const chip = (text: string, cls = ""): HTMLSpanElement => el("span", `chip ${cls}`, text);
