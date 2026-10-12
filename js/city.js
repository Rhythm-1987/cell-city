"use strict";

/*
 * City page: wires the interactive map, the searchable directory, the shared
 * organelle modal (summary view + detailed view) and the in-city challenge.
 */
(function () {
  const CC = (window.CellCity = window.CellCity || {});
  const { h } = CC.dom;
  const organelles = CC.data.organelles;

  const svg = document.getElementById("cellCityMapSvg");
  const modalEl = document.getElementById("organelleModal");
  const challengeModalEl = document.getElementById("challengeModal");

  const ui = {
    dialog: modalEl.querySelector(".modal-dialog"),
    sprite: document.getElementById("organelleSprite"),
    kind: document.getElementById("organelleKind"),
    title: document.getElementById("organelleModalTitle"),
    role: document.getElementById("organelleRole"),
    summaryView: document.getElementById("organelleSummaryView"),
    summaryText: document.getElementById("organelleSummaryText"),
    analogy: document.getElementById("organelleAnalogy"),
    detailView: document.getElementById("organelleDetailView"),
    detailIntro: document.getElementById("organelleDetailIntro"),
    accordion: document.getElementById("organelleAccordion"),
    learnMore: document.getElementById("organelleLearnMore"),
    back: document.getElementById("organelleBack"),
  };

  let currentId = null;
  let lastTrigger = null;

  const motion = { userWantsMotion: !CC.motion.prefersReduced() };
  const openModals = new Set();
  const toggle = document.getElementById("motionToggle");

  const scene = CC.scene.build(svg, { interactive: true, onSelect: openOrganelle });

  // ---- motion ---------------------------------------------------------------

  function applyMotion() {
    scene.setMotion(motion.userWantsMotion && openModals.size === 0);
    toggle.textContent = motion.userWantsMotion ? "Pause animation" : "Play animation";
  }

  toggle.addEventListener("click", () => {
    motion.userWantsMotion = !motion.userWantsMotion;
    applyMotion();
  });
  CC.motion.query.addEventListener("change", (event) => {
    motion.userWantsMotion = !event.matches;
    applyMotion();
  });

  // Pause the scene while a modal covers it.
  [modalEl, challengeModalEl].forEach((el) => {
    el.addEventListener("show.bs.modal", () => {
      openModals.add(el);
      applyMotion();
    });
    el.addEventListener("hidden.bs.modal", () => {
      openModals.delete(el);
      applyMotion();
    });
  });

  // ---- organelle modal --------------------------------------------------------

  function renderHeader(id) {
    const item = organelles.items[id];
    ui.sprite.replaceChildren(CC.pixel.svg(item.sprite, { scale: 3 }));
    ui.kind.textContent = item.kind === "organelle" ? "Organelle" : "Cell environment";
    ui.title.textContent = item.name;
    ui.role.textContent = `City role: ${item.cityRole}`;
    ui.summaryText.textContent = item.summary;
    ui.analogy.textContent = item.analogy;
  }

  function accordionItem(index, title, content, open) {
    const bodyId = `organelleAccordionBody${index}`;
    return h(
      "div",
      { class: "accordion-item" },
      h(
        "h3",
        { class: "accordion-header" },
        h(
          "button",
          {
            class: "accordion-button" + (open ? "" : " collapsed"),
            type: "button",
            "data-bs-toggle": "collapse",
            "data-bs-target": "#" + bodyId,
            "aria-expanded": open ? "true" : "false",
            "aria-controls": bodyId,
          },
          title
        )
      ),
      h("div", { id: bodyId, class: "accordion-collapse collapse" + (open ? " show" : "") }, h("div", { class: "accordion-body" }, content))
    );
  }

  function renderDetail(id) {
    const item = organelles.items[id];
    ui.detailIntro.replaceChildren(...item.details.map((text) => h("p", { text })));

    const related = item.relationships.map((rel) =>
      h(
        "li",
        {},
        h("button", { type: "button", class: "link-button", "data-go": rel.id }, organelles.items[rel.id].name),
        ` — ${rel.text}`
      )
    );
    ui.accordion.replaceChildren(
      accordionItem(1, "What it does", h("ul", {}, item.functions.map((text) => h("li", { text }))), true),
      accordionItem(2, "In Cell City", h("p", {}, h("strong", { text: `${item.cityRole}. ` }), item.analogy), true),
      accordionItem(3, "Key facts", h("ul", {}, item.facts.map((text) => h("li", { text }))), false),
      accordionItem(4, "Works with", h("ul", { class: "organelle-related" }, related), false)
    );
  }

  function setView(view) {
    const detailed = view === "detail";
    ui.summaryView.hidden = detailed;
    ui.detailView.hidden = !detailed;
    ui.learnMore.hidden = detailed;
    ui.back.hidden = !detailed;
    ui.dialog.classList.toggle("modal-lg", detailed);
    modalEl.setAttribute("aria-describedby", detailed ? "organelleDetailIntro" : "organelleSummaryText");
    modalEl.querySelector(".modal-body").scrollTop = 0;
    ui.title.focus({ preventScroll: true });
  }

  function showOrganelle(id, view) {
    currentId = id;
    renderHeader(id);
    renderDetail(id);
    scene.highlight(id);
    setView(view);
  }

  function openOrganelle(id, trigger) {
    lastTrigger = trigger || document.activeElement;
    showOrganelle(id, "summary");
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  ui.learnMore.addEventListener("click", () => setView("detail"));
  ui.back.addEventListener("click", () => setView("summary"));
  ui.detailView.addEventListener("click", (event) => {
    const link = event.target.closest("[data-go]");
    if (link) showOrganelle(link.dataset.go, "detail");
  });
  modalEl.addEventListener("hidden.bs.modal", () => {
    scene.clearHighlight();
    if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
  });

  // ---- directory + search ------------------------------------------------------

  const list = document.getElementById("directoryList");
  const filterInput = document.getElementById("directoryFilter");
  const status = document.getElementById("directoryStatus");

  const searchText = (item) =>
    [item.name, item.cityRole, item.shortRole, item.kind, ...item.aliases].join(" ").toLowerCase();

  organelles.order.forEach((id) => {
    const item = organelles.items[id];
    list.append(
      h(
        "li",
        { class: "directory-list__row", "data-id": id },
        h(
          "button",
          { type: "button", class: "directory-item", "data-organelle-id": id },
          h("span", { class: "directory-item__sprite" }, CC.pixel.svg(item.sprite, { scale: 2 })),
          h("span", { class: "directory-item__text" }, h("span", { class: "directory-item__name", text: item.name }), h("span", { class: "directory-item__role", text: item.cityRole }))
        )
      )
    );
  });

  function visibleIds() {
    const query = filterInput.value.trim().toLowerCase();
    return organelles.order.filter((id) => !query || searchText(organelles.items[id]).includes(query));
  }

  function applyFilter() {
    const query = filterInput.value.trim();
    const visible = new Set(visibleIds());
    list.querySelectorAll(".directory-list__row").forEach((row) => {
      row.hidden = !visible.has(row.dataset.id);
    });
    // Dim map items that do not match so the search is visible on the map too.
    svg.querySelectorAll("[data-organelle]").forEach((g) => {
      g.classList.toggle("is-dimmed", Boolean(query) && !visible.has(g.dataset.organelle));
    });
    status.textContent = !visible.size
      ? `No structures match “${query}”.`
      : query
        ? `${visible.size} of ${organelles.order.length} structures match.`
        : `${organelles.order.length} structures. Choose one to open it.`;
  }

  filterInput.addEventListener("input", applyFilter);
  document.getElementById("directorySearch").addEventListener("submit", (event) => {
    event.preventDefault();
    const [first] = visibleIds();
    if (first) openOrganelle(first, filterInput);
  });
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-organelle-id]");
    if (button) openOrganelle(button.dataset.organelleId, button);
  });

  // ---- Cell -> City guide (secondary reference) ----------------------------------

  document.getElementById("cityGuideList").append(
    ...organelles.order.map((id) =>
      h("div", { class: "city-guide__row" }, h("dt", { text: organelles.items[id].name }), h("dd", { text: organelles.items[id].cityRole }))
    )
  );

  // ---- challenge inside the City -------------------------------------------------

  const challengeApp = document.getElementById("cityChallengeApp");
  let challengeTrigger = null;
  document.querySelectorAll(".js-open-challenge").forEach((button) => {
    button.addEventListener("click", () => {
      CC.challenges.mount(challengeApp, { headingLevel: 3 });
      challengeTrigger = button;
      bootstrap.Modal.getOrCreateInstance(challengeModalEl).show();
    });
  });
  challengeModalEl.addEventListener("hidden.bs.modal", () => {
    challengeApp.replaceChildren();
    if (challengeTrigger) challengeTrigger.focus();
  });

  applyFilter();
  applyMotion();
})();
