// Generated from mermaid-frame.ts by build.mjs. Do not edit.
// Runs inside the sandboxed diagram frame, which has no cookie and no access to the board. The page sends it a diagram; it sends back the drawing.
                       
                                   
                                                               
  
                
                    
                             
   
 

const MAX_DIAGRAM_SOURCE_LENGTH = 50_000;

function loadMermaidLibrary()                          {
  if (window.mermaid) return Promise.resolve(window.mermaid);
  return new Promise((resolve, reject) => {
    const scriptElement = document.createElement("script");
    scriptElement.src = "/frame/mermaid.js";
    scriptElement.onload = () => {
      const library = window.mermaid;
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
