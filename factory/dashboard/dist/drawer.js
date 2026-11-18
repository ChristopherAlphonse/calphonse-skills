// Generated from drawer.ts by build.mjs. Do not edit.
// Drag handle, keyboard resize, double-click and Reset button for the side drawer. The saved width is shared by every page that has one.
export function initDrawerResize()       {
  const $ = (id        )              => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`missing element #${id}`);
    return node;
  };
  const DRAWER_MIN = 320;
  const DRAWER_KEY = "factory.drawerWidth";

  function setDrawerWidth(px        , save          )         {
    const w = Math.round(Math.min(Math.max(px, DRAWER_MIN), window.innerWidth));
    document.documentElement.style.setProperty("--drawer-w", w + "px");
    if (save) localStorage.setItem(DRAWER_KEY, String(w));
    return w;
  }

  const grip = $("grip");
  grip.onpointerdown = (e) => {
    grip.setPointerCapture(e.pointerId);
    grip.classList.add("drag");
  };
  grip.onpointermove = (e) => {
    if (grip.hasPointerCapture(e.pointerId)) setDrawerWidth(window.innerWidth - e.clientX);
  };
  grip.onpointerup = (e) => {
    grip.classList.remove("drag");
    setDrawerWidth(window.innerWidth - e.clientX, true);
  };
  grip.onkeydown = (e) => {
    const dir = ({ ArrowLeft: 1, ArrowRight: -1 }                                      )[e.key];
    if (!dir) return;
    e.preventDefault();
    setDrawerWidth($("drawer").offsetWidth + dir * 40, true);
  };
  function resetDrawerWidth()       {
    localStorage.removeItem(DRAWER_KEY);
    document.documentElement.style.removeProperty("--drawer-w");
  }
  grip.ondblclick = resetDrawerWidth;
  $("reset").onclick = resetDrawerWidth;
  const saved = Number(localStorage.getItem(DRAWER_KEY));
  if (saved) setDrawerWidth(saved);
}
