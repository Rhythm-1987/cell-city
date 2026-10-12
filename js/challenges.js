"use strict";

/*
 * Shared challenge engine. `CellCity.challenges.mount(container, options)`
 * renders the whole experience (challenge list -> questions -> results) into
 * any container, so challenges.html and the City page's modal run the very
 * same code and the same saved progress.
 */
(function () {
  const CC = (window.CellCity = window.CellCity || {});
  const { h } = CC.dom;

  const STORAGE_KEY = "cellCity.challengeProgress.v1";
  const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
  const MESSAGES = [
    { min: 100, text: "Perfect score. You really know your way around the cell." },
    { min: 75, text: "Great work. Just a little more to master." },
    { min: 50, text: "Good effort. Review the explanations below and try again." },
    { min: 0, text: "Keep practising. Explore the City, then try again." },
  ];

  const categories = () => (CC.data.challenges && CC.data.challenges.categories) || [];

  // ---- saved progress ---------------------------------------------------------
  // Shape: { [categoryId]: { best, total, last, attempts, completedAt } }
  // Anything missing, corrupt or out of date (question count changed) is dropped.

  function isValidEntry(entry, category) {
    const total = category.questions.length;
    return (
      entry &&
      typeof entry === "object" &&
      entry.total === total &&
      Number.isInteger(entry.best) &&
      entry.best >= 0 &&
      entry.best <= total &&
      Number.isInteger(entry.attempts) &&
      entry.attempts >= 1
    );
  }

  function readProgress() {
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return {};
    }
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const clean = {};
    categories().forEach((category) => {
      if (isValidEntry(stored[category.id], category)) clean[category.id] = stored[category.id];
    });
    return clean;
  }

  function writeProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return true;
    } catch (error) {
      return false; // private mode, quota exceeded or storage blocked
    }
  }

  function saveResult(category, score) {
    const progress = readProgress();
    const previous = progress[category.id];
    progress[category.id] = {
      best: Math.max(previous ? previous.best : 0, score),
      total: category.questions.length,
      last: score,
      attempts: (previous ? previous.attempts : 0) + 1,
      completedAt: new Date().toISOString(),
    };
    return writeProgress(progress);
  }

  function clearProgress() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ---- UI ---------------------------------------------------------------------

  function mount(container, { headingLevel = 2 } = {}) {
    const heading = (level, attrs, text) => h("h" + Math.min(level, 6), attrs, text);
    const state = { cat: null, index: 0, score: 0, picks: [], answered: false, saveFailed: false };

    function show(view, { focus = true } = {}) {
      container.replaceChildren(view.node);
      if (focus && view.focusTarget) view.focusTarget.focus();
    }

    // -- list --
    function listView() {
      const progress = readProgress();
      const all = categories();
      const completed = all.filter((c) => progress[c.id]).length;

      const title = heading(headingLevel, { class: "challenge-heading", tabindex: "-1" }, "Choose a challenge");
      const cards = all.map((category) => {
        const entry = progress[category.id];
        const total = category.questions.length;
        return h(
          "article",
          { class: "challenge-card" },
          h("span", { class: "challenge-card__sprite", "data-sprite": category.sprite, "data-scale": "3" }),
          heading(headingLevel + 1, { class: "challenge-card__title" }, category.title),
          h("p", { class: "challenge-card__blurb", text: category.blurb }),
          h("p", { class: "challenge-card__meta", text: `${total} questions` }),
          h("p", {
            class: "challenge-card__status" + (entry ? " is-done" : ""),
            text: entry
              ? `Best score: ${entry.best} / ${entry.total} · Attempts: ${entry.attempts}`
              : "Not attempted yet",
          }),
          h(
            "button",
            { type: "button", class: "btn-cell-city btn-cell-city--primary", "data-start": category.id },
            entry ? "Try again" : "Start challenge"
          )
        );
      });

      const resetButton = completed
        ? h("button", { type: "button", class: "btn-cell-city btn-cell-city--quiet", "data-reset": "" }, "Reset saved progress")
        : null;

      const node = h(
        "div",
        { class: "challenge-hub" },
        title,
        h("p", {
          class: "challenge-hub__summary",
          text: `Completed ${completed} of ${all.length} challenges. Your best scores are saved in this browser.`,
        }),
        h("div", { class: "challenge-grid" }, cards),
        resetButton
      );
      CC.pixel.fillSlots(node);

      node.addEventListener("click", (event) => {
        const start = event.target.closest("[data-start]");
        if (start) startChallenge(all.find((c) => c.id === start.dataset.start));
        if (event.target.closest("[data-reset]") && window.confirm("Clear all saved challenge progress?")) {
          clearProgress();
          show(listView());
        }
      });
      return { node, focusTarget: title };
    }

    // -- question --
    function startChallenge(category) {
      Object.assign(state, { cat: category, index: 0, score: 0, picks: [], answered: false, saveFailed: false });
      show(questionView());
    }

    function questionView() {
      const { cat, index } = state;
      const question = cat.questions[index];
      const total = cat.questions.length;

      const prompt = heading(headingLevel, { class: "quiz__prompt", id: "quizPrompt", tabindex: "-1" }, question.prompt);
      const options = question.options.map((text, i) =>
        h(
          "button",
          { type: "button", class: "quiz-option", "data-option": i },
          h("span", { class: "quiz-option__letter", "aria-hidden": "true", text: OPTION_LETTERS[i] }),
          h("span", { class: "quiz-option__text", text }),
          h("span", { class: "quiz-option__flag" })
        )
      );
      const feedback = h("div", { class: "quiz__feedback", "aria-live": "polite" });
      const next = h(
        "button",
        { type: "button", class: "btn-cell-city btn-cell-city--primary quiz__next", hidden: true },
        index + 1 < total ? "Next question" : "See results"
      );
      const progressBar = h("div", { class: "quiz-progress__bar" });
      const progress = h(
        "div",
        { class: "quiz-progress", role: "progressbar", "aria-label": "Questions answered", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(index) },
        progressBar
      );
      progressBar.style.width = `${(index / total) * 100}%`;

      const node = h(
        "div",
        { class: "quiz" },
        h(
          "div",
          { class: "quiz__top" },
          h("button", { type: "button", class: "btn-cell-city btn-cell-city--quiet", "data-exit": "" }, "← All challenges"),
          h("p", { class: "quiz__category", text: cat.title })
        ),
        h("p", { class: "quiz__count", text: `Question ${index + 1} of ${total} · Score ${state.score}` }),
        progress,
        prompt,
        h("div", { class: "quiz__options", role: "group", "aria-labelledby": "quizPrompt" }, options),
        feedback,
        h("div", { class: "quiz__actions" }, next)
      );

      node.addEventListener("click", (event) => {
        if (event.target.closest("[data-exit]")) show(listView());
        const option = event.target.closest("[data-option]");
        if (option && !state.answered) answer(Number(option.dataset.option), node, feedback, next, progress, progressBar);
        if (event.target === next) advance();
      });
      return { node, focusTarget: prompt };
    }

    function answer(picked, node, feedback, next, progress, progressBar) {
      const { cat, index } = state;
      const question = cat.questions[index];
      const isCorrect = picked === question.answer;
      state.answered = true;
      state.picks[index] = picked;
      if (isCorrect) state.score++;

      node.querySelectorAll(".quiz-option").forEach((button, i) => {
        button.disabled = true;
        const flag = button.querySelector(".quiz-option__flag");
        if (i === question.answer) {
          button.classList.add("is-correct");
          flag.textContent = "Correct answer";
        } else if (i === picked) {
          button.classList.add("is-incorrect");
          flag.textContent = "Your answer";
        }
      });

      feedback.append(
        h("p", { class: "quiz__verdict " + (isCorrect ? "is-correct" : "is-incorrect"), text: isCorrect ? "Correct!" : "Not quite." }),
        h("p", { class: "quiz__explanation", text: (isCorrect ? "" : `The correct answer is "${question.options[question.answer]}". `) + question.explanation })
      );
      const answeredCount = index + 1;
      progress.setAttribute("aria-valuenow", String(answeredCount));
      progressBar.style.width = `${(answeredCount / cat.questions.length) * 100}%`;
      node.querySelector(".quiz__count").textContent = `Question ${index + 1} of ${cat.questions.length} · Score ${state.score}`;
      next.hidden = false;
      next.focus();
    }

    function advance() {
      state.answered = false;
      state.index++;
      if (state.index < state.cat.questions.length) show(questionView());
      else {
        state.saveFailed = !saveResult(state.cat, state.score);
        show(resultView());
      }
    }

    // -- results --
    function resultView() {
      const { cat, score, picks } = state;
      const total = cat.questions.length;
      const percent = Math.round((score / total) * 100);
      const entry = readProgress()[cat.id];
      const title = heading(headingLevel, { class: "challenge-heading", tabindex: "-1" }, "Challenge complete");

      const review = cat.questions.map((q, i) => {
        const right = picks[i] === q.answer;
        return h(
          "li",
          { class: "result-review__item " + (right ? "is-correct" : "is-incorrect") },
          h("p", { class: "result-review__prompt" }, h("strong", { text: right ? "Correct: " : "Incorrect: " }), q.prompt),
          h("p", { class: "result-review__answer", text: `Answer: ${q.options[q.answer]}` + (right ? "" : ` (you chose ${q.options[picks[i]]})`) })
        );
      });

      const node = h(
        "div",
        { class: "result" },
        title,
        h("p", { class: "result__category", text: cat.title }),
        h("p", { class: "result__score" }, `${score} / ${total}`, h("span", { class: "result__percent", text: ` (${percent}%)` })),
        h("p", { class: "result__message", text: MESSAGES.find((m) => percent >= m.min).text }),
        entry ? h("p", { class: "result__best", text: `Best score: ${entry.best} / ${entry.total} · Attempts: ${entry.attempts}` }) : null,
        state.saveFailed
          ? h("p", { class: "result__warning", role: "status", text: "Your browser blocked saving, so this result was not stored." })
          : null,
        h("ol", { class: "result-review" }, review),
        h(
          "div",
          { class: "quiz__actions" },
          h("button", { type: "button", class: "btn-cell-city btn-cell-city--primary", "data-restart": "" }, "Restart challenge"),
          h("button", { type: "button", class: "btn-cell-city", "data-exit": "" }, "Back to challenges")
        )
      );
      node.addEventListener("click", (event) => {
        if (event.target.closest("[data-restart]")) startChallenge(cat);
        if (event.target.closest("[data-exit]")) show(listView());
      });
      return { node, focusTarget: title };
    }

    if (!categories().length) {
      container.replaceChildren(h("p", { class: "lab-error", text: "Challenge data could not be loaded." }));
      return;
    }
    show(listView(), { focus: false });
  }

  CC.challenges = { mount, readProgress, saveResult, clearProgress, STORAGE_KEY };

  // The Challenges page marks its container; the City page mounts into a modal instead.
  document.querySelectorAll("[data-challenge-app]").forEach((container) => mount(container));
})();
