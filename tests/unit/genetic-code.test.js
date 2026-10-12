"use strict";

/*
 * The expected values here are written independently of data/genetic-code.js:
 * the oracle lists codons per amino acid (the layout used in textbooks), while
 * the site stores a 64-letter string in UCAG order. A shared mistake in one
 * cannot silently pass against the other.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCellCity } = require("../helpers/load");

const ORACLE = [
  // one-letter, three-letter, name, codons
  ["A", "Ala", "Alanine", "GCU GCC GCA GCG"],
  ["R", "Arg", "Arginine", "CGU CGC CGA CGG AGA AGG"],
  ["N", "Asn", "Asparagine", "AAU AAC"],
  ["D", "Asp", "Aspartic acid", "GAU GAC"],
  ["C", "Cys", "Cysteine", "UGU UGC"],
  ["Q", "Gln", "Glutamine", "CAA CAG"],
  ["E", "Glu", "Glutamic acid", "GAA GAG"],
  ["G", "Gly", "Glycine", "GGU GGC GGA GGG"],
  ["H", "His", "Histidine", "CAU CAC"],
  ["I", "Ile", "Isoleucine", "AUU AUC AUA"],
  ["L", "Leu", "Leucine", "UUA UUG CUU CUC CUA CUG"],
  ["K", "Lys", "Lysine", "AAA AAG"],
  ["M", "Met", "Methionine", "AUG"],
  ["F", "Phe", "Phenylalanine", "UUU UUC"],
  ["P", "Pro", "Proline", "CCU CCC CCA CCG"],
  ["S", "Ser", "Serine", "UCU UCC UCA UCG AGU AGC"],
  ["T", "Thr", "Threonine", "ACU ACC ACA ACG"],
  ["W", "Trp", "Tryptophan", "UGG"],
  ["Y", "Tyr", "Tyrosine", "UAU UAC"],
  ["V", "Val", "Valine", "GUU GUC GUA GUG"],
  ["*", "Stop", "Stop", "UAA UAG UGA"],
];

const expected = new Map();
for (const [letter, three, name, codons] of ORACLE) {
  for (const codon of codons.split(" ")) expected.set(codon, { letter, three, name });
}

const CC = loadCellCity(["data/genetic-code.js"]);
const code = CC.data.geneticCode;

test("the oracle itself covers 64 distinct codons", () => {
  assert.equal(expected.size, 64);
});

test("the table has exactly 64 unique codons made only of U, C, A, G", () => {
  assert.equal(code.codons.length, 64);
  assert.equal(new Set(code.codons.map((c) => c.codon)).size, 64);
  for (const { codon } of code.codons) assert.match(codon, /^[UCAG]{3}$/);
  assert.equal(Object.keys(code.byCodon).length, 64);
});

test("every codon maps to the standard amino acid (letter, 3-letter code and name)", () => {
  for (const entry of code.codons) {
    const want = expected.get(entry.codon);
    assert.ok(want, `unexpected codon ${entry.codon}`);
    assert.deepEqual({ letter: entry.letter, three: entry.three, name: entry.name }, want, entry.codon);
    assert.equal(code.byCodon[entry.codon], entry);
  }
});

test("exactly three stop codons (UAA, UAG, UGA) and one start codon (AUG)", () => {
  const stops = code.codons.filter((c) => c.isStop).map((c) => c.codon).sort();
  assert.deepEqual(stops, ["UAA", "UAG", "UGA"]);
  assert.deepEqual(code.codons.filter((c) => c.isStart).map((c) => c.codon), ["AUG"]);
  assert.equal(code.codons.filter((c) => !c.isStop).length, 61);
});

test("degeneracy: 20 amino acids, Met and Trp are single-codon, Leu/Ser/Arg have six", () => {
  const counts = {};
  for (const c of code.codons) counts[c.letter] = (counts[c.letter] || 0) + 1;
  assert.equal(Object.keys(counts).filter((l) => l !== "*").length, 20);
  assert.equal(counts.M, 1);
  assert.equal(counts.W, 1);
  assert.deepEqual([counts.L, counts.S, counts.R], [6, 6, 6]);
  assert.equal(counts["*"], 3);
});

test("amino-acid dictionary names every letter used and nothing is missing", () => {
  for (const [letter, three, name] of ORACLE) {
    assert.deepEqual(code.aminoAcids[letter], { name, three }, letter);
  }
  assert.equal(Object.keys(code.aminoAcids).length, ORACLE.length);
});
