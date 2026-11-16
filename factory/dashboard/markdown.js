// Generated from markdown.ts by build.mjs. Do not edit.
import { el } from "/static/dom.js";

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\((\S+?)\)/g;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+/;
const BLOCK_START = /^(#{1,6}\s|`{3}|~{3}|\s*>|\s*([-*+]|\d+[.)])\s)/;
const SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const HTTP_URL = /^https?:\/\//i;

const cells = (line        )           =>
  line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function wrap(tag                             , text        , parent            )       {
  const node = el(tag);
  inline(text, node);
  parent.append(node);
}

function inline(text        , parent            )       {
  const re = new RegExp(INLINE);
  let last = 0;
  let m                        ;
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

function readCode(lines          , i        , fence        )                           {
  const buf           = [];
  i++;
  while (i < lines.length && !lines[i].startsWith(fence)) buf.push(lines[i++]);
  const pre = el("pre");
  pre.append(el("code", "", buf.join("\n")));
  return [pre, i + 1];
}

function readQuote(lines          , i        )                             {
  const buf           = [];
  while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
  const q = el("blockquote");
  q.append(renderMarkdown(buf.join("\n")));
  return [q, i];
}

const isTableStart = (lines          , i        )          =>
  lines[i].includes("|") && i + 1 < lines.length && lines[i + 1].includes("-") && SEPARATOR.test(lines[i + 1]);

function readTable(lines          , i        )                           {
  const rowOf = (line        , tag             )                      => {
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

function readList(lines          , i        )                                                {
  const list = el(/^\s*\d/.test(lines[i]) ? "ol" : "ul");
  while (i < lines.length && LIST_ITEM.test(lines[i])) {
    wrap("li", lines[i++].replace(LIST_ITEM, ""), list);
  }
  return [list, i];
}

function readParagraph(lines          , i        )                                 {
  const buf           = [];
  while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) buf.push(lines[i++]);
  if (!buf.length) buf.push(lines[i++]);
  const p = el("p");
  inline(buf.join(" "), p);
  return [p, i];
}

export function renderMarkdown(src        )                   {
  const root = document.createDocumentFragment();
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m                         ;
    let node      ;
    if (!line.trim()) {
      i++;
      continue;
    }
    if ((m = line.match(/^(`{3,}|~{3,})/))) [node, i] = readCode(lines, i, m[1]);
    else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      const h = el(`h${Math.min(m[1].length, 4)}`                             );
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
