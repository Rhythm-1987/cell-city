"use strict";

/*
 * Static checks on the shipped files: references resolve with exact (case-
 * sensitive) names, markup has valid ids/labels/headings, script order satisfies
 * each script's dependencies, and design-token colours meet WCAG contrast.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("../helpers/load");

const PAGES = ["index.html", "city.html", "bio-lab.html", "challenges.html"];
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

/** True only if `rel` exists with exactly this capitalisation (Windows is case-insensitive, GitHub Pages is not). */
function existsExactCase(rel) {
  let dir = ROOT;
  for (const part of rel.split("/")) {
    if (!fs.existsSync(dir) || !fs.readdirSync(dir).includes(part)) return false;
    dir = path.join(dir, part);
  }
  return true;
}

for (const page of PAGES) {
  const html = stripComments(read(page));

  test(`${page}: local references exist with exact case and are relative`, () => {
    const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(refs.length > 0);
    for (const ref of refs) {
      if (/^(https?:)?\/\//.test(ref)) {
        assert.match(ref, /^https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@5\.3\.3\//, `unexpected external resource ${ref}`);
        continue;
      }
      if (ref.startsWith("#") || ref.startsWith("data:")) continue;
      assert.ok(!ref.startsWith("/"), `${ref}: root-absolute paths break GitHub Pages project sites`);
      assert.ok(existsExactCase(ref.split("#")[0]), `${page}: missing or wrongly-cased file ${ref}`);
    }
  });

  test(`${page}: ids are unique and every referenced id exists`, () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
    const idSet = new Set(ids);
    for (const m of html.matchAll(/\s(?:aria-controls|aria-labelledby|aria-describedby|for)="([^"]+)"/g)) {
      for (const id of m[1].split(/\s+/)) assert.ok(idSet.has(id), `${page}: reference to missing id "${id}"`);
    }
    for (const m of html.matchAll(/data-bs-target="#([^"]+)"/g)) assert.ok(idSet.has(m[1]), `${page}: missing Bootstrap target #${m[1]}`);
  });

  test(`${page}: one h1, one main, one primary nav, lang set, headings never skip a level`, () => {
    assert.match(html, /<html lang="en">/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.equal((html.match(/<main[\s>]/g) || []).length, 1);
    assert.equal((html.match(/<footer[\s>]/g) || []).length, 1);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    // The page's own headings, in order, ignoring those inside modals (which are tested in the browser).
    const body = html.replace(/<div\s+class="modal[\s\S]*?<footer/, "<footer");
    let previous = 0;
    for (const m of body.matchAll(/<h([1-6])[\s>]/g)) {
      const level = Number(m[1]);
      assert.ok(level <= previous + 1, `${page}: h${level} follows h${previous}`);
      previous = level;
    }
  });

  test(`${page}: every form control has a label, every button has a name`, () => {
    const labelled = new Set([...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]));
    for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
      const attrs = m[2];
      if (/type="(hidden|submit|button)"/.test(attrs)) continue;
      const id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
      assert.ok(/aria-label=/.test(attrs) || (id && labelled.has(id)), `${page}: <${m[1]}${id ? ` id=${id}` : ""}> has no label`);
    }
    for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const text = m[2].replace(/<[^>]+>/g, "").replace(/&\w+;/g, "x").trim();
      assert.ok(text || /aria-label=/.test(m[1]), `${page}: unnamed button ${m[1]}`);
    }
  });

  test(`${page}: no inline event handlers, inline scripts or javascript: URLs`, () => {
    assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i);
    assert.doesNotMatch(html, /javascript:/i);
  });
}

test("the pages that were removed are not linked from anywhere", () => {
  const everything = [...PAGES, "README.md", ...fs.readdirSync(path.join(ROOT, "js")).map((f) => `js/${f}`), "css/style.css"]
    .map(read)
    .join("\n");
  assert.doesNotMatch(everything, /organelles\.html/);
  assert.doesNotMatch(everything, /missions?\.html/i);
  assert.doesNotMatch(everything, /\bMissions?\b/);
});

// ---- script ordering ----------------------------------------------------------------

/** What each project script needs to have run before it (checked against document order). */
const NEEDS = {
  "js/pixel.js": ["js/main.js", "data/sprites.js"],
  "js/scene.js": ["js/main.js", "js/pixel.js", "data/organelles.js"],
  "js/challenges.js": ["js/main.js", "js/pixel.js", "data/challenges.js"],
  "js/city.js": ["js/scene.js", "js/challenges.js", "data/organelles.js"],
  "js/biolab-core.js": ["data/genetic-code.js"],
  "js/biolab.js": ["js/main.js", "js/pixel.js", "js/biolab-core.js", "data/genetic-code.js"],
};

for (const page of PAGES) {
  test(`${page}: scripts load in dependency order and Bootstrap loads last`, () => {
    const scripts = [...stripComments(read(page)).matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    const local = scripts.filter((s) => !s.startsWith("http"));
    assert.equal(local[0], "js/main.js");
    for (const [script, needs] of Object.entries(NEEDS)) {
      const at = local.indexOf(script);
      if (at === -1) continue;
      for (const need of needs) {
        assert.ok(local.indexOf(need) !== -1 && local.indexOf(need) < at, `${page}: ${script} needs ${need} before it`);
      }
    }
    for (const tag of stripComments(read(page)).matchAll(/<script\b[^>]*>/g)) assert.match(tag[0], /\bdefer\b/, tag[0]);
    const pageSpecific = { "city.html": "js/city.js", "bio-lab.html": "js/biolab.js", "challenges.html": "js/challenges.js", "index.html": "js/scene.js" }[page];
    assert.ok(local.includes(pageSpecific));
    // Pages must not load page-specific code that belongs to another page.
    if (page !== "city.html") assert.ok(!local.includes("js/city.js"));
    if (page !== "bio-lab.html") assert.ok(!local.includes("js/biolab.js") && !local.includes("data/genetic-code.js"));
  });
}

test("every project script and data file is referenced by at least one page (no orphans)", () => {
  const referenced = PAGES.map(read).join("\n");
  for (const file of [...fs.readdirSync(path.join(ROOT, "js")).map((f) => `js/${f}`), ...fs.readdirSync(path.join(ROOT, "data")).map((f) => `data/${f}`)]) {
    assert.ok(referenced.includes(`"${file}"`), `${file} is not loaded by any page`);
  }
});

// ---- colour contrast of the design tokens ----------------------------------------------

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("design tokens: text and control colours meet WCAG AA contrast", () => {
  const css = read("css/style.css");
  const token = (name) => {
    const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `missing token --${name}`);
    return m[1];
  };
  const white = "#ffffff";
  const surfaces = { white, bg: token("color-bg"), bg2: token("color-bg-secondary") };
  const textPairs = [];
  for (const [name, surface] of Object.entries(surfaces)) {
    for (const fg of ["color-text-primary", "color-text-secondary", "color-accent-strong", "color-green-strong", "color-energy-strong", "color-danger-strong"]) {
      textPairs.push([`${fg} on ${name}`, token(fg), surface]);
    }
  }
  for (const tint of ["tint-accent", "tint-green", "tint-energy", "tint-danger", "tint-mutation"]) {
    textPairs.push([`text-primary on ${tint}`, token("color-text-primary"), token(tint)], [`text-secondary on ${tint}`, token("color-text-secondary"), token(tint)]);
  }
  textPairs.push(
    ["text-primary on tint-accent", token("color-text-primary"), token("tint-accent")],
    ["text-secondary on tint-accent", token("color-text-secondary"), token("tint-accent")],
    ["accent-strong on tint-accent", token("color-accent-strong"), token("tint-accent")],
    ["green-strong on tint-green", token("color-green-strong"), token("tint-green")],
    ["energy-strong on tint-energy", token("color-energy-strong"), token("tint-energy")],
    ["danger-strong on tint-danger", token("color-danger-strong"), token("tint-danger")],
    ["mutation-strong on tint-mutation", token("color-mutation-strong"), token("tint-mutation")],
    ["text-primary on tint-mutation", token("color-text-primary"), token("tint-mutation")],
    ["white on accent-strong (primary button, active tab)", white, token("color-accent-strong")],
    ["white on danger-strong (base tile T)", white, token("color-danger-strong")],
    ["white on green-strong (base tile G)", white, token("color-green-strong")],
    ["white on energy-strong (base tile C)", white, token("color-energy-strong")]
  );
  const failing = textPairs.filter(([, fg, bg]) => contrast(fg, bg) < 4.5).map(([n, fg, bg]) => `${n}: ${contrast(fg, bg).toFixed(2)}`);
  assert.deepEqual(failing, []);
  assert.ok(contrast(token("color-control-border"), white) >= 3, "form control border needs 3:1 against white");
});
