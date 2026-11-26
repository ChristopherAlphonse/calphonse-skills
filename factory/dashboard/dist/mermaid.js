// Generated from mermaid.ts by build.mjs. Do not edit.
import { createElement } from "/static/dom.js";
import { parseFeatureFlags, request } from "/static/payloads.js";

                                                    
                                                                                              

// Diagrams are drawn inside a sandboxed frame (see mermaid-frame.ts). The page never runs Mermaid itself.
const framesByElement = new Map                           ();
const diagramsBySource = new Map                      ();
let availabilityPromise                          = null;

function isMermaidAvailable()                   {
  if (!availabilityPromise) {
    availabilityPromise = request("/api/features")
      .then(async (response) => {
        if (!response.ok) return false;
        const flags          = await response.json();
        return parseFeatureFlags(flags).mermaid;
      })
      .catch(() => false);
  }
  return availabilityPromise;
}

function showDiagramError(container             , diagramSource        , message        )       {
  const pre = createElement("pre", "mermaid-failed");
  pre.append(createElement("code", "", diagramSource));
  container.replaceChildren(createElement("div", "mmd-err", `Diagram error: ${message}`), pre);
}

window.addEventListener("message", (messageEvent                                   ) => {
  for (const [frame, diagramSource] of framesByElement) {
    if (!frame.isConnected) framesByElement.delete(frame);
    else if (frame.contentWindow === messageEvent.source) {
      const message = messageEvent.data ?? {};
      if (message.type === "drawn" && typeof message.svg === "string" && typeof message.height === "number") {
        diagramsBySource.set(diagramSource, { svg: message.svg, height: message.height });
        frame.style.height = `${Math.ceil(message.height)}px`;
      } else if (message.type === "error") {
        framesByElement.delete(frame);
        showDiagramError(frame.parentElement ?? frame, diagramSource, String(message.message ?? "could not draw"));
      }
    }
  }
});

function createDiagram(diagramSource        )              {
  const diagramBox = createElement("div", "mmd");
  const frame = createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.title = "Diagram";
  frame.src = "/frame/mermaid.html";
  const cachedDiagram = diagramsBySource.get(diagramSource);
  if (cachedDiagram) frame.style.height = `${Math.ceil(cachedDiagram.height)}px`;
  frame.addEventListener("load", () => frame.contentWindow?.postMessage({ type: "draw", source: diagramSource, svg: cachedDiagram?.svg }, "*"));
  framesByElement.set(frame, diagramSource);
  diagramBox.append(frame);
  return diagramBox;
}

/** Swaps each ```mermaid block under `root` for a drawn diagram. Call it before `root` is attached; blocks are collected at once. */
export async function enhanceMermaid(root            )                {
  const codeBlocks = [...root.querySelectorAll             ("pre.mermaid")];
  if (!codeBlocks.length || !(await isMermaidAvailable())) return;
  for (const block of codeBlocks) block.replaceWith(createDiagram(block.textContent ?? ""));
}
