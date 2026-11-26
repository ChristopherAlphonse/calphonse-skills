// Generated from wires.ts by build.mjs. Do not edit.
                           
// A right-angle route with rounded corners, like Floorplan's connectors.
function routed(pts      , radius = 12)         {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py) || 1;
    const outLen = Math.hypot(nx - cx, ny - cy) || 1;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    d += ` L${cx - ((cx - px) / inLen) * r},${cy - ((cy - py) / inLen) * r} Q${cx},${cy} ${cx + ((nx - cx) / outLen) * r},${cy + ((ny - cy) / outLen) * r}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

export function drawWires(svg             , lanes             , scale        )       {
  const base = lanes.getBoundingClientRect();
  const ns = "http://www.w3.org/2000/svg";
  const at = (r         ) => ({
    l: (r.left - base.left) / scale,
    r: (r.right - base.left) / scale,
    t: (r.top - base.top) / scale,
    b: (r.bottom - base.top) / scale,
  });
  const shapes               = [];
  const mk =                                       (
    tag   ,
    attrs                        ,
    cls        ,
  )                          => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.setAttribute("class", cls);
    return e;
  };
  for (const nodes of document.querySelectorAll             (".nodes")) {
    const cards = [...nodes.children]                 ;
    for (let i = 0; i + 1 < cards.length; i++) {
      const a = at(cards[i].getBoundingClientRect());
      const b = at(cards[i + 1].getBoundingClientRect());
      const lit = cards[i].classList.contains("lit") ? " lit" : "";
      const y1 = (a.t + a.b) / 2;
      const y2 = (b.t + b.b) / 2;
      const wrap = b.t > a.b;
      const route       = wrap
        ? [
            [a.r, y1],
            [a.r + 28, y1],
            [a.r + 28, (a.b + b.t) / 2],
            [b.l - 28, (a.b + b.t) / 2],
            [b.l - 28, y2],
            [b.l, y2],
          ]
        : [
            [a.r, y1],
            [(a.r + b.l) / 2, y1],
            [(a.r + b.l) / 2, y2],
            [b.l, y2],
          ];
      shapes.push(mk("path", { d: routed(route) }, `wire${lit}`));
      for (const [cx, cy] of [route[0], route[route.length - 1]])
        shapes.push(
          mk(
            "circle",
            { cx: String(cx), cy: String(cy), r: "4.5" },
            `port${lit}`,
          ),
        );
    }
  }
  svg.setAttribute("width", String(base.width / scale));
  svg.setAttribute("height", String(base.height / scale));
  svg.replaceChildren(...shapes);
}
