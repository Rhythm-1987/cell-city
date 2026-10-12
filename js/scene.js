"use strict";

/*
 * Builds the pixel-art Cell City scene inside an <svg viewBox="0 0 1000 640">.
 * Used interactively on city.html and as a static illustration on the home
 * page (<svg data-cell-scene>).
 *
 * Everything is snapped to an 8-unit tile grid (environment) or placed as
 * sprites whose pixels are 3-4 units, so the whole scene keeps a consistent
 * crisp pixel look while each building remains its own SVG group.
 */
(function () {
  const CC = (window.CellCity = window.CellCity || {});
  const SVG_NS = "http://www.w3.org/2000/svg";

  const TILE = 8;
  const CELL = { cx: 500, cy: 320, rx: 432, ry: 272 };
  // Membrane thickness, measured inwards from the cell edge (in units).
  const MEMBRANE = { outerLayer: 4, tails: 12, innerLayer: 20 };
  const ANIMATION_STEP_MS = 50; // ~20 fps keeps motion deliberately "steppy"
  const PIXEL_SNAP = 4;

  // Buildings: x/y are the sprite's top-left corner in map units.
  const PLACEMENTS = [
    { id: "nucleus", sprite: "nucleus", x: 412, y: 150, scale: 4, label: "below" },
    { id: "mitochondria", sprite: "mitochondria", x: 700, y: 170, scale: 3, label: "below" },
    { id: "mitochondria", sprite: "mitochondria", x: 260, y: 170, scale: 3, label: null },
    { id: "ribosomes", sprite: "ribosome-yard", x: 96, y: 344, scale: 3, label: "below" },
    { id: "rough-er", sprite: "rough-er", x: 232, y: 292, scale: 4, label: "above" },
    { id: "smooth-er", sprite: "smooth-er", x: 630, y: 282, scale: 4, label: "below" },
    { id: "golgi", sprite: "golgi", x: 320, y: 416, scale: 4, label: "below" },
    { id: "lysosomes", sprite: "lysosome", x: 676, y: 424, scale: 3, label: "below" },
    { id: "lysosomes", sprite: "lysosome", x: 840, y: 300, scale: 3, label: null },
    { id: "vesicles", sprite: "vesicle-depot", x: 520, y: 384, scale: 3, label: "below" },
  ];

  // Environment items (membrane / cytoplasm / cytoskeleton) and where their
  // map labels sit. Anchor "start" labels hang to the right of x.
  const ENV_LABELS = {
    membrane: { x: 500, y: 100 },
    cytoplasm: { x: 168, y: 262 },
    cytoskeleton: { x: 516, y: 528, anchor: "start" },
  };

  // Cytoskeleton roads. `width` is the brush size in tiles.
  const ROADS = [
    { width: 2, points: [[404, 344], [760, 344]] },
    { width: 2, points: [[496, 312], [496, 572]] },
    { width: 1, points: [[412, 236], [386, 236]] },
    { width: 1, points: [[323, 245], [323, 292]] },
    { width: 1, points: [[588, 214], [700, 214]] },
    { width: 1, points: [[228, 388], [250, 388]] },
    { width: 1, points: [[388, 372], [388, 426]] },
    { width: 1, points: [[452, 466], [676, 466]] },
    { width: 1, points: [[452, 490], [496, 490]] },
    { width: 1, points: [[496, 400], [520, 400]] },
    { width: 1, points: [[780, 344], [780, 250]] },
    { width: 1, points: [[760, 344], [864, 344], [864, 348]] },
  ];

  // Vesicle routes follow the roads: ER -> Golgi, Golgi -> cell exit
  // (exocytosis), Golgi -> lysosome.
  const VESICLE_FLOWS = [
    { points: [[388, 360], [388, 430]], speed: 20, count: 1 },
    { points: [[452, 490], [496, 490], [496, 566]], speed: 28, count: 2 },
    { points: [[452, 466], [672, 466]], speed: 32, count: 2 },
  ];

  // ATP streams are illustrative: amber pixels drift outwards from each power
  // plant to show energy being supplied, not literal ATP routes.
  const ATP_STREAMS = [
    { from: [762, 205], directions: [[-0.97, 0.2], [-0.3, 0.95]] },
    { from: [323, 207], directions: [[0.95, 0.1], [0, 1]] },
  ];
  const ATP_PARTICLES_PER_STREAM = 3;
  const ATP_CYCLE_SECONDS = 3.2;
  const ATP_TRAVEL = { start: 36, distance: 80 };

  const MEMBRANE_PROTEIN_ANGLES = [0.35, 0.9, 1.5, 2.1, 2.7, 3.45, 4.0, 4.55, 5.1, 5.7];

  function svgEl(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
    }
    children.flat().forEach((c) => c && el.append(c));
    return el;
  }

  // ---- tiles ------------------------------------------------------------------

  function hash(x, y) {
    return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;
  }

  // Merge horizontal runs of tiles ("tx,ty" keys) into one compact path.
  function tilesToPath(keys) {
    const rows = new Map();
    keys.forEach((key) => {
      const [tx, ty] = key.split(",").map(Number);
      if (!rows.has(ty)) rows.set(ty, []);
      rows.get(ty).push(tx);
    });
    const d = [];
    rows.forEach((xs, ty) => {
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length; ) {
        let j = i;
        while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
        const w = (xs[j] - xs[i] + 1) * TILE;
        d.push(`M${xs[i] * TILE} ${ty * TILE}h${w}v${TILE}h-${w}z`);
        i = j + 1;
      }
    });
    return d.join("");
  }

  function tilePath(className, keys) {
    return keys.size ? svgEl("path", { class: className, d: tilesToPath(keys) }) : null;
  }

  // Approximate distance inwards from the cell edge to a point (units).
  function depthInCell(x, y) {
    const dx = x - CELL.cx;
    const dy = y - CELL.cy;
    const r = Math.hypot(dx / CELL.rx, dy / CELL.ry);
    if (r === 0) return Infinity;
    const gradient = Math.hypot(dx / CELL.rx ** 2, dy / CELL.ry ** 2) / r;
    return (1 - r) / gradient;
  }

  // ---- layers -------------------------------------------------------------------

  function buildCytoplasm() {
    const speckA = new Set();
    const speckB = new Set();
    for (let ty = 0; ty < 80; ty++) {
      for (let tx = 0; tx < 125; tx++) {
        const depth = depthInCell(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
        if (depth < MEMBRANE.innerLayer) continue;
        const n = hash(tx, ty);
        if (n < 7) speckA.add(`${tx},${ty}`);
        else if (n < 12) speckB.add(`${tx},${ty}`);
      }
    }
    return svgEl(
      "g",
      { id: "cytoplasm-environment", class: "organelle-building organelle-building--env", "data-organelle": "cytoplasm" },
      svgEl("ellipse", { class: "cytoplasm-fill", cx: CELL.cx, cy: CELL.cy, rx: CELL.rx - 8, ry: CELL.ry - 8 }),
      tilePath("cytoplasm-speck cytoplasm-speck--a", speckA),
      tilePath("cytoplasm-speck cytoplasm-speck--b", speckB),
      svgEl("ellipse", { class: "focus-frame", cx: CELL.cx, cy: CELL.cy, rx: CELL.rx - 44, ry: CELL.ry - 44 })
    );
  }

  function buildMembrane() {
    const outerA = new Set();
    const outerB = new Set();
    const tails = new Set();
    const innerA = new Set();
    const innerB = new Set();
    const proteins = new Set();
    const pores = new Set();

    for (let ty = 0; ty < 80; ty++) {
      for (let tx = 0; tx < 125; tx++) {
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        const depth = depthInCell(cx, cy);
        if (depth < -MEMBRANE.outerLayer || depth >= MEMBRANE.innerLayer) continue;

        const key = `${tx},${ty}`;
        const layer = depth < MEMBRANE.outerLayer ? "outer" : depth < MEMBRANE.tails ? "tails" : "inner";
        const angle = (Math.atan2((cy - CELL.cy) / CELL.ry, (cx - CELL.cx) / CELL.rx) + 2 * Math.PI) % (2 * Math.PI);
        const isProtein = MEMBRANE_PROTEIN_ANGLES.some((a) => Math.abs(a - angle) < 0.014);

        if (isProtein) (layer === "tails" ? pores : proteins).add(key);
        else if (layer === "tails") tails.add(key);
        else (layer === "outer" ? (hash(tx, ty) % 2 ? outerA : outerB) : hash(tx, ty) % 2 ? innerA : innerB).add(key);
      }
    }

    return svgEl(
      "g",
      { id: "cell-membrane", class: "organelle-building organelle-building--env", "data-organelle": "membrane" },
      tilePath("membrane-head membrane-head--a", outerA),
      tilePath("membrane-head membrane-head--b", outerB),
      tilePath("membrane-tails", tails),
      tilePath("membrane-head membrane-head--a", innerA),
      tilePath("membrane-head membrane-head--b", innerB),
      tilePath("membrane-protein", proteins),
      tilePath("membrane-pore", pores),
      svgEl("ellipse", { class: "focus-frame", cx: CELL.cx, cy: CELL.cy, rx: CELL.rx + 12, ry: CELL.ry + 12 })
    );
  }

  function bresenham([x0, y0], [x1, y1]) {
    const cells = [];
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      cells.push([x0, y0]);
      if (x0 === x1 && y0 === y1) return cells;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function buildRoads() {
    const classes = { "1:0": new Set(), "1:1": new Set(), "2:0": new Set(), "2:1": new Set() };
    const claimed = new Set();
    // Wide roads first so narrow ones never overwrite them.
    [...ROADS].sort((a, b) => b.width - a.width).forEach((road) => {
      const tiles = [];
      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i].map((v) => Math.round(v / TILE));
        const b = road.points[i + 1].map((v) => Math.round(v / TILE));
        tiles.push(...bresenham(a, b));
      }
      tiles.forEach(([tx, ty], i) => {
        // Alternating shades along the road read like a beaded filament.
        const shade = Math.floor(i / 2) % 2;
        for (let ox = 0; ox < road.width; ox++) {
          for (let oy = 0; oy < road.width; oy++) {
            const key = `${tx + ox},${ty + oy}`;
            if (claimed.has(key)) continue;
            claimed.add(key);
            classes[`${road.width}:${shade}`].add(key);
          }
        }
      });
    });
    return svgEl(
      "g",
      { id: "cytoskeleton-roads", class: "organelle-building organelle-building--env", "data-organelle": "cytoskeleton" },
      tilePath("road-tile road-tile--main-a", classes["2:0"]),
      tilePath("road-tile road-tile--main-b", classes["2:1"]),
      tilePath("road-tile road-tile--side-a", classes["1:0"]),
      tilePath("road-tile road-tile--side-b", classes["1:1"])
    );
  }

  function buildBuilding(placement, index, organelles, showLabels) {
    const { w, h } = CC.pixel.size(placement.sprite);
    const width = w * placement.scale;
    const height = h * placement.scale;
    const info = organelles.items[placement.id];
    const instanceNumber = PLACEMENTS.filter((p, i) => p.id === placement.id && i <= index).length;
    const pad = 8;

    const g = svgEl(
      "g",
      { id: `organelle-${placement.id}-${instanceNumber}`, class: `organelle-building organelle-building--${placement.id}`, "data-organelle": placement.id },
      svgEl("rect", { class: "focus-frame", x: placement.x - pad, y: placement.y - pad, width: width + pad * 2, height: height + pad * 2 }),
      CC.pixel.group(placement.sprite, { x: placement.x, y: placement.y, scale: placement.scale }),
      svgEl("rect", { class: "hit-area", x: placement.x - pad, y: placement.y - pad, width: width + pad * 2, height: height + pad * 2 })
    );
    if (showLabels && placement.label) {
      const centre = placement.x + width / 2;
      const above = placement.label === "above";
      const nameY = above ? placement.y - 24 : placement.y + height + 20;
      g.append(
        svgEl("text", { class: "map-label", x: centre, y: nameY, "text-anchor": "middle" }, info.mapName),
        svgEl("text", { class: "map-label map-label--role", x: centre, y: nameY + 16, "text-anchor": "middle" }, info.shortRole)
      );
    }
    return g;
  }

  function buildEnvLabels(organelles) {
    return Object.entries(ENV_LABELS).map(([id, pos]) => {
      const info = organelles.items[id];
      const attrs = { x: pos.x, y: pos.y, "text-anchor": pos.anchor || "middle" };
      return svgEl(
        "g",
        { class: "env-label", "data-label-for": id },
        svgEl("text", { class: "map-label", ...attrs }, info.mapName),
        svgEl("text", { class: "map-label map-label--role", ...attrs, y: pos.y + 16 }, info.shortRole)
      );
    });
  }

  function describe(g, info) {
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", `${info.name}, ${info.cityRole}. Open information.`);
    g.prepend(svgEl("title", {}, `${info.name} — ${info.cityRole}`));
  }

  // ---- transport animation ------------------------------------------------------

  function makeRoute(points) {
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const length = Math.hypot(x1 - x0, y1 - y0);
      segments.push({ x0, y0, x1, y1, start: total, length });
      total += length;
    }
    const pointAt = (distance) => {
      const seg = segments.find((s) => distance <= s.start + s.length) || segments[segments.length - 1];
      const f = seg.length ? (distance - seg.start) / seg.length : 0;
      return [seg.x0 + (seg.x1 - seg.x0) * f, seg.y0 + (seg.y1 - seg.y0) * f];
    };
    return { total, pointAt };
  }

  const snap = (v) => Math.round(v / PIXEL_SNAP) * PIXEL_SNAP;

  function buildTransport() {
    const layer = svgEl("g", { id: "transport-layer", "aria-hidden": "true" });
    const vesicleSize = CC.pixel.size("vesicle");
    const atpSize = CC.pixel.size("atp");
    const vesicleScale = 3;
    const atpScale = 3;

    const vesicles = [];
    VESICLE_FLOWS.forEach((flow) => {
      const route = makeRoute(flow.points);
      for (let i = 0; i < flow.count; i++) {
        const el = CC.pixel.group("vesicle", { scale: vesicleScale });
        layer.append(el);
        vesicles.push({ el, route, speed: flow.speed, offset: (i / flow.count) * route.total * 1.4, order: i, count: flow.count });
      }
    });

    const atp = [];
    ATP_STREAMS.forEach((stream) => {
      stream.directions.forEach((dir, d) => {
        for (let k = 0; k < ATP_PARTICLES_PER_STREAM; k++) {
          const el = CC.pixel.group("atp", { scale: atpScale });
          layer.append(el);
          atp.push({ el, from: stream.from, dir, phase: (k + d / 2) / ATP_PARTICLES_PER_STREAM });
        }
      });
    });

    function place(el, x, y, size, scale, opacity) {
      el.setAttribute("transform", `translate(${snap(x - (size.w * scale) / 2)} ${snap(y - (size.h * scale) / 2)}) scale(${scale})`);
      el.setAttribute("opacity", opacity);
    }

    // Moving frame. `seconds` drives the animation; static frames pass fixed values.
    function draw(seconds, isStatic) {
      vesicles.forEach((v) => {
        const gap = v.route.total * 0.4;
        const distance = isStatic
          ? v.route.total * ((v.order + 1) / (v.count + 1))
          : (seconds * v.speed + v.offset) % (v.route.total + gap);
        if (distance > v.route.total) {
          v.el.setAttribute("opacity", 0);
          return;
        }
        const [x, y] = v.route.pointAt(distance);
        place(v.el, x, y, vesicleSize, vesicleScale, 1);
      });
      atp.forEach((p) => {
        const progress = isStatic ? 0.15 + p.phase * 0.7 : (seconds / ATP_CYCLE_SECONDS + p.phase) % 1;
        const distance = ATP_TRAVEL.start + ATP_TRAVEL.distance * progress;
        const opacity = isStatic ? 1 : Math.max(0, 1 - progress * progress).toFixed(2);
        place(p.el, p.from[0] + p.dir[0] * distance, p.from[1] + p.dir[1] * distance, atpSize, atpScale, opacity);
      });
    }
    return { layer, draw };
  }

  // ---- public API ---------------------------------------------------------------

  /**
   * Draws the scene into `svg`.
   * options: interactive (bool), labels (bool), onSelect(id, element)
   * Returns { highlight(id), clearHighlight(), setMotion(bool) }.
   */
  function build(svg, { interactive = false, labels = true, onSelect } = {}) {
    const organelles = CC.data.organelles;
    svg.replaceChildren();

    const buildings = svgEl("g", { id: "organelle-layer" });
    PLACEMENTS.forEach((p, i) => buildings.append(buildBuilding(p, i, organelles, labels)));
    const transport = buildTransport();

    const cytoplasm = buildCytoplasm();
    const membrane = buildMembrane();
    const roads = buildRoads();
    const envItems = [cytoplasm, membrane, roads];

    svg.append(cytoplasm, membrane, roads, buildings);
    if (labels) svg.append(...buildEnvLabels(organelles));
    svg.append(transport.layer);
    svg.setAttribute("shape-rendering", "crispEdges");

    if (interactive) {
      [...envItems, ...buildings.children].forEach((g) => describe(g, organelles.items[g.dataset.organelle]));
      const select = (event) => {
        const g = event.target.closest("[data-organelle]");
        if (g && onSelect) onSelect(g.dataset.organelle, g);
      };
      svg.addEventListener("click", select);
      svg.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(event);
        }
      });
    } else {
      // Decorative copy: strip the interactive hooks so no hover/selection styles apply.
      envItems.concat([...buildings.children]).forEach((g) => {
        g.removeAttribute("data-organelle");
        g.classList.remove("organelle-building");
      });
    }

    // Motion: one requestAnimationFrame loop, stopped entirely when paused.
    let frame = null;
    let lastDraw = 0;
    const startTime = performance.now();
    function tick(now) {
      if (now - lastDraw >= ANIMATION_STEP_MS) {
        transport.draw((now - startTime) / 1000, false);
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    }
    function setMotion(on) {
      svg.classList.toggle("is-animated", on);
      if (on && frame === null) frame = requestAnimationFrame(tick);
      if (!on) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        transport.draw(0, true);
      }
    }

    const allGroups = () => svg.querySelectorAll("[data-organelle]");
    return {
      setMotion,
      highlight(id) {
        allGroups().forEach((g) => g.classList.toggle("is-selected", g.dataset.organelle === id));
      },
      clearHighlight() {
        allGroups().forEach((g) => g.classList.remove("is-selected"));
      },
    };
  }

  CC.scene = { build };

  // Static hero illustration on the home page.
  document.querySelectorAll("svg[data-cell-scene]").forEach((svg) => {
    const scene = build(svg, { interactive: false, labels: false });
    scene.setMotion(!CC.motion.prefersReduced());
    CC.motion.query.addEventListener("change", (e) => scene.setMotion(!e.matches));
  });
})();
