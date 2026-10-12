"use strict";

/*
 * Cell City — shared helpers loaded on every page:
 *   CellCity.dom.h()   safe DOM builder (text is always inserted as text)
 *   CellCity.motion    reduced-motion preference
 * and the navbar's active-page state.
 */
(function () {
  const CC = (window.CellCity = window.CellCity || {});

  /** h("div", { class: "x", "aria-hidden": "true" }, "text", childNode, ...) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "text") el.textContent = value;
      else el.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child);
    }
    return el;
  }

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  CC.dom = { h };
  CC.motion = { prefersReduced: () => reducedMotionQuery.matches, query: reducedMotionQuery };

  // Mark the link for the current page. Matches on the file name so it also
  // works from a sub-folder (e.g. GitHub Pages project sites).
  const current = location.pathname.split("/").pop() || "index.html";
  document
    .querySelectorAll(".cell-city-navbar__link, .cell-city-footer__link")
    .forEach((link) => {
      if (link.getAttribute("href") === current) link.setAttribute("aria-current", "page");
    });
})();
