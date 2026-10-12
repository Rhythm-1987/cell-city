"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCellCity, memoryStorage } = require("../helpers/load");

const DOM_STUB = "window.CellCity = { dom: { h: () => null } };";

function engine(initialStorage) {
  const storage = memoryStorage(initialStorage);
  const CC = loadCellCity(["data/challenges.js", "js/challenges.js"], { localStorage: storage, prelude: DOM_STUB });
  return { CC, storage, api: CC.challenges, categories: CC.data.challenges.categories };
}

// ---- challenge data --------------------------------------------------------------

test("challenge data: categories and questions are well formed", () => {
  const { categories } = engine();
  assert.equal(categories.length, 5);
  const categoryIds = new Set();
  const questionIds = new Set();
  let total = 0;
  for (const category of categories) {
    assert.match(category.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(!categoryIds.has(category.id), `duplicate category id ${category.id}`);
    categoryIds.add(category.id);
    assert.ok(category.title && category.blurb && category.sprite);
    assert.ok(category.questions.length >= 1);
    for (const q of category.questions) {
      total++;
      assert.ok(!questionIds.has(q.id), `duplicate question id ${q.id}`);
      questionIds.add(q.id);
      assert.ok(q.prompt.trim() && q.explanation.trim());
      assert.ok(q.options.length >= 2 && q.options.length <= 6, q.id);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${q.id}: answer must index an option`);
      assert.equal(new Set(q.options.map((o) => o.trim().toLowerCase())).size, q.options.length, `${q.id}: duplicate options`);
      q.options.forEach((o) => assert.ok(o.trim(), `${q.id}: empty option`));
    }
  }
  assert.equal(total, 21);
});

test("challenge answer keys: the keyed option is the factually expected one", () => {
  // Independently derived facts for the computational questions.
  const { categories } = engine();
  const byId = Object.fromEntries(categories.flatMap((c) => c.questions).map((q) => [q.id, q]));
  const answerOf = (id) => byId[id].options[byId[id].answer];
  assert.equal(answerOf("bio-1"), "67%"); // GCGCAT: 4 of 6 bases are G/C
  assert.equal(answerOf("bio-2"), "GCAT"); // reverse complement of ATGC
  assert.equal(answerOf("cd-2"), "Three");
  assert.equal(answerOf("cd-3"), "Methionine");
  assert.equal(answerOf("cd-4"), "UGA");
  assert.equal(answerOf("dna-1"), "Thymine (T)");
  assert.equal(answerOf("dna-2"), "Uracil");
  assert.equal(answerOf("dna-3"), "Deoxyribose");
  assert.equal(answerOf("city-1"), "Nucleus");
  assert.equal(answerOf("org-2"), "Mitochondria");
  assert.equal(answerOf("bio-4"), "Silent mutation");
  // No explanation may contradict the keyed answer for the computational items.
  assert.match(byId["bio-1"].explanation, /67%/);
  assert.match(byId["bio-2"].explanation, /GCAT/);
});

// ---- saved progress ---------------------------------------------------------------

const KEY = "cellCity.challengeProgress.v1";

test("progress: first save, best score kept, attempts counted", () => {
  const { api, categories, storage } = engine();
  const cat = categories[0];
  assert.deepEqual(api.readProgress(), {});
  assert.equal(api.saveResult(cat, 3), true);
  assert.equal(api.saveResult(cat, 1), true);
  assert.equal(api.saveResult(cat, 2), true);
  const entry = api.readProgress()[cat.id];
  assert.equal(entry.best, 3);
  assert.equal(entry.last, 2);
  assert.equal(entry.attempts, 3);
  assert.equal(entry.total, cat.questions.length);
  assert.ok(!Number.isNaN(Date.parse(entry.completedAt)));
  assert.ok(storage.getItem(KEY));
});

test("progress: saving one challenge never changes another", () => {
  const { api, categories } = engine();
  api.saveResult(categories[0], 2);
  api.saveResult(categories[1], 4);
  const snapshot = api.readProgress();
  api.saveResult(categories[0], 4);
  const after = api.readProgress();
  assert.deepEqual(after[categories[1].id], snapshot[categories[1].id]);
  assert.equal(after[categories[0].id].best, 4);
  assert.equal(Object.keys(after).length, 2);
});

test("progress: impossible scores (negative, above the maximum, fractional, NaN) are rejected", () => {
  const { api, categories, storage } = engine();
  const cat = categories[0];
  const max = cat.questions.length;
  for (const bad of [-1, max + 1, 1.5, NaN, Infinity, "3", null, undefined]) {
    assert.equal(api.saveResult(cat, bad), false, `score ${String(bad)} must not be saved`);
  }
  assert.equal(storage.getItem(KEY), null);
  assert.equal(api.saveResult(cat, 0), true, "0 is a valid score");
  assert.equal(api.saveResult(cat, max), true, "the maximum is a valid score");
  assert.equal(api.readProgress()[cat.id].best, max);
});

test("progress: missing, malformed, outdated or tampered storage is ignored, never thrown", () => {
  const cat = engine().categories[0];
  const good = { best: 2, total: cat.questions.length, last: 2, attempts: 1, completedAt: "2026-01-01T00:00:00.000Z" };
  const cases = {
    "not JSON": "{oops",
    "empty string": "",
    "null": "null",
    "number": "42",
    "string": '"hello"',
    "array": "[1,2]",
    "wrong total (outdated question count)": JSON.stringify({ [cat.id]: { ...good, total: 99 } }),
    "best above total": JSON.stringify({ [cat.id]: { ...good, best: good.total + 1 } }),
    "negative best": JSON.stringify({ [cat.id]: { ...good, best: -1 } }),
    "fractional best": JSON.stringify({ [cat.id]: { ...good, best: 1.5 } }),
    "string best": JSON.stringify({ [cat.id]: { ...good, best: "2" } }),
    "zero attempts": JSON.stringify({ [cat.id]: { ...good, attempts: 0 } }),
    "last above total": JSON.stringify({ [cat.id]: { ...good, last: good.total + 5 } }),
    "negative last": JSON.stringify({ [cat.id]: { ...good, last: -2 } }),
    "entry is an array": JSON.stringify({ [cat.id]: [] }),
    "unknown category only": JSON.stringify({ "no-such-category": good }),
    "prototype key": '{"__proto__":{"best":1}}',
  };
  for (const [name, raw] of Object.entries(cases)) {
    const { api } = engine({ [KEY]: raw });
    assert.deepEqual(api.readProgress(), {}, name);
  }
  const { api } = engine({ [KEY]: JSON.stringify({ [cat.id]: good, junk: 1 }) });
  assert.deepEqual(Object.keys(api.readProgress()), [cat.id]);
});

test("progress: a corrupt entry is replaced by the next save instead of poisoning it", () => {
  const { api, categories } = engine({ [KEY]: "{oops" });
  assert.equal(api.saveResult(categories[0], 1), true);
  assert.equal(api.readProgress()[categories[0].id].attempts, 1);
});

test("progress: blocked or throwing localStorage degrades to 'not saved'", () => {
  const throwing = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("QuotaExceededError"); },
    removeItem() { throw new Error("SecurityError"); },
  };
  const CC = loadCellCity(["data/challenges.js", "js/challenges.js"], { localStorage: throwing, prelude: DOM_STUB });
  const { challenges: api, data } = CC;
  assert.deepEqual(api.readProgress(), {});
  assert.equal(api.saveResult(data.challenges.categories[0], 2), false);
  assert.equal(api.clearProgress(), false);
});

test("progress: clearProgress removes only the Cell City key", () => {
  const { api, categories, storage } = engine({ other: "keep" });
  api.saveResult(categories[0], 1);
  assert.equal(api.clearProgress(), true);
  assert.equal(storage.getItem(KEY), null);
  assert.equal(storage.getItem("other"), "keep");
  assert.deepEqual(api.readProgress(), {});
});

// ---- organelle data ---------------------------------------------------------------

test("organelle data: the 11 required structures, complete and cross-referenced", () => {
  const CC = loadCellCity(["data/sprites.js", "data/organelles.js"]);
  const { order, items } = CC.data.organelles;
  assert.deepEqual([...order].sort(), [
    "cytoplasm", "cytoskeleton", "golgi", "lysosomes", "membrane", "mitochondria",
    "nucleus", "ribosomes", "rough-er", "smooth-er", "vesicles",
  ]);
  assert.equal(new Set(order).size, 11);
  assert.deepEqual(Object.keys(items).sort(), [...order].sort());
  for (const id of order) {
    const item = items[id];
    for (const field of ["name", "mapName", "cityRole", "shortRole", "summary", "analogy"]) {
      assert.ok(typeof item[field] === "string" && item[field].trim(), `${id}.${field}`);
    }
    assert.ok(["organelle", "environment"].includes(item.kind), id);
    assert.ok(CC.data.sprites[item.sprite], `${id}: sprite ${item.sprite} must exist`);
    for (const list of ["details", "functions", "facts", "relationships", "aliases"]) {
      assert.ok(Array.isArray(item[list]) && item[list].length > 0, `${id}.${list}`);
    }
    for (const rel of item.relationships) {
      assert.ok(items[rel.id], `${id}: relationship points to unknown structure ${rel.id}`);
      assert.notEqual(rel.id, id, `${id}: relates to itself`);
      assert.ok(rel.text.trim());
    }
  }
});

// ---- sprite data ------------------------------------------------------------------

test("sprite data: only palette colours, existing nested sprites, in-bounds pixels", () => {
  const CC = loadCellCity(["data/sprites.js", "js/pixel.js"]);
  const { sprites } = CC.data;
  const palette = CC.pixel.PALETTE;
  const problems = [];
  // null / undefined means "no fill" or "no outline" and is valid for ellipses.
  const colour = (id, c) => c != null && !palette[c] && problems.push(`${id}: unknown colour "${c}"`);

  for (const [id, def] of Object.entries(sprites)) {
    const inside = (x, y) => x >= 0 && y >= 0 && x < def.w && y < def.h;
    def.ops.forEach(([kind, ...a], n) => {
      const where = `${id} op#${n} (${kind})`;
      if (kind === "r") {
        colour(id, a[4]);
        if (!inside(a[0], a[1]) || !inside(a[0] + a[2] - 1, a[1] + a[3] - 1)) problems.push(`${where}: rectangle leaves the sprite`);
      } else if (kind === "o") {
        colour(id, a[4]);
        colour(id, a[5]);
        if (!inside(a[0], a[1]) || !inside(a[0] + a[2] - 1, a[1] + a[3] - 1)) problems.push(`${where}: rectangle leaves the sprite`);
      } else if (kind === "e") {
        colour(id, a[4]);
        colour(id, a[5]);
      } else if (kind === "p") {
        colour(id, a[0]);
        a[1].forEach(([x, y]) => !inside(x, y) && problems.push(`${where}: pixel ${x},${y} outside`));
      } else if (kind === "s") {
        a[2].forEach((row, j) => [...row].forEach((ch, i) => {
          if (ch === "." || ch === " ") return;
          colour(id, ch);
          if (!inside(a[0] + i, a[1] + j)) problems.push(`${where}: stamp pixel outside`);
        }));
      } else if (kind === "L") {
        colour(id, a[2]);
        colour(id, a[3]);
      } else if (kind === "S") {
        if (!sprites[a[0]]) problems.push(`${where}: unknown nested sprite ${a[0]}`);
        if (a[0] === id) problems.push(`${where}: sprite nests itself`);
      } else {
        problems.push(`${where}: unknown op`);
      }
    });
  }
  assert.deepEqual(problems, []);
});
