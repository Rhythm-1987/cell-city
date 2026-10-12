"use strict";

/*
 * Pixel-art renderer. Turns the grid-aligned sprite ops in data/sprites.js
 * into crisp SVG: one <path> per colour, built from 1x1 pixel runs, so a
 * sprite stays sharp at any size and the City can keep every building as an
 * individually interactive SVG group.
 */
(function () {
  const CC = (window.CellCity = window.CellCity || {});
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Sprite colours: the official palette plus a few close tints/shades.
  const PALETTE = {
    k: "#102a43", // navy outline
    K: "#52677a", // slate
    w: "#ffffff",
    g: "#dce7ee", // panel border grey
    b: "#eef5f7", // secondary background
    t: "#009fb0", // teal
    T: "#00768a", // dark teal
    l: "#b8e6ec", // light teal
    n: "#0e9f6e", // biological green
    N: "#0a7552", // dark green
    m: "#bfebd9", // light green
    a: "#d98e00", // energy amber
    A: "#9c6200", // dark amber
    y: "#ffd27a", // light amber
    Y: "#fff0cc", // pale amber
    r: "#d6455d", // danger
    D: "#a32e43", // dark danger
    R: "#f7c9d1", // light danger
    p: "#7c3aed", // special / purple
    P: "#dccffb", // light purple
  };

  const gridCache = new Map();

  function pixelInEllipse(x, y, cx, cy, rx, ry) {
    const dx = (x - cx) / (rx + 0.5);
    const dy = (y - cy) / (ry + 0.5);
    return dx * dx + dy * dy <= 1;
  }

  function drawEllipse(grid, cx, cy, rx, ry, fill, line) {
    const inside = (x, y) => pixelInEllipse(x, y, cx, cy, rx, ry);
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (!inside(x, y)) continue;
        const isEdge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
        const colour = isEdge ? line || fill : fill;
        if (colour) setPixel(grid, x, y, colour);
      }
    }
  }

  function setPixel(grid, x, y, colour) {
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = colour;
  }

  function fillRect(grid, x, y, w, h, colour) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPixel(grid, i, j, colour);
  }

  function drawTubes(grid, segments, width, fill, line) {
    const half = Math.floor(width / 2);
    const bounds = (x1, y1, x2, y2, pad) => [
      Math.min(x1, x2) - half - pad,
      Math.min(y1, y2) - half - pad,
      Math.abs(x2 - x1) + width + pad * 2,
      Math.abs(y2 - y1) + width + pad * 2,
    ];
    // Outline pass first, fill pass second, so joints merge cleanly.
    for (const s of segments) fillRect(grid, ...bounds(...s, 1), line);
    for (const s of segments) fillRect(grid, ...bounds(...s, 0), fill);
  }

  function rasterise(id) {
    if (gridCache.has(id)) return gridCache.get(id);
    const def = CC.data.sprites[id];
    if (!def) throw new Error("Unknown sprite: " + id);
    const grid = Array.from({ length: def.h }, () => new Array(def.w).fill(null));

    for (const op of def.ops) {
      const [kind, ...a] = op;
      if (kind === "r") fillRect(grid, a[0], a[1], a[2], a[3], a[4]);
      else if (kind === "o") {
        const [x, y, w, h, fill, line] = a;
        fillRect(grid, x, y, w, h, line);
        if (w > 2 && h > 2) fillRect(grid, x + 1, y + 1, w - 2, h - 2, fill);
      } else if (kind === "e") drawEllipse(grid, a[0], a[1], a[2], a[3], a[4], a[5]);
      else if (kind === "p") a[1].forEach(([x, y]) => setPixel(grid, x, y, a[0]));
      else if (kind === "s") {
        a[2].forEach((row, j) =>
          [...row].forEach((ch, i) => ch !== "." && ch !== " " && setPixel(grid, a[0] + i, a[1] + j, ch))
        );
      } else if (kind === "L") drawTubes(grid, a[0], a[1], a[2], a[3]);
      else if (kind === "S") {
        const child = rasterise(a[0]);
        child.forEach((row, j) =>
          row.forEach((c, i) => c && setPixel(grid, a[1] + i, a[2] + j, c))
        );
      }
    }
    gridCache.set(id, grid);
    return grid;
  }

  // One path per colour; horizontal runs of equal pixels become one rectangle.
  function buildPaths(id) {
    const grid = rasterise(id);
    const byColour = {};
    grid.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const c = row[x];
        if (!c) {
          x++;
          continue;
        }
        let end = x;
        while (end + 1 < row.length && row[end + 1] === c) end++;
        (byColour[c] = byColour[c] || []).push(`M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`);
        x = end + 1;
      }
    });
    return Object.entries(byColour).map(([c, d]) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("fill", PALETTE[c]);
      path.setAttribute("d", d.join(""));
      return path;
    });
  }

  function size(id) {
    const def = CC.data.sprites[id];
    return { w: def.w, h: def.h };
  }

  /** <g> holding the sprite, positioned and scaled in the parent's units. */
  function group(id, { x = 0, y = 0, scale = 1 } = {}) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
    g.setAttribute("shape-rendering", "crispEdges");
    buildPaths(id).forEach((p) => g.appendChild(p));
    return g;
  }

  /** Stand-alone <svg> for use in cards and modals. */
  function svg(id, { scale = 4, label = "" } = {}) {
    const { w, h } = size(id);
    const el = document.createElementNS(SVG_NS, "svg");
    el.setAttribute("viewBox", `0 0 ${w} ${h}`);
    el.setAttribute("width", w * scale);
    el.setAttribute("height", h * scale);
    el.setAttribute("shape-rendering", "crispEdges");
    el.setAttribute("focusable", "false");
    if (label) {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", label);
    } else {
      el.setAttribute("aria-hidden", "true");
    }
    el.classList.add("pixel-sprite");
    buildPaths(id).forEach((p) => el.appendChild(p));
    return el;
  }

  /** Fills <span data-sprite="id" data-scale="3"> placeholders. */
  function fillSlots(root = document) {
    root.querySelectorAll("[data-sprite]").forEach((slot) => {
      if (slot.firstChild) return;
      slot.appendChild(svg(slot.dataset.sprite, { scale: Number(slot.dataset.scale) || 4 }));
    });
  }

  CC.pixel = { PALETTE, size, group, svg, fillSlots };
  fillSlots();
})();
