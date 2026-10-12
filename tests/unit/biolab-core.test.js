"use strict";

/* Expected values below were worked out by hand, not produced by the code under test. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCellCity } = require("../helpers/load");

const CC = loadCellCity(["data/genetic-code.js", "js/biolab-core.js"]);
const bio = CC.bio;
const rna = (seq) => bio.normalise(seq);

// ---- input handling --------------------------------------------------------------

test("normalise: case, whitespace, line breaks, FASTA headers, empty input", () => {
  assert.equal(bio.normalise("  atg c\r\nGGT \t"), "ATGCGGT");
  assert.equal(bio.normalise(">seq1 description\nATG\n>seq2\nCC"), "ATGCC");
  assert.equal(bio.normalise("   >only a header"), "");
  assert.equal(bio.normalise(""), "");
  assert.equal(bio.normalise(null), "");
  assert.equal(bio.normalise(undefined), "");
});

test("validate DNA: accepts ACGT only and reports the first bad character (1-based)", () => {
  assert.deepEqual(bio.validate("ACGT", "DNA"), { ok: true });
  assert.equal(bio.validate("", "DNA").ok, false);
  const bad = bio.validate("ACGXT", "DNA");
  assert.equal(bad.ok, false);
  assert.match(bad.error, /“X” at position 4/);
  assert.match(bio.validate("AC1G", "DNA").error, /“1” at position 3/);
  assert.match(bio.validate("AXXC", "DNA").error, /2 invalid characters found/);
});

test("validate: U is explained for DNA and T is explained for RNA", () => {
  assert.match(bio.validate("ACGU", "DNA").error, /U belongs to RNA/);
  assert.match(bio.validate("ACGT", "RNA").error, /T belongs to DNA/);
  assert.deepEqual(bio.validate("ACGU", "RNA"), { ok: true });
  assert.equal(bio.validate("ACGU", "DNA").ok, false);
});

test("validate: markup-like input is just an invalid character, never executed or echoed whole", () => {
  const result = bio.validate("<img src=x onerror=alert(1)>", "DNA");
  assert.equal(result.ok, false);
  assert.ok(result.error.length < 200, "error message must not echo the whole input");
});

// ---- DNA statistics ---------------------------------------------------------------

test("analyse: counts, length and GC% for known sequences", () => {
  const a = bio.analyse("ATGC");
  assert.equal(a.length, 4);
  assert.deepEqual(a.counts, { A: 1, C: 1, G: 1, T: 1 });
  assert.equal(a.gcPercent, 50);
  assert.equal(bio.analyse("GGGG").gcPercent, 100);
  assert.equal(bio.analyse("AATT").gcPercent, 0);
  assert.ok(Math.abs(bio.analyse("GCGCAT").gcPercent - 66.6667) < 0.001); // 4 / 6
  assert.deepEqual(bio.analyse("AAAC").counts, { A: 3, C: 1, G: 0, T: 0 });
  const long = "ACGT".repeat(50) + "A";
  const b = bio.analyse(long);
  assert.equal(b.length, 201);
  assert.equal(b.counts.A + b.counts.C + b.counts.G + b.counts.T, b.length);
});

test("complement and reverse complement", () => {
  assert.equal(bio.complement("ATGC"), "TACG");
  assert.equal(bio.reverseComplement("ATGC"), "GCAT");
  assert.equal(bio.reverseComplement("GAATTC"), "GAATTC"); // EcoRI site is its own reverse complement
  assert.equal(bio.reverseComplement("A"), "T");
  assert.equal(bio.reverseComplement("ATGGCCATTGTAATGGGCCGCTGA"), "TCAGCGGCCCATTACAATGGCCAT");
  const seq = "GATTACACCGT";
  assert.equal(bio.reverseComplement(bio.reverseComplement(seq)), seq);
  assert.equal(bio.complement(bio.complement(seq)), seq);
});

// ---- transcription ----------------------------------------------------------------

test("transcribe, coding strand: same sequence with T -> U, no reversal", () => {
  assert.equal(bio.transcribe("ATGC", "coding"), "AUGC");
  assert.equal(bio.transcribe("ATGGCCATTGTAATGGGCCGCTGA", "coding"), "AUGGCCAUUGUAAUGGGCCGCUGA");
  assert.equal(bio.transcribe("T", "coding"), "U");
  assert.equal(bio.transcribe("GGCC", undefined), "GGCC"); // default strand is coding
});

test("transcribe, template strand: reverse complement with U (5'->3' convention)", () => {
  // Template 3'-TACCGT-5' is written 5'-TGCCAT-3'; RNA polymerase makes 5'-AUGGCA-3'.
  assert.equal(bio.transcribe("TGCCAT", "template"), "AUGGCA");
  assert.equal(bio.transcribe("TCAGCGGCCCATTACAATGGCCAT", "template"), "AUGGCCAUUGUAAUGGGCCGCUGA");
  assert.equal(bio.transcribe("T", "template"), "A");
  assert.equal(bio.transcribe("A", "template"), "U");
});

test("coding and template transcripts agree when the template is the reverse complement", () => {
  const coding = "ATGAAACCCGGGTTTTAG";
  const template = bio.reverseComplement(coding);
  assert.equal(bio.transcribe(template, "template"), bio.transcribe(coding, "coding"));
});

// ---- translation ------------------------------------------------------------------

test("translate: known protein, default options translate through stop codons", () => {
  const out = bio.translate("AUGGCCAUUGUAAUGGGCCGCUGA");
  assert.equal(out.protein, "MAIVMGR*");
  assert.equal(out.codons.length, 8);
  assert.equal(out.leftover, "");
  assert.equal(out.startIndex, 0);
  assert.equal(out.endedAtStop, false);
});

test("translate: stop handling", () => {
  const stopOff = bio.translate("AUGUAAGGG", { stopAtStop: false });
  assert.equal(stopOff.protein, "M*G");
  const stopOn = bio.translate("AUGUAAGGG", { stopAtStop: true });
  assert.equal(stopOn.protein, "M*");
  assert.equal(stopOn.endedAtStop, true);
  assert.equal(stopOn.leftover, "", "bases after the stop are not reported as 'leftover'");
  assert.equal(bio.translate("UAAAUG", { stopAtStop: false }).protein, "*M");
  assert.equal(bio.translate("UAAAUG", { stopAtStop: true }).protein, "*");
  for (const stop of ["UAA", "UAG", "UGA"]) assert.equal(bio.translate(stop).protein, "*");
});

test("translate: all three reading frames, with incomplete trailing codons reported", () => {
  const seq = "AAUGCCCUAG";
  const f1 = bio.translate(seq, { frame: 1 });
  assert.equal(f1.protein, "NAL");
  assert.equal(f1.leftover, "G");
  const f2 = bio.translate(seq, { frame: 2 });
  assert.equal(f2.protein, "MP*");
  assert.equal(f2.leftover, "");
  assert.equal(f2.startIndex, 1);
  const f3 = bio.translate(seq, { frame: 3 });
  assert.equal(f3.protein, "CP");
  assert.equal(f3.leftover, "AG");
  assert.equal(f3.startIndex, 2);
});

test("translate: optional AUG start, per frame", () => {
  // AUG sits at 0-based index 2 of GGAUGUUU, so only frame 3 finds it.
  assert.equal(bio.translate("GGAUGUUU", { frame: 1, startAtAug: true }).startFound, false);
  assert.equal(bio.translate("GGAUGUUU", { frame: 2, startAtAug: true }).startFound, false);
  const f3 = bio.translate("GGAUGUUU", { frame: 3, startAtAug: true });
  assert.equal(f3.startFound, true);
  assert.equal(f3.startIndex, 2);
  assert.equal(f3.protein, "MF");
  // Without the start option the same frame simply reads from base 3 onward.
  assert.equal(bio.translate("GGAUGUUU", { frame: 3, startAtAug: false }).protein, "MF");
  // An upstream non-AUG codon is skipped, not translated.
  assert.equal(bio.translate("UUAUGGCC", { frame: 3, startAtAug: true }).protein, "MA");
  assert.equal(bio.translate("UUAUGGCC", { frame: 1, startAtAug: true }).startFound, false);
  // AUG must be in frame: "UAUGCCC" has AUG at index 1, so frame 1 does not start there.
  assert.equal(bio.translate("UAUGCCC", { frame: 1, startAtAug: true }).startFound, false);
  assert.equal(bio.translate("UAUGCCC", { frame: 2, startAtAug: true }).protein, "MP");
});

test("translate: sequences too short for a codon, no start codon, and empty input", () => {
  const short = bio.translate("AU");
  assert.deepEqual([short.codons.length, short.protein, short.startFound], [0, "", true]);
  assert.equal(short.leftover, "AU");
  assert.equal(bio.translate("AUGAU").leftover, "AU");
  assert.equal(bio.translate("AU", { startAtAug: true }).startFound, false);
  assert.equal(bio.translate("GGGCCC", { startAtAug: true }).protein, "");
  const empty = bio.translate("");
  assert.deepEqual([empty.codons.length, empty.protein, empty.leftover], [0, "", ""]);
  assert.equal(bio.translate("AUGG", { frame: 3 }).codons.length, 0); // frame 3 of 4 bases: 2 bases left
});

test("translate: a character that is not a base throws a clear error instead of returning garbage", () => {
  assert.throws(() => bio.translate("AUGXXXUAA"), /"XXX" is not an RNA codon/);
  assert.throws(() => bio.translate("ATGGCC"), /not an RNA codon/); // DNA letters, not RNA
});

test("translate: lower-case input works after normalise, and never drops bases silently", () => {
  assert.equal(bio.translate(rna("aug gcc\nuaa")).protein, "MA*");
  const seq = "AUGGCCAUUGUAAUGGGCCGCUGAAU"; // 26 bases
  const out = bio.translate(seq);
  assert.equal(out.codons.length * 3 + out.leftover.length, seq.length);
});

test("translate agrees with an independent per-codon oracle for all 64 codons", () => {
  const letters = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  const order = "UCAG";
  let n = 0;
  for (const a of order) for (const b of order) for (const c of order) {
    assert.equal(bio.translate(a + b + c).protein, letters[n], a + b + c);
    n++;
  }
  // The same 64 codons concatenated in one sequence, read in frame 1.
  const all = [...order].flatMap((a) => [...order].flatMap((b) => [...order].map((c) => a + b + c))).join("");
  assert.equal(bio.translate(all).protein, letters);
});

// ---- mutations --------------------------------------------------------------------

const SEQ = "ATGGCC";
const mutate = (type, position, base) => bio.mutate(SEQ, { type, position, base });

test("substitution at first, middle, last position and as a no-op", () => {
  assert.equal(mutate("substitution", 1, "C").mutated, "CTGGCC");
  assert.equal(mutate("substitution", 3, "A").mutated, "ATAGCC");
  assert.equal(mutate("substitution", 6, "A").mutated, "ATGGCA");
  const same = mutate("substitution", 2, "T");
  assert.equal(same.ok, true);
  assert.equal(same.mutated, SEQ);
  assert.match(same.description, /unchanged/);
  assert.ok(same.columns.every((c) => c.state === "same"));
  const changed = mutate("substitution", 3, "A");
  assert.deepEqual(changed.columns.filter((c) => c.state !== "same"), [{ original: "G", mutated: "A", state: "changed", index: 3 }]);
});

test("insertion goes BEFORE the chosen position; length + 1 appends", () => {
  assert.equal(mutate("insertion", 1, "G").mutated, "GATGGCC");
  assert.equal(mutate("insertion", 4, "T").mutated, "ATGTGCC");
  assert.equal(mutate("insertion", 7, "A").mutated, "ATGGCCA");
  assert.equal(mutate("insertion", 7, "A").ok, true);
  assert.equal(mutate("insertion", 8, "A").ok, false);
  const ins = mutate("insertion", 4, "T");
  assert.deepEqual(ins.columns.filter((c) => c.state === "inserted"), [{ original: null, mutated: "T", state: "inserted", index: null }]);
});

test("deletion at first, middle and last position", () => {
  assert.equal(mutate("deletion", 1).mutated, "TGGCC");
  assert.equal(mutate("deletion", 3).mutated, "ATGCC");
  assert.equal(mutate("deletion", 6).mutated, "ATGGC");
  assert.equal(mutate("deletion", 7).ok, false);
  assert.deepEqual(mutate("deletion", 3).columns.filter((c) => c.state === "deleted"), [{ original: "G", mutated: null, state: "deleted", index: 3 }]);
});

test("result lengths and column alignment always reconstruct both sequences", () => {
  for (const [type, delta] of [["substitution", 0], ["insertion", 1], ["deletion", -1]]) {
    for (let position = 1; position <= SEQ.length; position++) {
      const out = mutate(type, position, "T");
      assert.equal(out.ok, true, `${type} @${position}`);
      assert.equal(out.mutated.length, SEQ.length + delta);
      assert.equal(out.columns.map((c) => c.original ?? "").join(""), SEQ);
      assert.equal(out.columns.map((c) => c.mutated ?? "").join(""), out.mutated);
    }
  }
});

test("invalid mutation requests are rejected with a message", () => {
  const bad = [
    mutate("substitution", 0, "A"),
    mutate("substitution", 7, "A"),
    mutate("substitution", -3, "A"),
    mutate("substitution", NaN, "A"),
    mutate("substitution", 2.5, "A"),
    mutate("insertion", 0, "A"),
    mutate("deletion", 0),
    mutate("substitution", 2, ""),
    mutate("substitution", 2, undefined),
    mutate("substitution", 2, "N"),
    mutate("insertion", 2, "U"),
    mutate("substitution", 2, "AC"), // more than one base
    mutate("bogus", 2, "A"),
    bio.mutate("A".repeat(bio.MAX_MUTATION_LENGTH + 1), { type: "deletion", position: 1 }),
  ];
  bad.forEach((outcome, i) => {
    assert.equal(outcome.ok, false, `case ${i} should be rejected`);
    assert.ok(typeof outcome.error === "string" && outcome.error.length > 0, `case ${i} needs an error message`);
  });
  assert.equal(bio.mutate("A".repeat(bio.MAX_MUTATION_LENGTH), { type: "deletion", position: 1 }).ok, true);
});

test("deletion ignores the base argument; the original sequence is never modified", () => {
  assert.equal(mutate("deletion", 2, "Z").ok, true);
  const before = SEQ;
  mutate("substitution", 1, "T");
  assert.equal(SEQ, before);
  assert.equal(mutate("substitution", 1, "T").original, SEQ);
});

// ---- mutation effect text (illustration, no clinical claims) ----------------------

test("substitution effects are classified from the codon change", () => {
  const eff = (seq, position, base) => bio.mutate(seq, { type: "substitution", position, base }).effect;
  assert.equal(eff("ATGGCC", 3, "A").kind, "missense"); // AUG -> AUA, Met -> Ile
  assert.equal(eff("ATGGCC", 6, "A").kind, "silent"); // GCC -> GCA, Ala -> Ala
  assert.equal(eff("TGGGCC", 3, "A").kind, "nonsense"); // UGG (Trp) -> UGA (stop)
  assert.equal(eff("TGAGCC", 3, "G").kind, "stop-lost"); // UGA (stop) -> UGG (Trp)
  assert.equal(eff("ATGGCC", 2, "T").kind, "none");
  assert.equal(eff("ATGGC", 5, "A").kind, "untranslated"); // base 5 is in an incomplete trailing codon
  assert.equal(eff("ATGGCC", 3, "A").before, "MA");
  assert.equal(eff("ATGGCC", 3, "A").after, "IA");
});

test("changing one stop codon into another is described as a stop, not as 'coding for Stop'", () => {
  const { text } = bio.mutate("TAAGCC", { type: "substitution", position: 3, base: "G" }).effect; // UAA -> UAG
  assert.match(text, /stop/i);
  assert.doesNotMatch(text, /codes for Stop/);
});

test("insertions and deletions do not claim to be frameshifts unconditionally", () => {
  for (const type of ["insertion", "deletion"]) {
    const { text } = bio.mutate("ATGGCCATT", { type, position: 4, base: "A" }).effect;
    assert.match(text, /multiple of (three|3)/i, `${type} text must mention the multiple-of-three condition`);
    assert.doesNotMatch(text, /^A single-base \w+ shifts the reading frame/);
  }
});

// ---- codon search -----------------------------------------------------------------

test("codon search matches codons, amino-acid names, symbols and 'stop'", () => {
  const codons = CC.data.geneticCode.codons;
  const find = (query) => codons.filter((c) => bio.matchCodon(c, query)).map((c) => c.codon);
  assert.deepEqual(find(""), codons.map((c) => c.codon));
  assert.deepEqual(find("aug"), ["AUG"]);
  assert.deepEqual(find("atg"), ["AUG"]); // T accepted for U
  assert.deepEqual(find("uu").sort(), ["UUA", "UUC", "UUG", "UUU"]);
  assert.deepEqual(find("stop").sort(), ["UAA", "UAG", "UGA"]);
  assert.deepEqual(find("*").sort(), ["UAA", "UAG", "UGA"]);
  assert.deepEqual(find("leu").sort(), ["CUA", "CUC", "CUG", "CUU", "UUA", "UUG"]);
  assert.deepEqual(find("leucine").sort(), find("leu").sort());
  assert.deepEqual(find("acid").sort(), ["GAA", "GAC", "GAG", "GAU"]); // aspartic + glutamic acid
  assert.deepEqual(find("m"), ["AUG"]);
  assert.deepEqual(find("zzz"), []);
});

test("one-letter amino-acid symbols that are also base letters (A, C, G, T) find the amino acid", () => {
  const codons = CC.data.geneticCode.codons;
  const find = (query) => codons.filter((c) => bio.matchCodon(c, query));
  assert.ok(find("a").some((c) => c.letter === "A"), "A should find alanine");
  assert.ok(find("c").some((c) => c.letter === "C"), "C should find cysteine");
  assert.ok(find("g").some((c) => c.letter === "G"), "G should find glycine");
  assert.ok(find("t").some((c) => c.letter === "T"), "T should find threonine");
  // ...and still behaves as a first-base prefix for codon lookups.
  assert.ok(find("a").some((c) => c.codon === "AUG"));
});
