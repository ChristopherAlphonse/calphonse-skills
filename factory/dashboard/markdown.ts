import { el } from "/static/dom.js";

// Spans are capped at 2000 characters so an unclosed opener cannot make the scan quadratic.
// Groups: 1 code, 2 strong, 3 em, 4 link text, 5 link URL. Built from parts to keep each regex under the complexity limit.
const INLINE = new RegExp(
  [
    /`([^`]{1,2000})`/,
    /\*\*([^*]{1,2000})\*\*/,
    /\*([^*\s][^*]{0,1999})\*/,
    /\[([^\]]{1,2000})\]\((\S{1,2000}?)\)/,
  ]
    .map((r) => r.source)
    .join("|"),
  "g",
);
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+/;
const BLOCK_START = /^(#{1,6}\s|`{3}|~{3}|\s*>)/;
const HTTP_URL = /^https?:\/\//i;

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
const isSeparator = (line: string): boolean =>
  cells(line).every((c) => /^:?-+:?$/.test(c));

function wrap(
  tag: keyof HTMLElementTagNameMap,
  text: string,
  parent: ParentNode,
): void {
  const node = el(tag);
  inline(text, node);
  parent.append(node);
}

function inline(text: string, parent: ParentNode): void {
  const re = new RegExp(INLINE);
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parent.append(text.slice(last, m.index));
    if (m[1] != null) parent.append(el("code", "", m[1]));
    else if (m[2] != null) wrap("strong", m[2], parent);
    else if (m[3] != null) wrap("em", m[3], parent);
    else if (HTTP_URL.test(m[5])) {
      const a = el("a", "", m[4]);
      a.href = m[5];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      parent.append(a);
    } else parent.append(m[4]);
    last = re.lastIndex;
  }
  if (last < text.length) parent.append(text.slice(last));
}

function readCode(
  lines: string[],
  i: number,
  fence: string,
): [HTMLPreElement, number] {
  const lang = lines[i].slice(fence.length).trim().toLowerCase();
  const buf: string[] = [];
  i++;
  while (i < lines.length && !lines[i].startsWith(fence)) buf.push(lines[i++]);
  const pre = el("pre", lang === "mermaid" ? "mermaid" : "");
  pre.append(el("code", "", buf.join("\n")));
  return [pre, i + 1];
}

function readQuote(
  lines: string[],
  i: number,
  offset: number,
): [HTMLQuoteElement, number] {
  const first = i;
  const buf: string[] = [];
  while (i < lines.length && /^\s*>/.test(lines[i]))
    buf.push(lines[i++].replace(/^\s*>\s?/, ""));
  const q = el("blockquote");
  q.append(renderMarkdown(buf.join("\n"), offset + first));
  return [q, i];
}

const isTableStart = (lines: string[], i: number): boolean =>
  lines[i].includes("|") &&
  i + 1 < lines.length &&
  lines[i + 1].includes("-") &&
  isSeparator(lines[i + 1]);

function readTable(lines: string[], i: number): [HTMLDivElement, number] {
  const rowOf = (line: string, tag: "th" | "td"): HTMLTableRowElement => {
    const tr = el("tr");
    cells(line).forEach((c) => wrap(tag, c, tr));
    return tr;
  };
  const table = el("table");
  table.append(rowOf(lines[i], "th"));
  i += 2;
  while (i < lines.length && lines[i].includes("|") && lines[i].trim())
    table.append(rowOf(lines[i++], "td"));
  const wrapper = el("div", "tw");
  wrapper.append(table);
  return [wrapper, i];
}

function readList(
  lines: string[],
  i: number,
  offset: number,
): [HTMLOListElement | HTMLUListElement, number] {
  const list = el(/^\s*\d/.test(lines[i]) ? "ol" : "ul");
  while (i < lines.length && LIST_ITEM.test(lines[i])) {
    const before = list.childElementCount;
    wrap("li", lines[i].replace(LIST_ITEM, ""), list);
    stamp(list.children[before], i, i + 1, offset);
    i++;
  }
  return [list, i];
}

function readParagraph(
  lines: string[],
  i: number,
): [HTMLParagraphElement, number] {
  const buf: string[] = [];
  while (
    i < lines.length &&
    lines[i].trim() &&
    !BLOCK_START.test(lines[i]) &&
    !LIST_ITEM.test(lines[i])
  )
    buf.push(lines[i++]);
  if (!buf.length) buf.push(lines[i++]);
  const p = el("p");
  inline(buf.join(" "), p);
  return [p, i];
}

// Marks a block with the 1-based, inclusive source lines it came from, so a selection can be traced back to the file.
// `offset` is the index of the first line of `lines` in the whole file, for blocks nested in a quote.
function stamp(node: Element, first: number, end: number, offset: number): void {
  if (!(node instanceof HTMLElement)) return;
  node.dataset.l1 = String(offset + first + 1);
  node.dataset.l2 = String(offset + Math.max(first + 1, end));
}

export function renderMarkdown(src: string, offset = 0): DocumentFragment {
  const root = document.createDocumentFragment();
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let node: HTMLElement;
    const first = i;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^(`{3,}|~{3,})/.exec(line);
    const heading = fence ? null : /^(#{1,6})\s(.*)$/.exec(line);
    if (fence) [node, i] = readCode(lines, i, fence[1]);
    else if (heading) {
      const h = el(
        `h${Math.min(heading[1].length, 4)}` as "h1" | "h2" | "h3" | "h4",
      );
      inline(heading[2].trimStart(), h);
      node = h;
      i++;
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      node = el("hr");
      i++;
    } else if (/^\s*>/.test(line)) [node, i] = readQuote(lines, i, offset);
    else if (isTableStart(lines, i)) [node, i] = readTable(lines, i);
    else if (LIST_ITEM.test(line)) [node, i] = readList(lines, i, offset);
    else [node, i] = readParagraph(lines, i);
    stamp(node, first, Math.min(i, lines.length), offset);
    root.append(node);
  }
  return root;
}
