import { el } from "/static/dom.js";

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\((\S+?)\)/g;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+/;
const BLOCK_START = /^(#{1,6}\s|`{3}|~{3}|\s*>|\s*([-*+]|\d+[.)])\s)/;
const SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const HTTP_URL = /^https?:\/\//i;

const cells = (line: string): string[] =>
  line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function wrap(tag: keyof HTMLElementTagNameMap, text: string, parent: ParentNode): void {
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

function readCode(lines: string[], i: number, fence: string): [HTMLPreElement, number] {
  const buf: string[] = [];
  i++;
  while (i < lines.length && !lines[i].startsWith(fence)) buf.push(lines[i++]);
  const pre = el("pre");
  pre.append(el("code", "", buf.join("\n")));
  return [pre, i + 1];
}

function readQuote(lines: string[], i: number): [HTMLQuoteElement, number] {
  const buf: string[] = [];
  while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
  const q = el("blockquote");
  q.append(renderMarkdown(buf.join("\n")));
  return [q, i];
}

const isTableStart = (lines: string[], i: number): boolean =>
  lines[i].includes("|") && i + 1 < lines.length && lines[i + 1].includes("-") && SEPARATOR.test(lines[i + 1]);

function readTable(lines: string[], i: number): [HTMLDivElement, number] {
  const rowOf = (line: string, tag: "th" | "td"): HTMLTableRowElement => {
    const tr = el("tr");
    cells(line).forEach((c) => wrap(tag, c, tr));
    return tr;
  };
  const table = el("table");
  table.append(rowOf(lines[i], "th"));
  i += 2;
  while (i < lines.length && lines[i].includes("|") && lines[i].trim()) table.append(rowOf(lines[i++], "td"));
  const wrapper = el("div", "tw");
  wrapper.append(table);
  return [wrapper, i];
}

function readList(lines: string[], i: number): [HTMLOListElement | HTMLUListElement, number] {
  const list = el(/^\s*\d/.test(lines[i]) ? "ol" : "ul");
  while (i < lines.length && LIST_ITEM.test(lines[i])) {
    wrap("li", lines[i++].replace(LIST_ITEM, ""), list);
  }
  return [list, i];
}

function readParagraph(lines: string[], i: number): [HTMLParagraphElement, number] {
  const buf: string[] = [];
  while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) buf.push(lines[i++]);
  if (!buf.length) buf.push(lines[i++]);
  const p = el("p");
  inline(buf.join(" "), p);
  return [p, i];
}

export function renderMarkdown(src: string): DocumentFragment {
  const root = document.createDocumentFragment();
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m: RegExpMatchArray | null;
    let node: Node;
    if (!line.trim()) {
      i++;
      continue;
    }
    if ((m = line.match(/^(`{3,}|~{3,})/))) [node, i] = readCode(lines, i, m[1]);
    else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      const h = el(`h${Math.min(m[1].length, 4)}` as "h1" | "h2" | "h3" | "h4");
      inline(m[2], h);
      node = h;
      i++;
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      node = el("hr");
      i++;
    } else if (/^\s*>/.test(line)) [node, i] = readQuote(lines, i);
    else if (isTableStart(lines, i)) [node, i] = readTable(lines, i);
    else if (LIST_ITEM.test(line)) [node, i] = readList(lines, i);
    else [node, i] = readParagraph(lines, i);
    root.append(node);
  }
  return root;
}
