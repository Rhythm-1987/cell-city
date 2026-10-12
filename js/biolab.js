"use strict";

/*
 * Bio Lab user interface. All sequence logic lives in biolab-core.js and all
 * codon data in data/genetic-code.js; this file only reads inputs, calls
 * them and renders results (text is always inserted as text, never as HTML).
 */
(function () {
  const CC = (window.CellCity = window.CellCity || {});
  const { h } = CC.dom;
  const bio = CC.bio;
  const code = CC.data.geneticCode;

  const EXAMPLE_DNA = "ATGGCCATTGTAATGGGCCGCTGA"; // Met-Ala-Ile-Val-Met-Gly-Arg-Stop
  const EXAMPLE_RNA = "AUGGCCAUUGUAAUGGGCCGCUGA";
  const SEQUENCE_COLOUR_LIMIT = 1000; // beyond this, plain text keeps the page fast
  const MUTATION_BLOCK_SIZE = 15; // columns per row of the before/after view

  const $ = (id) => document.getElementById(id);

  // ---- shared helpers ------------------------------------------------------------

  function showError(input, errorEl, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    input.setAttribute("aria-invalid", "true");
  }

  function clearError(input, errorEl) {
    errorEl.textContent = "";
    errorEl.hidden = true;
    input.removeAttribute("aria-invalid");
  }

  function setResults(container, ...nodes) {
    container.replaceChildren(...nodes);
  }

  const emptyMessage = (text) => h("p", { class: "lab-empty", text });

  /** Sequence in a monospace box; bases are coloured when the sequence is short enough. */
  function sequenceBox(seq) {
    const box = h("p", { class: "sequence-output" });
    if (seq.length > SEQUENCE_COLOUR_LIMIT) box.textContent = seq;
    else [...seq].forEach((base) => box.append(h("span", { class: `seq-base seq-base--${base}`, text: base })));
    return box;
  }

  function resultBlock(title, seq, meta) {
    return h(
      "div",
      { class: "result-block" },
      h("h3", { text: title }),
      meta ? h("p", { class: "result-block__meta", text: meta }) : null,
      sequenceBox(seq)
    );
  }

  /** Wires the Example / Clear buttons of a form. */
  function wireHelpers(form, { example, reset }) {
    form.querySelector("[data-example]").addEventListener("click", example);
    form.querySelector("[data-clear]").addEventListener("click", reset);
  }

  // ---- A. DNA analyser -----------------------------------------------------------

  function initAnalyser() {
    const form = $("analyse-form");
    const input = $("analyse-input");
    const error = $("analyse-error");
    const results = $("analyse-results");
    const emptyText = "Results will appear here after you analyse a sequence.";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const seq = bio.normalise(input.value);
      const check = bio.validate(seq, "DNA");
      if (!check.ok) {
        showError(input, error, check.error);
        setResults(results, emptyMessage("No results: fix the sequence above and analyse again."));
        return;
      }
      clearError(input, error);
      const analysis = bio.analyse(seq);

      const baseStat = (base) => {
        const count = analysis.counts[base];
        const share = (count / analysis.length) * 100;
        const bar = h("div", { class: `base-bar base-bar--${base}`, "aria-hidden": "true" }, h("span"));
        bar.firstChild.style.width = `${share}%`;
        return h("div", { class: "stat-card" }, h("dt", { text: `Base ${base}` }), h("dd", { text: String(count) }), bar);
      };

      setResults(
        results,
        h(
          "dl",
          { class: "stat-grid" },
          h("div", { class: "stat-card" }, h("dt", { text: "Length" }), h("dd", { text: `${analysis.length}` })),
          h("div", { class: "stat-card stat-card--gc" }, h("dt", { text: "GC content" }), h("dd", { text: `${analysis.gcPercent.toFixed(1)}%` })),
          ["A", "C", "G", "T"].map(baseStat)
        ),
        h("p", { class: "result-block__meta", text: "GC content = (G + C) ÷ sequence length × 100" }),
        resultBlock("Sequence", seq),
        resultBlock("Complement", analysis.complement, "Each base replaced by its pair (A↔T, C↔G). Written under the input, so it reads 3′ → 5′."),
        resultBlock("Reverse complement", analysis.reverseComplement, "The complement read backwards, so it reads 5′ → 3′: the sequence of the opposite strand.")
      );
    });

    wireHelpers(form, {
      example: () => {
        input.value = EXAMPLE_DNA;
        form.requestSubmit();
      },
      reset: () => {
        input.value = "";
        clearError(input, error);
        setResults(results, emptyMessage(emptyText));
        input.focus();
      },
    });
  }

  // ---- B. Transcription ----------------------------------------------------------

  function initTranscription(onTranslate) {
    const form = $("transcribe-form");
    const input = $("transcribe-input");
    const error = $("transcribe-error");
    const results = $("transcribe-results");
    const emptyText = "The mRNA sequence will appear here.";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const seq = bio.normalise(input.value);
      const check = bio.validate(seq, "DNA");
      if (!check.ok) {
        showError(input, error, check.error);
        setResults(results, emptyMessage("No results: fix the sequence and transcribe again."));
        return;
      }
      clearError(input, error);
      const strand = form.elements.strand.value;
      const mrna = bio.transcribe(seq, strand);
      const rule =
        strand === "template"
          ? "Template strand: the mRNA is the reverse complement of the input, with T written as U."
          : "Coding strand: the mRNA has the same sequence as the input, with each T replaced by U.";

      const toTranslation = h("button", { type: "button", class: "btn-cell-city", text: "Translate this mRNA →" });
      toTranslation.addEventListener("click", () => onTranslate(mrna));

      setResults(
        results,
        resultBlock("Input DNA (5′ → 3′)", seq),
        resultBlock("mRNA (5′ → 3′)", mrna, rule),
        h("div", { class: "lab-actions" }, toTranslation)
      );
    });

    wireHelpers(form, {
      example: () => {
        input.value = EXAMPLE_DNA;
        form.elements.strand.value = "coding";
        form.requestSubmit();
      },
      reset: () => {
        input.value = "";
        clearError(input, error);
        setResults(results, emptyMessage(emptyText));
        input.focus();
      },
    });
  }

  // ---- C. Translation ------------------------------------------------------------

  function initTranslation() {
    const form = $("translate-form");
    const input = $("translate-input");
    const error = $("translate-error");
    const results = $("translate-results");
    const frameSelect = $("translate-frame");
    const startBox = $("translate-start");
    const stopBox = $("translate-stop");
    const emptyText = "The amino-acid chain will appear here.";

    function chip(entry) {
      const label = entry.isStop ? "Stop" : `${entry.three} (${entry.letter})`;
      return h(
        "li",
        { class: "codon-chip" + (entry.isStop ? " is-stop" : entry.isStart ? " is-start" : "") },
        h("span", { class: "codon-chip__codon", text: entry.codon }),
        h("span", { class: "codon-chip__aa", text: label })
      );
    }

    function run() {
      const rna = bio.normalise(input.value);
      const check = bio.validate(rna, "RNA");
      if (!check.ok) {
        showError(input, error, check.error);
        setResults(results, emptyMessage("No results: fix the sequence and translate again."));
        return;
      }
      clearError(input, error);
      const frame = Number(frameSelect.value);
      const out = bio.translate(rna, { frame, startAtAug: startBox.checked, stopAtStop: stopBox.checked });

      if (!out.startFound) {
        setResults(results, h("p", { class: "lab-warning", text: `No AUG start codon was found in frame ${frame}.` }));
        return;
      }
      if (!out.codons.length) {
        setResults(results, h("p", { class: "lab-warning", text: `Frame ${frame} has no complete codon: the sequence needs at least ${frame + 2} bases.` }));
        return;
      }

      const notes = [`Reading frame ${frame}; translation starts at base ${out.startIndex + 1}.`];
      if (out.endedAtStop) notes.push("Translation ended at the first stop codon.");
      if (out.leftover) {
        notes.push(`${out.leftover.length} leftover base${out.leftover.length > 1 ? "s" : ""} (${out.leftover}) at the end do not form a full codon, so they were not translated.`);
      }
      const threeLetter = out.codons.map((c) => c.three).join("-");

      setResults(
        results,
        h("div", { class: "result-block" }, h("h3", { text: "Protein (one-letter code, * = stop)" }), h("p", { class: "sequence-output", text: out.protein })),
        h("div", { class: "result-block" }, h("h3", { text: "Amino-acid chain" }), h("p", { class: "sequence-output", text: threeLetter })),
        h("div", { class: "result-block" }, h("h3", { text: `Codons (${out.codons.length})` }), h("ul", { class: "codon-chips" }, out.codons.map(chip))),
        h("div", { class: "lab-note" }, notes.map((text) => h("p", { text })))
      );
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      run();
    });

    wireHelpers(form, {
      example: () => {
        input.value = EXAMPLE_RNA;
        frameSelect.value = "1";
        startBox.checked = false;
        stopBox.checked = false;
        run();
      },
      reset: () => {
        input.value = "";
        clearError(input, error);
        setResults(results, emptyMessage(emptyText));
        input.focus();
      },
    });

    return (rna) => {
      input.value = rna;
      frameSelect.value = "1";
      run();
    };
  }

  // ---- D. Codon explorer ---------------------------------------------------------

  function initCodonExplorer() {
    const selects = ["codon-b1", "codon-b2", "codon-b3"].map($);
    const result = $("codon-result");
    const search = $("codon-search");
    const status = $("codon-status");
    const body = $("codon-table-body");
    const rows = new Map();

    selects.forEach((select) => {
      [..."UCAG"].forEach((base) => select.append(h("option", { value: base, text: base })));
      select.addEventListener("change", () => showCodon(selects.map((s) => s.value).join("")));
    });

    function showCodon(codon) {
      const entry = code.byCodon[codon];
      selects.forEach((select, i) => (select.value = codon[i]));
      rows.forEach((row, key) => row.classList.toggle("is-selected", key === codon));

      const synonyms = code.codons.filter((c) => c.letter === entry.letter && c.codon !== codon).map((c) => c.codon);
      const lines = [];
      if (entry.isStop) {
        lines.push("A stop codon: it ends translation and codes for no amino acid.");
      } else {
        lines.push(`${entry.name} (${entry.three}, ${entry.letter}).`);
        if (entry.isStart) lines.push("AUG is also the usual start codon.");
      }
      lines.push(
        synonyms.length
          ? `${entry.isStop ? "Other stop codons" : "Other codons for the same amino acid"}: ${synonyms.join(", ")}.`
          : "It is the only codon for this amino acid."
      );
      result.replaceChildren(
        h("p", { class: "codon-result__codon", text: codon }),
        ...lines.map((text) => h("p", { class: "codon-result__aa", text }))
      );
    }

    code.codons.forEach((entry) => {
      const pick = h("button", { type: "button", class: "codon-pick", "aria-label": `Show codon ${entry.codon}`, text: entry.codon });
      pick.addEventListener("click", () => showCodon(entry.codon));
      const row = h(
        "tr",
        { class: entry.isStop ? "is-stop" : entry.isStart ? "is-start" : "" },
        h("td", {}, pick),
        h("td", { text: entry.name }),
        h("td", { text: entry.three }),
        h("td", { text: entry.letter })
      );
      rows.set(entry.codon, row);
      body.append(row);
    });

    // Codon prefixes accept T as well as U; amino acids match by name, 3-letter or 1-letter code.
    function matches(entry, query) {
      if (!query) return true;
      const rnaQuery = query.toUpperCase().replaceAll("T", "U");
      if (query.length <= 3 && /^[ACGTU]+$/i.test(query) && entry.codon.startsWith(rnaQuery)) return true;
      if (query === "stop") return entry.isStop;
      if (query.length === 1) return entry.letter.toLowerCase() === query;
      // Any word of the name may start with the query ("acid" finds both aspartic and glutamic acid).
      return entry.three.toLowerCase() === query || entry.name.toLowerCase().split(" ").some((word) => word.startsWith(query));
    }

    function applyFilter() {
      const query = search.value.trim().toLowerCase();
      let shown = 0;
      code.codons.forEach((entry) => {
        const visible = matches(entry, query);
        rows.get(entry.codon).hidden = !visible;
        if (visible) shown++;
      });
      status.textContent = shown
        ? `Showing ${shown} of ${code.codons.length} codons.`
        : `No codon or amino acid matches “${search.value.trim()}”.`;
    }

    search.addEventListener("input", applyFilter);
    showCodon("AUG");
    applyFilter();
  }

  // ---- E. Mutation visualiser ----------------------------------------------------

  function initMutations() {
    const form = $("mutate-form");
    const input = $("mutate-input");
    const error = $("mutate-error");
    const results = $("mutate-results");
    const position = $("mutate-position");
    const base = $("mutate-base");
    const baseField = $("mutate-base-field");
    const hint = $("mutate-position-hint");
    const emptyText = "Enter a sequence and apply a mutation to compare before and after.";

    const selectedType = () => form.elements["mutation-type"].value;

    function updateHint() {
      const type = selectedType();
      const length = bio.normalise(input.value).length;
      const range = length ? ` (1 to ${type === "insertion" ? length + 1 : length} for this sequence)` : "";
      baseField.hidden = type === "deletion";
      hint.textContent = {
        substitution: `Position of the base to replace${range}. Counting starts at 1.`,
        insertion: `The new base goes immediately before this position${range}. Use the length + 1 to add it after the last base.`,
        deletion: `Position of the base to remove${range}. Counting starts at 1.`,
      }[type];
    }

    function cell(text, state) {
      return h("span", { class: "mut-cell" + (state ? ` ${state}` : ""), text });
    }

    function renderColumns(columns) {
      const blocks = h("div", { class: "mut-blocks", "aria-hidden": "true" });
      for (let start = 0; start < columns.length; start += MUTATION_BLOCK_SIZE) {
        const block = h("div", { class: "mut-block" });
        columns.slice(start, start + MUTATION_BLOCK_SIZE).forEach((col) => {
          const showIndex = col.state !== "same" || col.index % 5 === 0;
          const label = col.index === null ? "+" : showIndex ? String(col.index) : "";
          const original =
            col.state === "deleted" ? cell(col.original, "is-deleted") : col.state === "changed" ? cell(col.original, "is-changed") : col.original === null ? cell("–", "is-gap") : cell(col.original);
          const mutated =
            col.state === "inserted" ? cell(col.mutated, "is-inserted") : col.state === "changed" ? cell(col.mutated, "is-changed") : col.mutated === null ? cell("–", "is-gap") : cell(col.mutated);
          block.append(h("span", { class: "mut-cell mut-cell--index", text: label }), original, mutated);
        });
        blocks.append(block);
      }
      return blocks;
    }

    function legend() {
      return h(
        "ul",
        { class: "mut-legend" },
        h("li", {}, "Top row: original. Bottom row: mutated."),
        h("li", {}, cell("A", "is-changed"), "substituted"),
        h("li", {}, cell("A", "is-inserted"), "inserted"),
        h("li", {}, cell("A", "is-deleted"), "deleted"),
        h("li", {}, cell("–", "is-gap"), "no base here")
      );
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const seq = bio.normalise(input.value);
      const check = bio.validate(seq, "DNA");
      if (!check.ok) {
        showError(input, error, check.error);
        setResults(results, emptyMessage("No results: fix the sequence and apply the mutation again."));
        return;
      }
      const type = selectedType();
      const outcome = bio.mutate(seq, {
        type,
        position: position.value.trim() === "" ? NaN : Number(position.value),
        base: base.value,
      });
      if (!outcome.ok) {
        showError(input, error, outcome.error);
        setResults(results, emptyMessage("No results: fix the problem above and try again."));
        return;
      }
      clearError(input, error);

      const effect = outcome.effect;
      setResults(
        results,
        h("h3", { text: "Before and after" }),
        legend(),
        renderColumns(outcome.columns),
        h(
          "div",
          { class: "mut-summary" },
          h("p", {}, h("strong", { text: "What changed: " }), outcome.description),
          h("p", {}, h("strong", { text: "Original: " }), h("span", { class: "mono", text: outcome.original })),
          h("p", {}, h("strong", { text: "Mutated: " }), h("span", { class: "mono", text: outcome.mutated }))
        ),
        h(
          "div",
          { class: "lab-note" },
          h("p", {}, h("strong", { text: "Illustration only. " }), "Reading both sequences as coding DNA from base 1 (frame 1):"),
          h("p", { text: effect.text }),
          effect.before !== effect.after ? h("p", { class: "mono", text: `Protein before: ${effect.before || "(none)"}  →  after: ${effect.after || "(none)"}` }) : null
        )
      );
    });

    form.addEventListener("change", updateHint);
    input.addEventListener("input", updateHint);

    wireHelpers(form, {
      example: () => {
        input.value = EXAMPLE_DNA;
        form.elements["mutation-type"].value = "substitution";
        position.value = "5";
        base.value = "A";
        updateHint();
        form.requestSubmit();
      },
      reset: () => {
        input.value = "";
        position.value = "4";
        clearError(input, error);
        updateHint();
        setResults(results, emptyMessage(emptyText));
        input.focus();
      },
    });
    updateHint();
  }

  // ---- start up ------------------------------------------------------------------

  initAnalyser();
  const translateRna = initTranslation();
  initTranscription((mrna) => {
    translateRna(mrna);
    bootstrap.Tab.getOrCreateInstance($("tab-translate")).show();
  });
  initCodonExplorer();
  initMutations();
})();
