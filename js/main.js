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
      if (/^on/i.test(key)) continue; // never create inline event handlers (listeners are added in code)
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

  // Bootstrap (loaded from a CDN) powers the mobile menu, dialogs, tabs and accordions. If it
  // did not load, say so instead of leaving buttons that appear to do nothing.
  window.addEventListener("load", () => {
    const main = document.querySelector("main");
    if (window.bootstrap || !main) return;
    main.prepend(
      h("p", {
        class: "lab-warning",
        role: "alert",
        text: "Bootstrap could not be loaded from its CDN, so the mobile menu, pop-up dialogs and tabs will not work. Check your internet connection and reload the page.",
      })
    );
  });

  // Mark the link for the current page. Matches on the file name so it also
  // works from a sub-folder (e.g. GitHub Pages project sites).
  const current = location.pathname.split("/").pop() || "index.html";
  document
    .querySelectorAll(".cell-city-navbar__link, .cell-city-footer__link")
    .forEach((link) => {
      if (link.getAttribute("href") === current) link.setAttribute("aria-current", "page");
    });
})();
