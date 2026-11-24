import { el } from "/static/dom.js";

type Drawn = { svg: string; height: number };
type FrameMessage = { type?: string; svg?: string; height?: number; message?: string };

// Diagrams are drawn inside a sandboxed frame (see mermaid-frame.ts). The page never runs Mermaid itself.
const frames = new Map<HTMLIFrameElement, string>();
const drawn = new Map<string, Drawn>();
let available: Promise<boolean> | null = null;

const isAvailable = (): Promise<boolean> =>
  (available ??= fetch("/api/features", { credentials: "same-origin", headers: { "X-Factory": "1" } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((f: { mermaid?: boolean }) => f.mermaid === true)
    .catch(() => false));

function failed(box: HTMLElement, source: string, message: string): void {
  const pre = el("pre", "mermaid-failed");
  pre.append(el("code", "", source));
  box.replaceChildren(el("div", "mmd-err", `Diagram error: ${message}`), pre);
}

window.addEventListener("message", (e: MessageEvent<FrameMessage>) => {
  for (const [frame, source] of frames) {
    if (!frame.isConnected) frames.delete(frame);
    else if (frame.contentWindow === e.source) {
      const m = e.data ?? {};
      if (m.type === "drawn" && typeof m.svg === "string" && typeof m.height === "number") {
        drawn.set(source, { svg: m.svg, height: m.height });
        frame.style.height = `${Math.ceil(m.height)}px`;
      } else if (m.type === "error") {
        frames.delete(frame);
        failed(frame.parentElement ?? frame, source, String(m.message ?? "could not draw"));
      }
    }
  }
});

function diagram(source: string): HTMLElement {
  const box = el("div", "mmd");
  const frame = el("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.title = "Diagram";
  frame.src = "/frame/mermaid.html";
  const cached = drawn.get(source);
  if (cached) frame.style.height = `${Math.ceil(cached.height)}px`;
  frame.addEventListener("load", () => frame.contentWindow?.postMessage({ type: "draw", source, svg: cached?.svg }, "*"));
  frames.set(frame, source);
  box.append(frame);
  return box;
}

/** Swaps each ```mermaid block under `root` for a drawn diagram. Call it before `root` is attached; blocks are collected at once. */
export async function enhanceMermaid(root: ParentNode): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>("pre.mermaid")];
  if (!blocks.length || !(await isAvailable())) return;
  for (const pre of blocks) pre.replaceWith(diagram(pre.textContent ?? ""));
}
