"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { setup, skip } = require("../helpers/fixture");
const { ROOT } = require("../helpers/load");
const { sleep } = require("../helpers/browser");

const PAGES = ["index.html", "city.html", "bio-lab.html", "challenges.html"];
const WIDTHS = [1200, 992, 768, 640, 600, 375, 320];

test("All pages (headless browser)", { skip }, async (t) => {
  const env = await setup();
  t.after(() => env.teardown());

  for (const page of PAGES) {
    await t.test(`${page}: loads independently with no console problems or failed requests (server root, project sub-path, file://)`, async () => {
      const sources = {
        "server root": `${env.server.origin}/${page}`,
        "project sub-path (/Cell_City/)": `${env.subServer.origin}/${page}`,
        "file://": pathToFileURL(`${ROOT}/${page}`).href,
      };
      for (const [name, url] of Object.entries(sources)) {
        const tab = await env.browser.newPage();
        await tab.setViewport(1200, 900);
        await tab.goto(url);
        await sleep(300);
        assert.deepEqual(tab.consoleProblems, [], `${name}: console problems`);
        assert.deepEqual(tab.failedRequests, [], `${name}: failed requests`);
        const state = await tab.eval(`({
          title: document.title,
          scripts: [...document.scripts].filter(s => s.src && !s.src.includes('cdn.jsdelivr')).length,
          sprites: document.querySelectorAll('.pixel-sprite').length,
          current: document.querySelector('.cell-city-navbar__link[aria-current=page]')?.getAttribute('href'),
          bootstrap: typeof window.bootstrap,
        })`);
        assert.ok(state.title.startsWith("Cell City"), name);
        assert.equal(state.current, page === "index.html" ? "index.html" : page, `${name}: current page is marked in the navbar`);
        assert.equal(state.bootstrap, "object");
        await env.browser.closePage(tab);
      }
    });
  }

  await t.test("no horizontal overflow on any page at 1200, 992, 768, 640, 600, 375 and 320px", async () => {
    const overflowing = [];
    for (const pageName of PAGES) {
      const tab = await env.open(pageName, { width: 1200 });
      for (const width of WIDTHS) {
        await tab.setViewport(width, 800);
        await sleep(80);
        const extra = await tab.eval("document.documentElement.scrollWidth - document.documentElement.clientWidth");
        if (extra > 0) overflowing.push(`${pageName} @${width}px: +${extra}px`);
      }
      await env.browser.closePage(tab);
    }
    assert.deepEqual(overflowing, []);
  });

  await t.test("every Bio Lab tab and the City dialogs fit at 320px", async () => {
    const lab = await env.open("bio-lab.html", { width: 320, height: 700 });
    const bad = [];
    for (const id of ["analyse", "transcribe", "translate", "codons", "mutate"]) {
      await lab.click(`#tab-${id}`);
      await lab.waitFor(`document.querySelector('#pane-${id}').classList.contains('show')`);
      if (id !== "codons") await lab.click(`#pane-${id} [data-example]`);
      const extra = await lab.eval("document.documentElement.scrollWidth - document.documentElement.clientWidth");
      if (extra > 0) bad.push(`bio-lab ${id}: +${extra}px`);
    }
    const city = await env.open("city.html", { width: 320, height: 700 });
    await city.click('#directoryList [data-organelle-id="mitochondria"]');
    await city.waitFor("document.activeElement.closest('#organelleModal') && getComputedStyle(document.getElementById('organelleModal')).opacity === '1'");
    await city.click("#organelleLearnMore");
    for (const n of [1, 2, 3, 4]) {
      await city.eval(`document.querySelector('[data-bs-target="#organelleAccordionBody${n}"]').getAttribute('aria-expanded') === 'false' && document.querySelector('[data-bs-target="#organelleAccordionBody${n}"]').click()`);
    }
    await sleep(500);
    const extra = await city.eval("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    if (extra > 0) bad.push(`city detail dialog: +${extra}px`);
    const dialogFits = await city.eval("(() => { const r = document.querySelector('#organelleModal .modal-content').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()");
    if (!dialogFits) bad.push("city dialog wider than the screen");
    assert.deepEqual(bad, []);
  });

  for (const page of PAGES) {
    await t.test(`${page}: rendered DOM accessibility checks`, async () => {
      const tab = await env.open(page);
      const report = await tab.eval(`(() => {
        const problems = [];
        const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        // ids
        const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
        ids.filter((id, i) => ids.indexOf(id) !== i).forEach(id => problems.push('duplicate id ' + id));
        document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]').forEach(el => {
          for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
            (el.getAttribute(attr) || '').split(/\\s+/).filter(Boolean).forEach(id => {
              if (!document.getElementById(id)) problems.push(attr + ' -> missing #' + id + ' on ' + el.tagName);
            });
          }
        });
        // landmarks
        const navs = [...document.querySelectorAll('nav')];
        if (navs.length > 1 && navs.some(n => !n.getAttribute('aria-label'))) problems.push('multiple <nav> need distinct aria-labels');
        if (new Set(navs.map(n => n.getAttribute('aria-label'))).size !== navs.length) problems.push('nav labels are not unique');
        if (document.querySelectorAll('main').length !== 1) problems.push('need exactly one <main>');
        // headings (visible, in order, outside closed dialogs)
        let previous = 0;
        document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
          if (!visible(h) || h.closest('.modal')) return;
          const level = Number(h.tagName[1]);
          if (level > previous + 1) problems.push('heading level jumps from h' + previous + ' to h' + level + ': ' + h.textContent.trim().slice(0, 40));
          previous = level;
        });
        if (document.querySelectorAll('h1').length !== 1) problems.push('need exactly one h1');
        // names
        const nameOf = (el) => (el.getAttribute('aria-label') || '').trim() ||
          (el.getAttribute('aria-labelledby') ? el.getAttribute('aria-labelledby').split(/\\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() : '') ||
          (el.labels && el.labels.length ? [...el.labels].map(l => l.textContent).join(' ').trim() : '') ||
          (el.textContent || '').trim() || (el.getAttribute('title') || '').trim();
        document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button]').forEach(el => {
          if (!nameOf(el)) problems.push('no accessible name: ' + el.outerHTML.slice(0, 80));
        });
        document.querySelectorAll('svg').forEach(svg => {
          if (svg.closest('[aria-hidden=true]') || svg.getAttribute('aria-hidden') === 'true') return;
          if (svg.closest('[role=button]')) return;
          if (!svg.getAttribute('aria-label') && !svg.getAttribute('aria-labelledby')) problems.push('svg without a name or aria-hidden: ' + svg.getAttribute('class'));
        });
        document.querySelectorAll('img').forEach(img => { if (!img.hasAttribute('alt')) problems.push('img without alt'); });
        if (document.querySelector('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')) problems.push('positive tabindex');
        if (document.documentElement.lang !== 'en') problems.push('html lang');
        // duplicate accessible names among same-role controls on the page (e.g. two identical map buttons)
        const buttons = [...document.querySelectorAll('[role=button][aria-label]')].map(b => b.getAttribute('aria-label'));
        buttons.filter((n, i) => buttons.indexOf(n) !== i).forEach(n => problems.push('duplicate accessible name: ' + n));
        return problems;
      })()`);
      assert.deepEqual(report, []);
    });
  }

  await t.test("every keyboard tab stop shows a visible focus indicator (all four pages, desktop)", async () => {
    const missing = [];
    for (const page of PAGES) {
      const tab = await env.open(page);
      const seen = new Set();
      for (let i = 0; i < 75; i++) {
        await tab.press("Tab");
        const info = await tab.eval(`(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const frame = el.querySelector && el.querySelector(':scope > .focus-frame');
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          const shadow = cs.boxShadow !== 'none';
          const svgFrame = frame ? getComputedStyle(frame).stroke !== 'rgba(0, 0, 0, 0)' && getComputedStyle(frame).stroke !== 'none' : false;
          const filter = cs.filter !== 'none';
          return { key: el.id || (el.getAttribute('href') || '') + '|' + el.textContent.trim().slice(0, 24) + '|' + el.className, ok: outline || shadow || svgFrame || filter, tag: el.tagName };
        })()`);
        if (!info) continue;
        if (seen.has(info.key)) continue;
        seen.add(info.key);
        if (!info.ok) missing.push(`${page}: ${info.tag} ${info.key}`);
      }
      assert.ok(seen.size > 5, `${page}: walked only ${seen.size} tab stops`);
      await env.browser.closePage(tab);
    }
    assert.deepEqual(missing, []);
  });

  await t.test("mobile menu: toggler opens and closes the links and reports aria-expanded", async () => {
    const tab = await env.open("index.html", { width: 375, height: 800 });
    const state = () => tab.eval(`({ expanded: document.querySelector('.navbar-toggler').getAttribute('aria-expanded'), shown: document.getElementById('cellCityNavbarCollapse').classList.contains('show'), linkVisible: document.querySelector('.cell-city-navbar__link').offsetParent !== null })`);
    assert.deepEqual(await state(), { expanded: "false", shown: false, linkVisible: false });
    await tab.click(".navbar-toggler");
    await tab.waitFor("document.getElementById('cellCityNavbarCollapse').classList.contains('show')");
    await sleep(400);
    assert.deepEqual(await state(), { expanded: "true", shown: true, linkVisible: true });
    // The menu is reachable by keyboard: Tab from the toggler lands on the first link.
    await tab.eval("document.querySelector('.navbar-toggler').focus()");
    await tab.press("Tab");
    assert.equal(await tab.eval("document.activeElement.getAttribute('href')"), "index.html");
    await tab.click(".navbar-toggler");
    await tab.waitFor("!document.getElementById('cellCityNavbarCollapse').classList.contains('show')");
    assert.equal((await state()).expanded, "false");
  });

  await t.test("home hero scene is a labelled image, has no interactive parts, and respects reduced motion", async () => {
    const tab = await env.open("index.html");
    const info = await tab.eval(`(() => {
      const svg = document.querySelector('svg[data-cell-scene]');
      return {
        role: svg.getAttribute('role'), label: svg.getAttribute('aria-label').length > 40,
        interactive: svg.querySelectorAll('[tabindex],[data-organelle],.hit-area,.focus-frame,title').length,
        animated: svg.classList.contains('is-animated'),
        nodes: svg.querySelectorAll('*').length,
        ids: [...svg.querySelectorAll('[id]')].length,
      };
    })()`);
    assert.equal(info.role, "img");
    assert.equal(info.label, true);
    assert.equal(info.interactive, 0, "decorative copy must not carry interaction hooks or hit areas");
    assert.equal(info.animated, true);
    const reduced = await env.open("index.html", { reducedMotion: true });
    assert.equal(await reduced.eval("document.querySelector('svg[data-cell-scene]').classList.contains('is-animated')"), false);
    // Static frame: nothing moves.
    const a = await reduced.eval("document.getElementById('transport-layer').innerHTML");
    await sleep(300);
    assert.equal(await reduced.eval("document.getElementById('transport-layer').innerHTML"), a);
  });

  await t.test("the shared DOM helper refuses inline event-handler attributes", async () => {
    const tab = await env.open("index.html");
    const info = await tab.eval(`(() => {
      const el = CellCity.dom.h('button', { onclick: 'window.__x = 1', ONMOUSEOVER: 'window.__x = 1', class: 'ok', text: '<b>t</b>' });
      return { attrs: [...el.attributes].map(a => a.name), html: el.innerHTML };
    })()`);
    assert.deepEqual(info.attrs, ["class"]);
    assert.equal(info.html, "&lt;b&gt;t&lt;/b&gt;");
  });

  await t.test("if the Bootstrap CDN is unreachable the pages say so and nothing throws", async () => {
    for (const page of PAGES) {
      const tab = await env.browser.newPage();
      await tab.setViewport(1200, 900);
      await tab.send("Network.setBlockedURLs", { urls: ["*cdn.jsdelivr.net*"] });
      await tab.goto(`${env.server.origin}/${page}`, { waitForBootstrap: false });
      await tab.waitFor("document.querySelector('main .lab-warning[role=alert]')", { timeout: 8000 });
      assert.match(await tab.eval("document.querySelector('main .lab-warning').textContent"), /Bootstrap could not be loaded/);
      // Interactions that need Bootstrap do nothing quietly instead of throwing.
      if (page === "city.html") {
        await tab.eval("document.getElementById('organelle-nucleus-1').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
        await tab.eval("document.querySelector('.js-open-challenge').click()");
      }
      if (page === "bio-lab.html") {
        await tab.eval("document.querySelector('#analyse-form [data-example]').click()");
        assert.equal(await tab.eval("document.querySelectorAll('#analyse-results .stat-card').length"), 6, "Bootstrap-free features still work");
      }
      if (page === "challenges.html") {
        assert.equal(await tab.eval("document.querySelectorAll('.challenge-card').length"), 5, "Challenges do not depend on Bootstrap JS");
      }
      const problems = tab.consoleProblems.filter((p) => !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(p));
      assert.deepEqual(problems, [], page);
      await env.browser.closePage(tab);
    }
  });
});
