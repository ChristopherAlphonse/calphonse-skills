// Generated from mermaid-frame.ts by build.mjs. Do not edit.
// This stays a classic script: mermaid.html loads it without type="module".
                       
                                   
                                                               
  

const MAX_DIAGRAM_SOURCE_LENGTH = 50_000;

function isMermaidLibrary(value         )                          {
  if (typeof value !== "object" || value === null) return false;
  if (!("initialize" in value) || !("render" in value)) return false;
  return typeof value.initialize === "function" && typeof value.render === "function";
}

function currentLibrary()                             {
  const candidate          = Reflect.get(window, "mermaid");
  return isMermaidLibrary(candidate) ? candidate : undefined;
}

function loadMermaidLibrary()                          {
  const loaded = currentLibrary();
  if (loaded) return Promise.resolve(loaded);
  return new Promise((resolve, reject) => {
    const scriptElement = document.createElement("script");
    scriptElement.src = "/frame/mermaid.js";
    scriptElement.onload = () => {
      const library = currentLibrary();
      if (!library) return reject(new Error("the library did not load"));
      library.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
      resolve(library);
    };
    scriptElement.onerror = () => reject(new Error("FACTORY_MERMAID is not set, so diagrams stay as code"));
    document.head.append(scriptElement);
  });
}

function reportToParent(message        )       {
  parent.postMessage(message, "*");
}

function showDiagram(svgMarkup        )       {
  document.body.innerHTML = svgMarkup;
  reportToParent({ type: "drawn", svg: svgMarkup, height: document.documentElement.scrollHeight });
}

addEventListener("message", async (messageEvent                                                                  ) => {
  if (messageEvent.source !== parent || messageEvent.data?.type !== "draw") return;
  try {
    if (typeof messageEvent.data.svg === "string") return showDiagram(messageEvent.data.svg);
    const library = await loadMermaidLibrary();
    const { svg } = await library.render("diagram", String(messageEvent.data.source).slice(0, MAX_DIAGRAM_SOURCE_LENGTH));
    showDiagram(svg);
  } catch (error) {
    reportToParent({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
});
