// Generated from mermaid-frame.ts by build.mjs. Do not edit.
// Runs inside the sandboxed diagram frame, which has no cookie and no access to the board. The page sends it a diagram; it sends back the drawing.
                
                                   
                                                               
  
                
                    
                      
   
 

const MAX_SOURCE = 50_000;

function loadLibrary()                   {
  if (window.mermaid) return Promise.resolve(window.mermaid);
  return new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "/frame/mermaid.js";
    tag.onload = () => {
      const lib = window.mermaid;
      if (!lib) return reject(new Error("the library did not load"));
      lib.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
      resolve(lib);
    };
    tag.onerror = () => reject(new Error("FACTORY_MERMAID is not set, so diagrams stay as code"));
    document.head.append(tag);
  });
}

const report = (message        )       => parent.postMessage(message, "*");

function show(svg        )       {
  document.body.innerHTML = svg;
  report({ type: "drawn", svg, height: document.documentElement.scrollHeight });
}

addEventListener("message", async (e                                                                  ) => {
  if (e.source !== parent || e.data?.type !== "draw") return;
  try {
    if (typeof e.data.svg === "string") return show(e.data.svg);
    const lib = await loadLibrary();
    const { svg } = await lib.render("diagram", String(e.data.source).slice(0, MAX_SOURCE));
    show(svg);
  } catch (err) {
    report({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
});
