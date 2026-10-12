"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, skip } = require("../helpers/fixture");
const { sleep } = require("../helpers/browser");

const STRUCTURES = {
  nucleus: "Nucleus",
  mitochondria: "Mitochondria",
  ribosomes: "Ribosomes",
  "rough-er": "Rough Endoplasmic Reticulum",
  "smooth-er": "Smooth Endoplasmic Reticulum",
  golgi: "Golgi Apparatus",
  lysosomes: "Lysosomes",
  vesicles: "Vesicles",
  membrane: "Cell Membrane",
  cytoplasm: "Cytoplasm",
  cytoskeleton: "Cytoskeleton",
};
const GROUP_IDS = [
  "cytoplasm-environment", "cell-membrane", "cytoskeleton-roads",
  "organelle-nucleus-1", "organelle-mitochondria-1", "organelle-mitochondria-2", "organelle-ribosomes-1",
  "organelle-rough-er-1", "organelle-smooth-er-1", "organelle-golgi-1", "organelle-lysosomes-1",
  "organelle-lysosomes-2", "organelle-vesicles-1",
];

// "Ready" = fully faded in with focus inside; Bootstrap ignores dismiss requests while it is still animating in.
const MODAL_OPEN = "document.getElementById('organelleModal').classList.contains('show') && getComputedStyle(document.getElementById('organelleModal')).opacity === '1' && !!document.activeElement.closest('#organelleModal')";
const MODAL_CLOSED = "!document.getElementById('organelleModal').classList.contains('show') && !document.querySelector('.modal-backdrop')";
const CHALLENGE_OPEN = "document.getElementById('challengeModal').classList.contains('show') && getComputedStyle(document.getElementById('challengeModal')).opacity === '1' && !!document.activeElement.closest('#challengeModal')";
const active = "(document.activeElement && (document.activeElement.id || document.activeElement.tagName))";

test("City page (headless browser)", { skip }, async (t) => {
  const env = await setup();
  t.after(() => env.teardown());

  const open = (opts) => env.open("city.html", opts);

  await t.test("renders 13 selectable groups for the 11 structures, with unique stable ids and accessible names", async () => {
    const page = await open();
    const info = await page.eval(`[...document.querySelectorAll('#cellCityMapSvg [data-organelle]')].map(g => ({
      id: g.id, organelle: g.dataset.organelle, role: g.getAttribute('role'), tabindex: g.getAttribute('tabindex'),
      label: g.getAttribute('aria-label'), title: g.querySelector(':scope > title')?.textContent }))`);
    assert.deepEqual(info.map((g) => g.id).sort(), [...GROUP_IDS].sort());
    assert.deepEqual([...new Set(info.map((g) => g.organelle))].sort(), Object.keys(STRUCTURES).sort());
    for (const g of info) {
      assert.equal(g.role, "button");
      assert.equal(g.tabindex, "0");
      assert.ok(g.label && g.label.includes(STRUCTURES[g.organelle]), `${g.id}: aria-label "${g.label}"`);
      assert.ok(g.title, `${g.id}: needs a <title> tooltip`);
    }
    const labels = info.map((g) => g.label);
    assert.equal(new Set(labels).size, labels.length, "two map buttons share the same accessible name (e.g. the two mitochondria)");
    assert.deepEqual(page.consoleProblems, []);
    assert.deepEqual(page.failedRequests, []);
  });

  await t.test("real mouse hit-testing reaches every structure; moving transport sprites do not block clicks", async () => {
    const page = await open();
    const results = await page.eval(`(() => {
      const svg = document.getElementById('cellCityMapSvg');
      const toScreen = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return [p.x, p.y]; };
      const hit = (x, y) => document.elementFromPoint(x, y)?.closest('[data-organelle]')?.id || null;
      const out = {};
      for (const g of svg.querySelectorAll('.organelle-building:not(.organelle-building--env)')) {
        const r = g.querySelector('.hit-area').getBoundingClientRect();
        out[g.id] = hit(r.left + r.width / 2, r.top + r.height / 2);
      }
      out['cell-membrane'] = hit(...toScreen(500, 56));
      out['cytoplasm-environment'] = hit(...toScreen(620, 540));
      out['cytoskeleton-roads'] = hit(...toScreen(504, 440));
      const transport = [...svg.querySelectorAll('#transport-layer > g')].map(g => {
        const r = g.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#transport-layer') ? 'blocked' : 'ok';
      });
      return { out, transport };
    })()`);
    for (const id of GROUP_IDS) assert.equal(results.out[id], id, `clicking the centre of ${id} should hit ${id}`);
    assert.ok(results.transport.length > 0);
    assert.ok(results.transport.every((r) => r === "ok"), "vesicle / ATP sprites sit on top of the roads and must not swallow clicks");
  });

  await t.test("map layers: moving transport sprites are drawn under the buildings and their labels, and the map keeps its own title/description", async () => {
    const page = await open();
    const info = await page.eval(`(() => {
      const svg = document.getElementById('cellCityMapSvg');
      const order = (a, b) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        transportBeforeBuildings: order('#transport-layer', '#organelle-layer'),
        buildingsBeforeEnvLabels: order('#organelle-layer', '.env-label'),
        labelledby: svg.getAttribute('aria-labelledby').split(' ').map(id => document.getElementById(id)?.textContent.trim().length > 0),
        titleIsFirstChild: svg.firstElementChild.tagName === 'title',
      };
    })()`);
    assert.deepEqual(info, { transportBeforeBuildings: true, buildingsBeforeEnvLabels: true, labelledby: [true, true], titleIsFirstChild: true });
  });

  await t.test("each structure: map click opens the right summary, Learn More shows details, Back returns, close restores focus", async () => {
    const page = await open();
    for (const [id, name] of Object.entries(STRUCTURES)) {
      const groupId = GROUP_IDS.find((g) => g.includes(id === "membrane" ? "membrane" : id === "cytoplasm" ? "cytoplasm" : id === "cytoskeleton" ? "cytoskeleton" : `organelle-${id}-1`));
      await page.eval(`document.getElementById(${JSON.stringify(groupId)}).dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
      await page.waitFor(MODAL_OPEN);
      const summary = await page.eval(`({
        title: document.getElementById('organelleModalTitle').textContent,
        summaryHidden: document.getElementById('organelleSummaryView').hidden,
        detailHidden: document.getElementById('organelleDetailView').hidden,
        learnMore: !document.getElementById('organelleLearnMore').hidden,
        back: !document.getElementById('organelleBack').hidden,
        describedby: document.getElementById('organelleModal').getAttribute('aria-describedby'),
        selected: [...document.querySelectorAll('#cellCityMapSvg .is-selected')].map(g => g.dataset.organelle),
      })`);
      assert.equal(summary.title, name);
      assert.deepEqual([summary.summaryHidden, summary.detailHidden, summary.learnMore, summary.back], [false, true, true, false], id);
      assert.equal(summary.describedby, "organelleSummaryText");
      assert.ok(summary.selected.length >= 1 && summary.selected.every((s) => s === id), `${id}: highlighted ${summary.selected}`);

      await page.click("#organelleLearnMore");
      const detail = await page.eval(`({
        title: document.getElementById('organelleModalTitle').textContent,
        summaryHidden: document.getElementById('organelleSummaryView').hidden,
        detailHidden: document.getElementById('organelleDetailView').hidden,
        buttons: [...document.querySelectorAll('#organelleAccordion .accordion-button')].map(b => b.textContent),
        intro: document.getElementById('organelleDetailIntro').textContent.length,
        describedby: document.getElementById('organelleModal').getAttribute('aria-describedby'),
        focus: ${active},
        back: !document.getElementById('organelleBack').hidden,
      })`);
      assert.equal(detail.title, name);
      assert.deepEqual([detail.summaryHidden, detail.detailHidden, detail.back], [true, false, true], id);
      assert.deepEqual(detail.buttons, ["What it does", "In Cell City", "Key facts", "Works with"]);
      assert.ok(detail.intro > 50);
      assert.equal(detail.describedby, "organelleDetailIntro");
      assert.equal(detail.focus, "organelleModalTitle", "focus moves to the title when the view changes");

      await page.click("#organelleBack");
      assert.equal(await page.eval("document.getElementById('organelleSummaryView').hidden"), false);
      assert.equal(await page.eval("document.getElementById('organelleDetailView').hidden"), true);
      assert.equal(await page.eval("document.getElementById('organelleModalTitle').textContent"), name, "Back stays on the same structure");

      await page.click("#organelleModal .modal-footer [data-bs-dismiss]");
      await page.waitFor(MODAL_CLOSED);
      assert.equal(await page.eval(`document.getElementById(${JSON.stringify(groupId)}) === document.activeElement`), true, `${id}: focus returns to the map control`);
      assert.equal(await page.eval("document.querySelectorAll('#cellCityMapSvg .is-selected').length"), 0);
    }
    assert.deepEqual(page.consoleProblems, []);
  });

  await t.test("related-structure links inside the detail view switch structure and stay in the detail view", async () => {
    const page = await open();
    await page.eval("document.getElementById('organelle-nucleus-1').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await page.waitFor(MODAL_OPEN);
    await page.click("#organelleLearnMore");
    await page.eval("document.querySelector('#organelleAccordion [data-bs-target=\"#organelleAccordionBody4\"]').click()");
    await page.waitFor("document.querySelector('#organelleAccordionBody4').classList.contains('show')");
    const target = await page.eval("document.querySelector('#organelleAccordion [data-go]').dataset.go");
    await page.click("#organelleAccordion [data-go]");
    assert.equal(await page.eval("document.getElementById('organelleModalTitle').textContent"), STRUCTURES[target]);
    assert.equal(await page.eval("document.getElementById('organelleDetailView').hidden"), false);
    assert.equal(await page.eval("document.querySelectorAll('#cellCityMapSvg .is-selected')[0].dataset.organelle"), target);
    assert.equal(await page.eval("document.querySelectorAll('.accordion-collapse.show').length"), 2, "re-rendered accordion opens only the default sections");
  });

  await t.test("every structure's relationships and details render without error", async () => {
    const page = await open();
    const failures = await page.eval(`(() => {
      const bad = [];
      for (const [id, item] of Object.entries(CellCity.data.organelles.items)) {
        for (const rel of item.relationships) if (!CellCity.data.organelles.items[rel.id]) bad.push(id + '->' + rel.id);
      }
      return bad;
    })()`);
    assert.deepEqual(failures, []);
  });

  await t.test("keyboard only: Tab reaches all 13 map controls, Enter/Space open, Escape closes, focus returns, no trap", async () => {
    const page = await open();
    const seen = [];
    const order = [];
    for (let i = 0; i < 90 && seen.length < GROUP_IDS.length; i++) {
      await page.press("Tab");
      const id = await page.eval(active);
      order.push(id);
      if (GROUP_IDS.includes(id) && !seen.includes(id)) seen.push(id);
    }
    assert.deepEqual([...seen].sort(), [...GROUP_IDS].sort(), `tab order was: ${order.join(" > ")}`);

    // Focus is on the last map control reached. Open it with Enter, then close with Escape.
    const last = seen[seen.length - 1];
    await page.press("Enter");
    await page.waitFor(MODAL_OPEN);
    await page.press("Escape");
    await page.waitFor(MODAL_CLOSED);
    assert.equal(await page.eval(active), last, "focus returns to the control that opened the dialog");

    // Space opens too (and does not scroll the page).
    const scrollBefore = await page.eval("window.scrollY");
    await page.press(" ");
    await page.waitFor(MODAL_OPEN);
    assert.equal(await page.eval("window.scrollY"), scrollBefore);

    // Focus stays inside the dialog while tabbing (no leak to the page behind, no keyboard trap).
    const inside = [];
    for (let i = 0; i < 12; i++) {
      await page.press("Tab");
      inside.push(await page.eval("!!document.activeElement.closest('#organelleModal')"));
    }
    assert.ok(inside.every(Boolean), "Tab escaped the open dialog");
    await page.press("Tab", { shift: true });
    assert.equal(await page.eval("!!document.activeElement.closest('#organelleModal')"), true);
    await page.press("Escape");
    await page.waitFor(MODAL_CLOSED);
    assert.equal(await page.eval(active), last);
  });

  await t.test("directory: partial / any-case filtering, empty state, clearing, Enter, and map consistency", async () => {
    const page = await open();
    const rows = () => page.eval("[...document.querySelectorAll('#directoryList .directory-list__row')].filter(r => !r.hidden).map(r => r.dataset.id)");
    const status = () => page.eval("document.getElementById('directoryStatus').textContent");
    const dimmed = () => page.eval("[...document.querySelectorAll('#cellCityMapSvg .is-dimmed')].map(g => g.dataset.organelle)");

    assert.equal((await rows()).length, 11);
    assert.equal(await status(), "11 structures. Choose one to open it.");

    await page.fill("#directoryFilter", "MiTo");
    assert.deepEqual(await rows(), ["mitochondria"]);
    assert.equal(await status(), "1 of 11 structures match.");
    assert.deepEqual((await dimmed()).includes("mitochondria"), false);
    assert.equal((await dimmed()).length, 13 - 2, "everything except the two mitochondria is dimmed on the map");

    await page.fill("#directoryFilter", "energy"); // alias, not in the name
    assert.deepEqual(await rows(), ["mitochondria"]);
    await page.fill("#directoryFilter", "  DNA  ");
    assert.deepEqual(await rows(), ["nucleus"]);
    await page.fill("#directoryFilter", "recycl");
    assert.deepEqual(await rows(), ["lysosomes"]);

    await page.fill("#directoryFilter", "zzzz");
    assert.deepEqual(await rows(), []);
    assert.equal(await status(), "No structures match “zzzz”.");
    assert.equal((await dimmed()).length, 13);
    await page.press("Enter");
    await sleep(300);
    assert.equal(await page.eval(MODAL_OPEN), false, "Enter on an empty result opens nothing");

    await page.fill("#directoryFilter", "");
    assert.equal((await rows()).length, 11);
    assert.equal(await status(), "11 structures. Choose one to open it.");
    assert.deepEqual(await dimmed(), []);

    await page.fill("#directoryFilter", "golgi");
    await page.press("Enter");
    await page.waitFor(MODAL_OPEN);
    assert.equal(await page.eval("document.getElementById('organelleModalTitle').textContent"), "Golgi Apparatus");
    await page.press("Escape");
    await page.waitFor(MODAL_CLOSED);
    assert.equal(await page.eval(active), "directoryFilter");
  });

  await t.test("directory buttons open the intended structure and highlight it on the map; focus returns to the button", async () => {
    const page = await open();
    for (const [id, name] of Object.entries(STRUCTURES)) {
      await page.click(`#directoryList [data-organelle-id="${id}"]`);
      await page.waitFor(MODAL_OPEN);
      assert.equal(await page.eval("document.getElementById('organelleModalTitle').textContent"), name);
      assert.deepEqual(await page.eval("[...new Set([...document.querySelectorAll('#cellCityMapSvg .is-selected')].map(g => g.dataset.organelle))]"), [id]);
      await page.press("Escape");
      await page.waitFor(MODAL_CLOSED);
      assert.equal(await page.eval(`document.activeElement.dataset.organelleId`), id);
    }
  });

  await t.test("animation: runs, pauses while a dialog is open, resumes, and the toggle works", async () => {
    const page = await open();
    const transforms = () => page.eval("[...document.querySelectorAll('#transport-layer > g')].map(g => g.getAttribute('transform') + g.getAttribute('opacity')).join('|')");
    const moving = async () => {
      const a = await transforms();
      await sleep(350);
      return a !== (await transforms());
    };
    assert.equal(await page.eval("document.getElementById('cellCityMapSvg').classList.contains('is-animated')"), true);
    assert.equal(await moving(), true, "scene animates by default");

    await page.eval("document.getElementById('organelle-nucleus-1').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await page.waitFor(MODAL_OPEN);
    assert.equal(await moving(), false, "paused behind the dialog");
    assert.equal(await page.eval("document.getElementById('cellCityMapSvg').classList.contains('is-animated')"), false);
    await page.press("Escape");
    await page.waitFor(MODAL_CLOSED);
    assert.equal(await moving(), true, "resumes after the dialog closes");

    await page.click("#motionToggle");
    assert.equal(await page.eval("document.getElementById('motionToggle').textContent"), "Play animation");
    assert.equal(await moving(), false);
    // Opening and closing a dialog must not restart motion the user paused.
    await page.eval("document.getElementById('organelle-nucleus-1').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await page.waitFor(MODAL_OPEN);
    await page.press("Escape");
    await page.waitFor(MODAL_CLOSED);
    assert.equal(await moving(), false, "user-paused animation stays paused after a dialog");
    await page.click("#motionToggle");
    assert.equal(await moving(), true);
  });

  await t.test("reduced motion: off by default, the toggle offers 'Play animation', and it can be turned on", async () => {
    const page = await open({ reducedMotion: true });
    assert.equal(await page.eval("document.getElementById('cellCityMapSvg').classList.contains('is-animated')"), false);
    assert.equal(await page.eval("document.getElementById('motionToggle').textContent"), "Play animation");
    const before = await page.eval("document.getElementById('transport-layer').innerHTML");
    await sleep(300);
    assert.equal(await page.eval("document.getElementById('transport-layer').innerHTML"), before);
    await page.click("#motionToggle");
    await sleep(300);
    assert.notEqual(await page.eval("document.getElementById('transport-layer').innerHTML"), before);
  });

  await t.test("the animation loop stops completely when paused (no requestAnimationFrame callbacks)", async () => {
    const page = await open();
    await page.eval(`(() => {
      window.__raf = 0;
      const original = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => { window.__raf++; return original(cb); };
    })()`);
    await page.click("#motionToggle"); // pause
    await sleep(150);
    await page.eval("window.__raf = 0");
    await sleep(500);
    assert.equal(await page.eval("window.__raf"), 0, "no frames are requested while paused");
    await page.click("#motionToggle");
    await sleep(300);
    assert.ok((await page.eval("window.__raf")) > 5);
  });

  await t.test("Take a Challenge: same engine and saved progress as the Challenges page; Escape returns focus", async () => {
    const page = await open();
    await page.click(".js-open-challenge");
    await page.waitFor(CHALLENGE_OPEN);
    assert.equal(await page.eval("document.querySelectorAll('#cityChallengeApp .challenge-card').length"), 5);
    assert.equal(await page.eval("document.querySelector('#cityChallengeApp h3.challenge-heading') !== null"), true, "headings sit below the dialog's h2");
    // Play "Bioinformatics Basics" perfectly through real clicks.
    await page.click('#cityChallengeApp [data-start="bioinformatics"]');
    for (let i = 0; i < 4; i++) {
      const answer = await page.eval(`CellCity.data.challenges.categories.find(c => c.id === 'bioinformatics').questions[${i}].answer`);
      await page.click(`#cityChallengeApp [data-option="${answer}"]`);
      await page.click("#cityChallengeApp .quiz__next");
    }
    assert.match(await page.eval("document.querySelector('#cityChallengeApp .result__score').textContent"), /^4 \/ 4/);
    const saved = await page.eval("JSON.parse(localStorage.getItem('cellCity.challengeProgress.v1')).bioinformatics");
    assert.deepEqual([saved.best, saved.total, saved.last, saved.attempts], [4, 4, 4, 1]);
    await page.press("Escape");
    await page.waitFor("!document.getElementById('challengeModal').classList.contains('show') && !document.querySelector('.modal-backdrop')");
    assert.equal(await page.eval("document.querySelector('.js-open-challenge') === document.activeElement"), true);
    assert.equal(await page.eval("document.getElementById('cityChallengeApp').children.length"), 0, "challenge UI is discarded on close");

    // The Challenges page shows the same stored result.
    await page.goto(`${env.server.origin}/challenges.html`);
    await page.waitFor("document.querySelector('.challenge-card')");
    assert.match(await page.eval("document.querySelector('[data-start=\"bioinformatics\"]').closest('article').textContent"), /Best score: 4 \/ 4 · Attempts: 1/);
    assert.equal(await page.eval("document.querySelector('.challenge-hub__summary').textContent.startsWith('Completed 1 of 5')"), true);
  });

  await t.test("mobile (375px): no horizontal overflow, map labels hidden, directory usable", async () => {
    const page = await open({ width: 375, height: 800 });
    assert.equal(await page.eval("document.documentElement.scrollWidth <= window.innerWidth"), true);
    assert.equal(await page.eval("getComputedStyle(document.querySelector('.map-label')).display"), "none");
    assert.equal(await page.eval("document.querySelectorAll('#directoryList .directory-item').length"), 11);
    await page.click('#directoryList [data-organelle-id="ribosomes"]');
    await page.waitFor(MODAL_OPEN);
    const fits = await page.eval("(() => { const r = document.querySelector('#organelleModal .modal-content').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; })()");
    assert.equal(fits, true, "dialog fits the screen");
    await page.click("#organelleLearnMore");
    assert.equal(await page.eval("document.documentElement.scrollWidth <= window.innerWidth"), true);
  });

  await t.test("map labels that are shown are large enough to read at every layout width", async () => {
    const tooSmall = [];
    for (const width of [1440, 1200, 1199, 1100, 992, 862, 860, 859, 768, 600, 576]) {
      const page = await open({ width });
      const sizes = await page.eval(`(() => {
        const label = document.querySelector('.map-label');
        if (getComputedStyle(label).display === 'none') return null;
        const scale = document.getElementById('cellCityMapSvg').getBoundingClientRect().width / 1000;
        return { name: 15 * scale, role: 12.5 * scale };
      })()`);
      if (sizes && (sizes.name < 10 || sizes.role < 9)) tooSmall.push(`${width}px: name ${sizes.name.toFixed(1)}px, role ${sizes.role.toFixed(1)}px`);
    }
    assert.deepEqual(tooSmall, [], "labels render below a legible size; hide them or enlarge them at these widths");
  });
});
