import { createElement } from "/static/dom.js";

// Spans are capped at 2000 characters so an unclosed opener cannot make the scan quadratic.
// Groups: 1 code, 2 strong, 3 em, 4 link text, 5 link URL. Built from parts to keep each regex under the complexity limit.
const INLINE_PATTERN = new RegExp(
  [
    /`([^`]{1,2000})`/,
    /\*\*([^*]{1,2000})\*\*/,
    /\*([^*\s][^*]{0,1999})\*/,
    /\[([^\]]{1,2000})\]\((\S{1,2000}?)\)/,
  ]
    .map((part) => part.source)
    .join("|"),
  "g",
);
const LIST_ITEM_PATTERN = /^\s*([-*+]|\d+[.)])\s+/;
const BLOCK_START_PATTERN = /^(#{1,6}\s|`{3}|~{3}|\s*>)/;
const HTTP_URL_PATTERN = /^https?:\/\//i;
const QUOTE_PREFIX_PATTERN = /^\s*>\s?/;
const MAX_QUOTE_DEPTH = 32;

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return splitTableCells(line).every((cell) => /^:?-+:?$/.test(cell));
}

function appendWrapped(
  tag: keyof HTMLElementTagNameMap,
  text: string,
  parent: ParentNode,
): void {
  const element = createElement(tag);
  appendInline(text, element);
  parent.append(element);
}

function appendInline(text: string, parent: ParentNode): void {
  const pattern = new RegExp(INLINE_PATTERN);
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parent.append(text.slice(lastIndex, match.index));
    if (match[1] != null) parent.append(createElement("code", "", match[1]));
    else if (match[2] != null) appendWrapped("strong", match[2], parent);
    else if (match[3] != null) appendWrapped("em", match[3], parent);
    else if (match[5] != null && HTTP_URL_PATTERN.test(match[5])) {
      const anchor = createElement("a", "", match[4]);
      anchor.href = match[5];
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      parent.append(anchor);
    } else parent.append(match[4]);
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parent.append(text.slice(lastIndex));
}

function readCodeBlock(
  lines: string[],
  lineIndex: number,
  fence: string,
): [HTMLPreElement, number] {
  const language = lines[lineIndex].slice(fence.length).trim().toLowerCase();
  const buffer: string[] = [];
  lineIndex++;
  while (lineIndex < lines.length && !lines[lineIndex].startsWith(fence)) buffer.push(lines[lineIndex++]);
  const pre = createElement("pre", language === "mermaid" ? "mermaid" : "");
  pre.append(createElement("code", "", buffer.join("\n")));
  return [pre, lineIndex + 1];
}

// The depth cap keeps agent-written quote chains from growing the stack without bound.
function readQuoteBlock(
  lines: string[],
  lineIndex: number,
  lineOffset: number,
  quoteDepth: number,
): [HTMLQuoteElement, number] {
  const firstLine = lineIndex;
  const buffer: string[] = [];
  while (lineIndex < lines.length && QUOTE_PREFIX_PATTERN.test(lines[lineIndex])) {
    buffer.push(lines[lineIndex++].replace(QUOTE_PREFIX_PATTERN, ""));
  }
  const blockquote = createElement("blockquote");
  const innerSource = buffer.join("\n");
  if (quoteDepth >= MAX_QUOTE_DEPTH) {
    const paragraph = createElement("p");
    appendInline(innerSource, paragraph);
    blockquote.append(paragraph);
  } else {
    blockquote.append(renderMarkdown(innerSource, lineOffset + firstLine, quoteDepth + 1));
  }
  return [blockquote, lineIndex];
}

function isTableStart(lines: string[], lineIndex: number): boolean {
  return lines[lineIndex].includes("|")
    && lineIndex + 1 < lines.length
    && lines[lineIndex + 1].includes("-")
    && isTableSeparator(lines[lineIndex + 1]);
}

function readTableBlock(lines: string[], lineIndex: number): [HTMLDivElement, number] {
  const rowOf = (line: string, tag: "th" | "td"): HTMLTableRowElement => {
    const tableRow = createElement("tr");
    splitTableCells(line).forEach((cell) => appendWrapped(tag, cell, tableRow));
    return tableRow;
  };
  const table = createElement("table");
  table.append(rowOf(lines[lineIndex], "th"));
  lineIndex += 2;
  while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
    table.append(rowOf(lines[lineIndex++], "td"));
  }
  const wrapper = createElement("div", "tw");
  wrapper.append(table);
  return [wrapper, lineIndex];
}

function readListBlock(
  lines: string[],
  lineIndex: number,
  lineOffset: number,
): [HTMLOListElement | HTMLUListElement, number] {
  const list = createElement(/^\s*\d/.test(lines[lineIndex]) ? "ol" : "ul");
  while (lineIndex < lines.length && LIST_ITEM_PATTERN.test(lines[lineIndex])) {
    const before = list.childElementCount;
    appendWrapped("li", lines[lineIndex].replace(LIST_ITEM_PATTERN, ""), list);
    markSourceLines(list.children[before], lineIndex, lineIndex + 1, lineOffset);
    lineIndex++;
  }
  return [list, lineIndex];
}

function readParagraphBlock(
  lines: string[],
  lineIndex: number,
): [HTMLParagraphElement, number] {
  const buffer: string[] = [];
  while (
    lineIndex < lines.length
    && lines[lineIndex].trim()
    && !BLOCK_START_PATTERN.test(lines[lineIndex])
    && !LIST_ITEM_PATTERN.test(lines[lineIndex])
  ) {
    buffer.push(lines[lineIndex++]);
  }
  if (!buffer.length) buffer.push(lines[lineIndex++]);
  const paragraph = createElement("p");
  appendInline(buffer.join(" "), paragraph);
  return [paragraph, lineIndex];
}

// Marks a block with the 1-based, inclusive source lines it came from, so a selection can be traced back to the file.
// `lineOffset` is the index of the first line of `lines` in the whole file, for blocks nested in a quote.
function markSourceLines(node: Element, first: number, end: number, lineOffset: number): void {
  if (!(node instanceof HTMLElement)) return;
  node.dataset.l1 = String(lineOffset + first + 1);
  node.dataset.l2 = String(lineOffset + Math.max(first + 1, end));
}

export function renderMarkdown(sourceText: string, lineOffset = 0, quoteDepth = 0): DocumentFragment {
  const root = document.createDocumentFragment();
  const lines = sourceText.replace(/\r\n?/g, "\n").split("\n");
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    let node: HTMLElement;
    const firstLine = lineIndex;
    if (!line.trim()) {
      lineIndex++;
      continue;
    }
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    const headingMatch = fenceMatch ? null : /^(#{1,6})\s(.*)$/.exec(line);
    if (fenceMatch) [node, lineIndex] = readCodeBlock(lines, lineIndex, fenceMatch[1]);
    else if (headingMatch) {
      const heading = createElement(
        `h${Math.min(headingMatch[1].length, 4)}` as "h1" | "h2" | "h3" | "h4",
      );
      appendInline(headingMatch[2].trimStart(), heading);
      node = heading;
      lineIndex++;
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      node = createElement("hr");
      lineIndex++;
    } else if (/^\s*>/.test(line)) {
      [node, lineIndex] = readQuoteBlock(lines, lineIndex, lineOffset, quoteDepth);
    } else if (isTableStart(lines, lineIndex)) {
      [node, lineIndex] = readTableBlock(lines, lineIndex);
    } else if (LIST_ITEM_PATTERN.test(line)) {
      [node, lineIndex] = readListBlock(lines, lineIndex, lineOffset);
    } else {
      [node, lineIndex] = readParagraphBlock(lines, lineIndex);
    }
    markSourceLines(node, firstLine, Math.min(lineIndex, lines.length), lineOffset);
    root.append(node);
  }
  return root;
}
