// Generated from wires.ts by build.mjs. Do not edit.
                                    

                  
               
                
              
                 
 

// A right-angle route with rounded corners, like Floorplan's connectors.
function routeWithRoundedCorners(points                              , radius = 12)         {
  let pathData = `M${points[0][0]},${points[0][1]}`;
  for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex++) {
    const [previousX, previousY] = points[pointIndex - 1];
    const [cornerX, cornerY] = points[pointIndex];
    const [nextX, nextY] = points[pointIndex + 1];
    const incomingLength = Math.hypot(cornerX - previousX, cornerY - previousY) || 1;
    const outgoingLength = Math.hypot(nextX - cornerX, nextY - cornerY) || 1;
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
    pathData += ` L${cornerX - ((cornerX - previousX) / incomingLength) * cornerRadius},${cornerY - ((cornerY - previousY) / incomingLength) * cornerRadius} Q${cornerX},${cornerY} ${cornerX + ((nextX - cornerX) / outgoingLength) * cornerRadius},${cornerY + ((nextY - cornerY) / outgoingLength) * cornerRadius}`;
  }
  const lastPoint = points[points.length - 1];
  return `${pathData} L${lastPoint[0]},${lastPoint[1]}`;
}

export function drawWires(svg             , lanes             , scale        )       {
  const base = lanes.getBoundingClientRect();
  const svgNamespace = "http://www.w3.org/2000/svg";
  const relativeBounds = (rect         )         => ({
    left: (rect.left - base.left) / scale,
    right: (rect.right - base.left) / scale,
    top: (rect.top - base.top) / scale,
    bottom: (rect.bottom - base.top) / scale,
  });
  const wireShapes               = [];
  const createSvgElement =                                       (
    tag   ,
    attributes                        ,
    className        ,
  )                          => {
    const element = document.createElementNS(svgNamespace, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    element.setAttribute("class", className);
    return element;
  };
  for (const stageRow of document.querySelectorAll             (".nodes")) {
    const stageNodes = [...stageRow.children]                 ;
    for (let nodeIndex = 0; nodeIndex + 1 < stageNodes.length; nodeIndex++) {
      const fromBounds = relativeBounds(stageNodes[nodeIndex].getBoundingClientRect());
      const toBounds = relativeBounds(stageNodes[nodeIndex + 1].getBoundingClientRect());
      const isLit = stageNodes[nodeIndex].classList.contains("lit") ? " lit" : "";
      const fromCenterY = (fromBounds.top + fromBounds.bottom) / 2;
      const toCenterY = (toBounds.top + toBounds.bottom) / 2;
      const wrapsBelow = toBounds.top > fromBounds.bottom;
      const wireRoute                               = wrapsBelow
        ? [
            [fromBounds.right, fromCenterY],
            [fromBounds.right + 28, fromCenterY],
            [fromBounds.right + 28, (fromBounds.bottom + toBounds.top) / 2],
            [toBounds.left - 28, (fromBounds.bottom + toBounds.top) / 2],
            [toBounds.left - 28, toCenterY],
            [toBounds.left, toCenterY],
          ]
        : [
            [fromBounds.right, fromCenterY],
            [(fromBounds.right + toBounds.left) / 2, fromCenterY],
            [(fromBounds.right + toBounds.left) / 2, toCenterY],
            [toBounds.left, toCenterY],
          ];
      wireShapes.push(createSvgElement("path", { d: routeWithRoundedCorners(wireRoute) }, `wire${isLit}`));
      for (const [endpointX, endpointY] of [wireRoute[0], wireRoute[wireRoute.length - 1]]) {
        wireShapes.push(
          createSvgElement(
            "circle",
            { cx: String(endpointX), cy: String(endpointY), r: "4.5" },
            `port${isLit}`,
          ),
        );
      }
    }
  }
  svg.setAttribute("width", String(base.width / scale));
  svg.setAttribute("height", String(base.height / scale));
  svg.replaceChildren(...wireShapes);
}
