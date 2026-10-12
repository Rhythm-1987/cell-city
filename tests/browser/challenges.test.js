"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, skip } = require("../helpers/fixture");

const KEY = "cellCity.challengeProgress.v1";
const stored = (page) => page.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || 'null')`);

/** Plays a whole category with real clicks. `choose(questionIndex, answerIndex, optionCount)` returns the option to click. */
async function play(page, categoryId, choose, { root = "" } = {}) {
  const questions = await page.eval(`CellCity.data.challenges.categories.find(c => c.id === ${JSON.stringify(categoryId)}).questions.map(q => ({ answer: q.answer, n: q.options.length, explanation: q.explanation }))`);
  await page.click(`${root} [data-start="${categoryId}"]`);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    assert.equal(await page.eval(`document.querySelector('${root} .quiz__next').hidden`), true, "Next stays hidden until the question is answered");
    assert.equal(await page.eval(`document.querySelector('${root} .quiz__feedback').textContent`), "", "no feedback before answering");
    await page.click(`${root} [data-option="${choose(i, q.answer, q.n)}"]`);
    const after = await page.eval(`({
      feedback: document.querySelector('${root} .quiz__feedback').textContent,
      disabled: [...document.querySelectorAll('${root} .quiz-option')].every(b => b.disabled),
      nextVisible: !document.querySelector('${root} .quiz__next').hidden,
      focus: document.activeElement.className,
      flags: [...document.querySelectorAll('${root} .quiz-option__flag')].map(f => f.textContent),
    })`);
    assert.ok(after.feedback.includes(q.explanation), "explanation is shown for the question answered");
    assert.equal(after.disabled, true, "options lock after answering");
    assert.equal(after.nextVisible, true);
    assert.match(after.focus, /quiz__next/, "focus moves to Next so keyboard users continue");
    assert.ok(after.flags.includes("Correct answer"), "correct option is marked in words, not only colour");
    await page.click(`${root} .quiz__next`);
  }
  return questions.length;
}

test("Challenges page (headless browser)", { skip }, async (t) => {
  const env = await setup();
  t.after(() => env.teardown());
  const open = (opts) => env.open("challenges.html", opts);

  await t.test("hub: 5 categories / 21 questions, none attempted, no console or network problems", async () => {
    const page = await open();
    assert.equal(await page.eval("document.querySelectorAll('.challenge-card').length"), 5);
    assert.deepEqual(await page.eval("[...document.querySelectorAll('.challenge-card__status')].map(s => s.textContent)"), Array(5).fill("Not attempted yet"));
    assert.equal(await page.eval("document.querySelector('.challenge-hub__summary').textContent.startsWith('Completed 0 of 5')"), true);
    assert.equal(await page.eval("CellCity.data.challenges.categories.reduce((n, c) => n + c.questions.length, 0)"), 21);
    assert.equal(await page.eval("document.querySelector('[data-reset]')"), null, "no reset button until something is saved");
    assert.deepEqual(page.consoleProblems, []);
    assert.deepEqual(page.failedRequests, []);
  });

  await t.test("perfect run: score, progress bar, review, saved best score, and the hub reflects it", async () => {
    const page = await open();
    const n = await play(page, "dna-rna", (i, answer) => answer);
    assert.equal(n, 4);
    const result = await page.eval(`({
      score: document.querySelector('.result__score').textContent,
      message: document.querySelector('.result__message').textContent,
      review: [...document.querySelectorAll('.result-review__item')].map(li => li.classList.contains('is-correct')),
      focus: document.activeElement.className,
    })`);
    assert.match(result.score, /^4 \/ 4 \(100%\)/);
    assert.match(result.message, /Perfect/);
    assert.deepEqual(result.review, [true, true, true, true]);
    assert.match(result.focus, /challenge-heading/, "focus lands on the results heading");
    const saved = await stored(page);
    assert.deepEqual(Object.keys(saved), ["dna-rna"]);
    assert.deepEqual([saved["dna-rna"].best, saved["dna-rna"].total, saved["dna-rna"].last, saved["dna-rna"].attempts], [4, 4, 4, 1]);

    await page.click("[data-exit]");
    assert.match(await page.eval("document.querySelector('[data-start=\"dna-rna\"]').closest('article').querySelector('.challenge-card__status').textContent"), /Best score: 4 \/ 4 · Attempts: 1/);
    assert.equal(await page.eval("document.querySelector('[data-start=\"dna-rna\"]').textContent"), "Try again");
    assert.equal(await page.eval("document.querySelectorAll('.challenge-card__status.is-done').length"), 1);
    assert.equal(await page.eval("document.querySelectorAll('.challenge-card__status')[0].textContent"), "Not attempted yet", "other challenges are unaffected");
  });

  await t.test("all-wrong run scores 0, keeps the earlier best, counts the attempt; wrong answers are explained", async () => {
    const page = await open();
    await play(page, "city-roles", (i, answer) => answer);
    await page.click("[data-exit]");
    await play(page, "city-roles", (i, answer, n) => (answer + 1) % n);
    assert.match(await page.eval("document.querySelector('.result__score').textContent"), /^0 \/ 4 \(0%\)/);
    assert.match(await page.eval("document.querySelector('.result__message').textContent"), /Keep practising/);
    assert.equal(await page.eval("document.querySelectorAll('.result-review__item.is-incorrect').length"), 4);
    assert.match(await page.eval("document.querySelector('.result__best').textContent"), /Best score: 4 \/ 4 · Attempts: 2/);
    const saved = (await stored(page))["city-roles"];
    assert.deepEqual([saved.best, saved.last, saved.attempts], [4, 0, 2]);
  });

  await t.test("a wrong answer marks both the chosen and the correct option and explains why", async () => {
    const page = await open();
    await page.click('[data-start="central-dogma"]');
    const answer = await page.eval("CellCity.data.challenges.categories.find(c => c.id === 'central-dogma').questions[0].answer");
    const wrong = (answer + 1) % 4;
    await page.click(`[data-option="${wrong}"]`);
    const flags = await page.eval("[...document.querySelectorAll('.quiz-option')].map(b => b.querySelector('.quiz-option__flag').textContent)");
    assert.equal(flags[wrong], "Your answer");
    assert.equal(flags[answer], "Correct answer");
    assert.match(await page.eval("document.querySelector('.quiz__verdict').textContent"), /Not quite/);
    assert.match(await page.eval("document.querySelector('.quiz__explanation').textContent"), /The correct answer is "/);
    assert.equal(await page.eval("document.querySelector('.quiz__feedback').getAttribute('aria-live')"), "polite");
    assert.equal(await page.eval("document.querySelector('.quiz-progress').getAttribute('aria-valuenow')"), "1");
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Question 1 of 5 · Score 0/);
  });

  await t.test("repeated clicks cannot double-score an answer or skip a question", async () => {
    const page = await open();
    await page.click('[data-start="dna-rna"]');
    const answer = await page.eval("CellCity.data.challenges.categories.find(c => c.id === 'dna-rna').questions[0].answer");
    // Same-tick repeated activation of the correct option.
    await page.eval(`(() => { const b = document.querySelector('[data-option="${answer}"]'); b.click(); b.click(); b.click(); })()`);
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Question 1 of 4 · Score 1$/);
    // Clicking the other options after answering changes nothing (the buttons are disabled; also fire raw events).
    await page.eval(`document.querySelectorAll('.quiz-option').forEach(b => b.dispatchEvent(new MouseEvent('click', { bubbles: true })))`);
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Score 1$/);
    assert.equal(await page.eval("document.querySelectorAll('.quiz__verdict').length"), 1);
    // Repeated activation of Next advances exactly one question.
    await page.eval("(() => { const n = document.querySelector('.quiz__next'); n.click(); n.click(); n.click(); })()");
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Question 2 of 4/);
  });

  await t.test("restart resets the attempt; leaving mid-quiz and starting another challenge starts clean", async () => {
    const page = await open();
    await play(page, "bioinformatics", (i, answer) => answer);
    await page.click("[data-restart]");
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Question 1 of 4 · Score 0$/);
    assert.equal(await page.eval("document.querySelector('.quiz__feedback').textContent"), "");
    assert.equal(await page.eval("document.querySelectorAll('.quiz-option:disabled').length"), 0);
    // Answer once, abandon, start a different challenge.
    const answer = await page.eval("CellCity.data.challenges.categories.find(c => c.id === 'bioinformatics').questions[0].answer");
    await page.click(`[data-option="${answer}"]`);
    await page.click("[data-exit]");
    await page.click('[data-start="identify-organelle"]');
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Question 1 of 4 · Score 0$/);
    assert.equal(await page.eval("document.querySelector('.quiz__category').textContent"), "Identify the Organelle");
    // Abandoned attempts are not saved as completions.
    assert.equal((await stored(page)).bioinformatics.attempts, 1);
    assert.equal((await stored(page))["identify-organelle"], undefined);
  });

  await t.test("completing one challenge never alters another's saved result", async () => {
    const page = await open();
    await play(page, "identify-organelle", (i, answer) => answer);
    const first = (await stored(page))["identify-organelle"];
    await page.click("[data-exit]");
    await play(page, "central-dogma", (i, answer, n) => (answer + 1) % n);
    const after = await stored(page);
    assert.deepEqual(after["identify-organelle"], first);
    assert.equal(after["central-dogma"].best, 0);
    assert.equal(after["central-dogma"].total, 5);
  });

  await t.test("reset saved progress asks first, then clears everything", async () => {
    const page = await open();
    await play(page, "dna-rna", (i, answer) => answer);
    await page.click("[data-exit]");
    page.acceptDialogs = false;
    await page.click("[data-reset]");
    assert.equal(page.dialogs.length, 1);
    assert.notEqual(await stored(page), null, "declining the confirmation keeps progress");
    page.acceptDialogs = true;
    await page.click("[data-reset]");
    assert.equal(await stored(page), null);
    assert.deepEqual(await page.eval("[...document.querySelectorAll('.challenge-card__status')].map(s => s.textContent)"), Array(5).fill("Not attempted yet"));
  });

  await t.test("corrupt, outdated, tampered and wrong-typed storage never breaks the page or shows a fake result", async () => {
    const cases = [
      "{not json",
      "[]",
      "null",
      JSON.stringify({ "dna-rna": { best: 99, total: 4, last: 1, attempts: 1 } }),
      JSON.stringify({ "dna-rna": { best: 4, total: 7, last: 4, attempts: 1 } }),
      JSON.stringify({ "dna-rna": { best: -1, total: 4, last: 0, attempts: 1 } }),
      JSON.stringify({ "dna-rna": { best: "4", total: 4, last: 4, attempts: 1 } }),
      JSON.stringify({ "dna-rna": { best: 4, total: 4, last: 12, attempts: 1 } }),
      JSON.stringify({ "dna-rna": "completed" }),
    ];
    for (const raw of cases) {
      const page = await open({ init: `try { localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(raw)}); } catch (e) {}` });
      assert.deepEqual(await page.eval("[...document.querySelectorAll('.challenge-card__status')].map(s => s.textContent)"), Array(5).fill("Not attempted yet"), raw);
      assert.deepEqual(page.consoleProblems, [], raw);
    }
  });

  await t.test("a valid stored result is shown, and a blocked localStorage degrades to a visible 'not saved' notice", async () => {
    const good = { "dna-rna": { best: 3, total: 4, last: 3, attempts: 2, completedAt: "2026-01-01T00:00:00.000Z" } };
    const page = await open({ init: `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(good))});` });
    assert.match(await page.eval("document.querySelector('[data-start=\"dna-rna\"]').closest('article').textContent"), /Best score: 3 \/ 4 · Attempts: 2/);

    const blocked = await open({
      init: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });`,
    });
    assert.equal(await blocked.eval("document.querySelectorAll('.challenge-card').length"), 5, "page still renders");
    await play(blocked, "dna-rna", (i, answer) => answer);
    assert.match(await blocked.eval("document.querySelector('.result__warning').textContent"), /blocked saving/);
    assert.equal(await blocked.eval("document.querySelector('.result__best')"), null, "no stored 'best' is claimed when nothing was stored");
    assert.equal(await blocked.eval("document.querySelector('.result__score').textContent.startsWith('4 / 4')"), true);
    assert.deepEqual(blocked.consoleProblems, []);
  });

  await t.test("two tabs saving different challenges do not overwrite each other", async () => {
    const a = await open();
    const b = await open({ shareContextWith: a });
    await play(a, "dna-rna", (i, answer) => answer);
    await play(b, "city-roles", (i, answer) => answer);
    const saved = await stored(a);
    assert.deepEqual(Object.keys(saved).sort(), ["city-roles", "dna-rna"]);
  });

  await t.test("every question can be answered with the keyboard alone", async () => {
    const page = await open();
    await page.eval("document.querySelector('[data-start=\"dna-rna\"]').focus()");
    await page.press("Enter");
    const answer = await page.eval("CellCity.data.challenges.categories.find(c => c.id === 'dna-rna').questions[0].answer");
    // Focus is on the prompt heading; Tab walks the options in order.
    for (let i = 0; i <= answer; i++) await page.press("Tab");
    assert.equal(await page.eval("document.activeElement.dataset.option"), String(answer));
    await page.press("Enter");
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Score 1$/);
    assert.match(await page.eval("document.activeElement.className"), /quiz__next/);
    await page.press("Enter");
    assert.match(await page.eval("document.querySelector('.quiz__count').textContent"), /Question 2 of 4/);
  });

  await t.test("320px wide: no horizontal overflow in hub, question and result views", async () => {
    const page = await open({ width: 320, height: 700 });
    const overflow = () => page.eval("document.documentElement.scrollWidth - window.innerWidth");
    assert.ok((await overflow()) <= 0, "hub");
    await page.click('[data-start="dna-rna"]');
    assert.ok((await overflow()) <= 0, "question");
    for (let i = 0; i < 4; i++) {
      await page.click('[data-option="0"]');
      await page.click(".quiz__next");
    }
    assert.ok((await overflow()) <= 0, "results");
  });
});
