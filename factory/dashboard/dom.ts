export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string | null,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

export function createChip(text: string, className = ""): HTMLSpanElement {
  return createElement("span", `chip ${className}`, text);
}

export function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element #${id}`);
  return element;
}

export function createButton(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = createElement("button", className, label);
  button.type = "button";
  button.onclick = onClick;
  return button;
}

export function createChipRow(...chips: HTMLElement[]): HTMLDivElement {
  const row = createElement("div", "row");
  row.append(...chips);
  return row;
}
