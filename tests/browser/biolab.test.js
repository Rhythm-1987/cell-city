"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, skip } = require("../helpers/fixture");

const text = (page, selector) => page.eval(`document.querySelector(${JSON.stringify(selector)}).textContent`);
const visible = (page, selector) => page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && !el.hidden && el.getClientRects().length > 0; })()`);
const activeTab = (page) => page.eval("document.querySelector('#labTabs .nav-link.active').id");

async function showTab(page, name) {
  await page.click(`#tab-${name}`);
  await page.waitFor(`document.querySelector('#pane-${name}').classList.contains('show')`);
}

test("Bio Lab page (headless browser)", { skip }, async (t) => {
  const env = await setup();
  t.after(() => env.teardown());
  const open = (opts) => env.open("bio-lab.html", opts);

  await t.test("loads cleanly with five tabs and a labelled, named control for every field", async () => {
    const page = await open();
    assert.equal(await page.eval("document.querySelectorAll('#labTabs [role=tab]').length"), 5);
    assert.equal(await activeTab(page), "tab-analyse");
    assert.deepEqual(page.consoleProblems, []);
    assert.deepEqual(page.failedRequests, []);
    const unlabelled = await page.eval(`[...document.querySelectorAll('input, select, textarea')].filter(el =>
      !el.labels.length && !el.getAttribute('aria-label')).map(el => el.id)`);
    assert.deepEqual(unlabelled, []);
  });

  await t.test("DNA analyser: mixed case, spaces and line breaks give independently computed statistics", async () => {
    const page = await open();
    await page.fill("#analyse-input", "at gC\nggA");
    await page.click("#analyse-form [type=submit]");
    const stats = await page.eval(`Object.fromEntries([...document.querySelectorAll('#analyse-results .stat-card')].map(c => [c.querySelector('dt').textContent, c.querySelector('dd').textContent]))`);
    // ATGCGGA: A=2 (A,A) ... A T G C G G A -> A2 C1 G3 T1; GC = 4/7 = 57.1%
    assert.deepEqual(stats, { Length: "7", "GC content": "57.1%", "Base A": "2", "Base C": "1", "Base G": "3", "Base T": "1" });
    const blocks = await page.eval(`[...document.querySelectorAll('#analyse-results .result-block')].map(b => [b.querySelector('h3').textContent, b.querySelector('.sequence-output').textContent])`);
    assert.deepEqual(blocks, [["Sequence", "ATGCGGA"], ["Complement", "TACGCCT"], ["Reverse complement", "TCCGCAT"]]);
    assert.equal(await visible(page, "#analyse-error"), false);
    assert.equal(await page.eval("document.getElementById('analyse-input').hasAttribute('aria-invalid')"), false);
  });

  await t.test("DNA analyser: empty and invalid input show an associated error, then recover", async () => {
    const page = await open();
    await page.click("#analyse-form [type=submit]");
    assert.equal(await text(page, "#analyse-error"), "Enter a DNA sequence first.");
    assert.equal(await page.eval("document.getElementById('analyse-error').getAttribute('role')"), "alert");
    assert.equal(await page.eval("document.getElementById('analyse-input').getAttribute('aria-invalid')"), "true");
    assert.match(await page.eval("document.getElementById('analyse-input').getAttribute('aria-describedby')"), /analyse-error/);

    await page.fill("#analyse-input", "ATGXYZ");
    await page.click("#analyse-form [type=submit]");
    assert.match(await text(page, "#analyse-error"), /Invalid character “X” at position 4/);
    assert.match(await text(page, "#analyse-error"), /3 invalid characters/);
    assert.match(await text(page, "#analyse-results"), /No results/);

    await page.fill("#analyse-input", "ATGU");
    await page.click("#analyse-form [type=submit]");
    assert.match(await text(page, "#analyse-error"), /U belongs to RNA/);

    await page.fill("#analyse-input", "ATGC");
    await page.click("#analyse-form [type=submit]");
    assert.equal(await visible(page, "#analyse-error"), false);
    assert.equal(await page.eval("document.querySelectorAll('#analyse-results .stat-card').length"), 6);
  });

  await t.test("user input is never interpreted as HTML (script/markup probes)", async () => {
    const page = await open();
    const probes = [
      `<img src=x onerror="window.__pwned=1">`,
      `"><svg onload="window.__pwned=1">`,
      `<script>window.__pwned=1</script>`,
      `ATG<b>C</b>`,
    ];
    for (const [form, input, submit] of [
      ["#analyse-form", "#analyse-input", "#analyse-form [type=submit]"],
    ]) {
      for (const probe of probes) {
        await page.fill(input, probe);
        await page.click(submit);
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(await page.eval("window.__pwned"), undefined, `probe executed: ${probe}`);
        assert.equal(await page.eval(`document.querySelectorAll('${form} ~ * img, #pane-analyse img, #pane-analyse svg [onload], #pane-analyse b, #pane-analyse script').length`), 0);
        assert.ok((await text(page, "#analyse-error")).length < 300);
      }
    }
    for (const id of ["transcribe", "translate", "mutate"]) {
      await showTab(page, id);
      for (const probe of probes) {
        await page.fill(`#${id}-input`, probe);
        await page.click(`#${id}-form [type=submit]`);
        assert.equal(await page.eval("window.__pwned"), undefined);
        assert.equal(await page.eval(`document.querySelectorAll('#pane-${id} img, #pane-${id} b, #pane-${id} script').length`), 0);
      }
    }
    await showTab(page, "codons");
    await page.fill("#codon-search", "<img src=x onerror=window.__pwned=1>");
    assert.equal(await page.eval("window.__pwned"), undefined);
    assert.equal(await page.eval("document.querySelectorAll('#pane-codons img').length"), 0);
    assert.match(await text(page, "#codon-status"), /No codon or amino acid matches “<img src=x onerror=window.__pwned=1>”/, "echoed as text");
    assert.deepEqual(page.consoleProblems, []);
  });

  await t.test("Use example and Clear buttons work and Clear returns focus to the input", async () => {
    const page = await open();
    await page.click("#analyse-form [data-example]");
    assert.equal(await page.eval("document.getElementById('analyse-input').value"), "ATGGCCATTGTAATGGGCCGCTGA");
    assert.equal(await text(page, "#analyse-results .stat-card dd"), "24");
    await page.click("#analyse-form [data-clear]");
    assert.equal(await page.eval("document.getElementById('analyse-input').value"), "");
    assert.match(await text(page, "#analyse-results"), /Results will appear here/);
    assert.equal(await page.eval("document.activeElement.id"), "analyse-input");
  });

  await t.test("transcription: coding vs template strand give the independently known mRNA", async () => {
    const page = await open();
    await showTab(page, "transcribe");
    const mrna = () => page.eval("[...document.querySelectorAll('#transcribe-results .result-block')].map(b => b.querySelector('.sequence-output').textContent)");
    await page.fill("#transcribe-input", "atgc");
    await page.click("#transcribe-form [type=submit]");
    assert.deepEqual(await mrna(), ["ATGC", "AUGC"]);
    assert.match(await text(page, "#transcribe-results"), /same sequence as the input, with each T replaced by U/);

    await page.click("#strand-template");
    await page.fill("#transcribe-input", "TGCCAT"); // 5'-TGCCAT-3' template -> 5'-AUGGCA-3'
    await page.click("#transcribe-form [type=submit]");
    assert.deepEqual(await mrna(), ["TGCCAT", "AUGGCA"]);
    assert.match(await text(page, "#transcribe-results"), /reverse complement of the input/);

    await page.fill("#transcribe-input", "TGCCAU");
    await page.click("#transcribe-form [type=submit]");
    assert.match(await text(page, "#transcribe-error"), /U belongs to RNA/);
  });

  await t.test("transcription hands its mRNA to the translation tab", async () => {
    const page = await open();
    await showTab(page, "transcribe");
    await page.click("#transcribe-form [data-example]");
    await page.click("#transcribe-results .btn-cell-city");
    await page.waitFor("document.querySelector('#pane-translate').classList.contains('show')");
    assert.equal(await activeTab(page), "tab-translate");
    assert.equal(await page.eval("document.getElementById('translate-input').value"), "AUGGCCAUUGUAAUGGGCCGCUGA");
    assert.equal(await text(page, "#translate-results .sequence-output"), "MAIVMGR*");
  });

  await t.test("translation: frames, start and stop options, leftovers and explanatory text", async () => {
    const page = await open();
    await showTab(page, "translate");
    const protein = () => text(page, "#translate-results .sequence-output");
    const notes = () => text(page, "#translate-results .lab-note");

    await page.fill("#translate-input", "AAUGCCCUAG");
    await page.click("#translate-form [type=submit]");
    assert.equal(await protein(), "NAL");
    assert.match(await notes(), /1 leftover base \(G\)/);

    await page.eval("(() => { const s = document.getElementById('translate-frame'); s.value = '2'; })()");
    await page.click("#translate-form [type=submit]");
    assert.equal(await protein(), "MP*");
    assert.match(await notes(), /Reading frame 2; translation starts at base 2/);

    await page.eval("document.getElementById('translate-frame').value = '3'");
    await page.click("#translate-form [type=submit]");
    assert.equal(await protein(), "CP");
    assert.match(await notes(), /2 leftover bases \(AG\)/);

    // Start and stop options.
    await page.fill("#translate-input", "GGAUGUUUUAAGGG");
    await page.eval("document.getElementById('translate-frame').value = '3'");
    await page.click("#translate-start");
    await page.click("#translate-stop");
    await page.click("#translate-form [type=submit]");
    assert.equal(await protein(), "MF*");
    assert.match(await notes(), /ended at the first stop codon/);
    assert.match(await notes(), /starts at base 3/);

    await page.click("#translate-stop"); // off: translation continues through the stop codon
    await page.click("#translate-form [type=submit]");
    assert.equal(await protein(), "MF*G");

    await page.eval("document.getElementById('translate-frame').value = '1'");
    await page.click("#translate-form [type=submit]");
    assert.match(await text(page, "#translate-results .lab-warning"), /No AUG start codon was found in frame 1/);

    await page.fill("#translate-input", "AU");
    await page.click("#translate-start"); // off
    await page.click("#translate-form [type=submit]");
    assert.match(await text(page, "#translate-results .lab-warning"), /no complete codon/);

    // DNA letters are explained, not silently accepted.
    await page.fill("#translate-input", "ATGGCC");
    await page.click("#translate-form [type=submit]");
    assert.match(await text(page, "#translate-error"), /T belongs to DNA; use the Transcription tab/);

    // The on-page instructions describe both options.
    const help = await text(page, "#pane-translate");
    assert.match(help, /Begin at the first AUG in the chosen frame/);
    assert.match(help, /End at the first stop codon/);
    assert.match(help, /Leftover bases at the end that do not form a full codon are not translated/);
    assert.match(help, /continues past stop codons|keeps going past stop codons|translation continues/i, "UI explains what happens when 'End at first stop' is off");
  });

  await t.test("codon explorer: 64 rows, builder, selection and search by codon, name, symbol, T-for-U and 'stop'", async () => {
    const page = await open();
    await showTab(page, "codons");
    const shown = () => page.eval("[...document.querySelectorAll('#codon-table-body tr')].filter(r => !r.hidden).map(r => r.cells[0].textContent)");
    assert.equal((await shown()).length, 64);
    assert.equal(await text(page, "#codon-status"), "Showing 64 of 64 codons.");
    assert.match(await text(page, "#codon-result"), /AUG[\s\S]*Methionine \(Met, M\)[\s\S]*usual start codon[\s\S]*only codon for this amino acid/);

    // Builder: U-G-A is a stop codon.
    await page.eval(`(() => { for (const [id, v] of [['codon-b1','U'],['codon-b2','G'],['codon-b3','A']]) { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
    assert.match(await text(page, "#codon-result"), /UGA[\s\S]*stop codon[\s\S]*Other stop codons: UAA, UAG/);
    assert.equal(await page.eval("document.querySelector('#codon-table-body tr.is-selected').cells[0].textContent"), "UGA");

    // Clicking a row sets the builder.
    await page.click("#codon-table-body tr:nth-child(1) .codon-pick");
    assert.equal(await page.eval("['codon-b1','codon-b2','codon-b3'].map(id => document.getElementById(id).value).join('')"), "UUU");
    assert.match(await text(page, "#codon-result"), /Phenylalanine/);

    const search = async (q) => { await page.fill("#codon-search", q); return shown(); };
    assert.deepEqual(await search("aug"), ["AUG"]);
    assert.deepEqual(await search("ATG"), ["AUG"]);
    assert.equal((await search("leu")).length, 6);
    assert.equal((await search("Leucine")).length, 6);
    assert.deepEqual((await search("stop")).sort(), ["UAA", "UAG", "UGA"]);
    assert.equal((await search("uu")).length, 4);
    assert.equal((await search("  ser ")).length, 6);
    assert.equal((await search("acid")).length, 4);
    assert.deepEqual(await search("zzz"), []);
    assert.equal(await text(page, "#codon-status"), "No codon or amino acid matches “zzz”.");
    assert.equal((await search("")).length, 64);

    // One-letter amino-acid codes must work even when the letter is also a base (A, C, G, T).
    for (const [q, letter] of [["a", "A"], ["c", "C"], ["g", "G"], ["t", "T"], ["m", "M"], ["W", "W"]]) {
      await search(q);
      const letters = await page.eval("[...document.querySelectorAll('#codon-table-body tr')].filter(r => !r.hidden).map(r => r.cells[3].textContent)");
      assert.ok(letters.includes(letter), `searching "${q}" should list the amino acid with symbol ${letter}`);
    }
  });

  await t.test("mutation visualiser: substitution, insertion, deletion, labels, effects and wording", async () => {
    const page = await open();
    await showTab(page, "mutate");
    const cells = (row) => page.eval(`[...document.querySelectorAll('#mutate-results .mut-col')].map(col => col.children[${row}].textContent)`);
    await page.fill("#mutate-input", "atggcc");

    // Substitution: position 3 G->A
    await page.fill("#mutate-position", "3");
    await page.eval("document.getElementById('mutate-base').value = 'A'");
    await page.click("#mutate-form [type=submit]");
    assert.equal((await cells(1)).join(""), "ATGGCC");
    assert.equal((await cells(2)).join(""), "ATAGCC");
    assert.equal(await page.eval("document.querySelectorAll('#mutate-results .mut-cell.is-changed').length"), 2 + 1, "two changed cells plus the legend swatch");
    const summary = await text(page, "#mutate-results .mut-summary");
    assert.match(summary, /Substitution at position 3: G → A/);
    assert.match(summary, /Original: ATGGCC/);
    assert.match(summary, /Mutated: ATAGCC/);
    assert.match(await text(page, "#mutate-results .lab-note"), /Missense-type change: codon 1 \(AUG → AUA\) changes Methionine to Isoleucine/);
    assert.match(await text(page, "#mutate-results .lab-note"), /Protein before: MA\s+→\s+after: IA/);

    // No-op substitution
    await page.fill("#mutate-position", "1");
    await page.eval("document.getElementById('mutate-base').value = 'A'");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-results .mut-summary"), /matches the original, so the sequence is unchanged/);

    // Insertion before position 1, and appending at length + 1
    await page.click("#mut-insertion");
    assert.match(await text(page, "#mutate-position-hint"), /immediately before this position \(1 to 7 for this sequence\)/);
    await page.fill("#mutate-position", "1");
    await page.eval("document.getElementById('mutate-base').value = 'T'");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-results .mut-summary"), /Mutated: TATGGCC/);
    assert.equal((await cells(1))[0], "–");
    await page.fill("#mutate-position", "7");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-results .mut-summary"), /Mutated: ATGGCCT/);
    assert.match(await text(page, "#mutate-results .mut-summary"), /added after the last base/);

    // Deletion hides the base field, removes the chosen base
    await page.click("#mut-deletion");
    assert.equal(await visible(page, "#mutate-base-field"), false);
    await page.fill("#mutate-position", "6");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-results .mut-summary"), /Mutated: ATGGC$/m);
    assert.equal((await cells(2)).join(""), "ATGGC–");

    // An indel's frame effect is described conditionally, not as a certainty in every context.
    const effect = await text(page, "#mutate-results .lab-note");
    assert.match(effect, /Illustration only/);
    assert.match(effect, /multiple of three/i);
    assert.doesNotMatch(effect, /^\s*A single-base \w+ shifts the reading frame of every codon/m);
  });

  await t.test("mutation visualiser: invalid positions and sequences are reported on the right field", async () => {
    const page = await open();
    await showTab(page, "mutate");
    await page.fill("#mutate-input", "ATGGCC");

    await page.fill("#mutate-position", "99");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-error"), /Position must be between 1 and 6 for substitution/);
    assert.equal(await page.eval("document.getElementById('mutate-position').getAttribute('aria-invalid')"), "true", "the position field is marked invalid");
    assert.equal(await page.eval("document.getElementById('mutate-input').hasAttribute('aria-invalid')"), false, "the sequence field is not");
    assert.match(await page.eval("document.getElementById('mutate-position').getAttribute('aria-describedby')"), /mutate-error/);

    await page.fill("#mutate-position", "");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-error"), /whole number/);

    await page.fill("#mutate-position", "0");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-error"), /between 1 and 6/);

    await page.fill("#mutate-input", "ATGQ");
    await page.fill("#mutate-position", "1");
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-error"), /Invalid character “Q” at position 4/);
    assert.equal(await page.eval("document.getElementById('mutate-input').getAttribute('aria-invalid')"), "true");
    assert.equal(await page.eval("document.getElementById('mutate-position').hasAttribute('aria-invalid')"), false);

    await page.fill("#mutate-input", "A".repeat(201));
    await page.click("#mutate-form [type=submit]");
    assert.match(await text(page, "#mutate-error"), /up to 200 bases; your sequence has 201/);

    await page.fill("#mutate-input", "ATGC");
    await page.fill("#mutate-position", "2");
    await page.click("#mutate-form [type=submit]");
    assert.equal(await visible(page, "#mutate-error"), false);
    assert.equal(await page.eval("document.querySelectorAll('[aria-invalid]').length"), 0, "errors clear every invalid marker");
  });

  await t.test("a 200-base sequence renders quickly with every base aligned", async () => {
    const page = await open();
    await showTab(page, "mutate");
    const seq = "ACGT".repeat(50);
    await page.fill("#mutate-input", seq);
    await page.fill("#mutate-position", "100");
    const ms = await page.eval(`(() => { const t = performance.now(); document.querySelector('#mutate-form [type=submit]').click(); return performance.now() - t; })()`);
    assert.equal(await page.eval("document.querySelectorAll('#mutate-results .mut-col').length"), 200, "one column per base");
    assert.ok(ms < 200, `rendering took ${ms}ms`);
  });

  await t.test("tabs work with the keyboard (arrow keys move between tabs)", async () => {
    const page = await open();
    await page.eval("document.getElementById('tab-analyse').focus()");
    await page.press("ArrowRight");
    assert.equal(await page.eval("document.activeElement.id"), "tab-transcribe");
    await page.press("Enter");
    await page.waitFor("document.querySelector('#pane-transcribe').classList.contains('show')");
    assert.equal(await page.eval("document.getElementById('tab-transcribe').getAttribute('aria-selected')"), "true");
    assert.equal(await page.eval("document.getElementById('tab-analyse').getAttribute('aria-selected')"), "false");
  });

  await t.test("375px: no horizontal overflow on any tab, with results showing", async () => {
    const page = await open({ width: 375, height: 800 });
    const overflow = () => page.eval("document.documentElement.scrollWidth - window.innerWidth");
    for (const id of ["analyse", "transcribe", "translate", "codons", "mutate"]) {
      await showTab(page, id);
      if (id !== "codons") await page.click(`#pane-${id} [data-example]`);
      assert.ok((await overflow()) <= 0, `${id} overflows by ${await overflow()}px`);
    }
    await showTab(page, "analyse");
    await page.fill("#analyse-input", "ACGT".repeat(150));
    await page.click("#analyse-form [type=submit]");
    assert.ok((await overflow()) <= 0, "600-base sequence overflows");
  });
});
