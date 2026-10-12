"use strict";

/*
 * The standard genetic code (NCBI translation table 1) — the single source of
 * truth for both the Codon Explorer and the translation engine.
 *
 * AMINO_ACIDS_BY_CODON lists the amino acid for each of the 64 RNA codons in
 * the order produced by iterating bases U, C, A, G for positions 1, 2 and 3
 * ("*" = stop). The codon list is derived from it so the two can never drift.
 */
window.CellCity = window.CellCity || {};
window.CellCity.data = window.CellCity.data || {};

(function () {
  const BASES = "UCAG";
  const AMINO_ACIDS_BY_CODON =
    "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

  const AMINO_ACIDS = {
    A: { name: "Alanine", three: "Ala" },
    R: { name: "Arginine", three: "Arg" },
    N: { name: "Asparagine", three: "Asn" },
    D: { name: "Aspartic acid", three: "Asp" },
    C: { name: "Cysteine", three: "Cys" },
    E: { name: "Glutamic acid", three: "Glu" },
    Q: { name: "Glutamine", three: "Gln" },
    G: { name: "Glycine", three: "Gly" },
    H: { name: "Histidine", three: "His" },
    I: { name: "Isoleucine", three: "Ile" },
    L: { name: "Leucine", three: "Leu" },
    K: { name: "Lysine", three: "Lys" },
    M: { name: "Methionine", three: "Met" },
    F: { name: "Phenylalanine", three: "Phe" },
    P: { name: "Proline", three: "Pro" },
    S: { name: "Serine", three: "Ser" },
    T: { name: "Threonine", three: "Thr" },
    W: { name: "Tryptophan", three: "Trp" },
    Y: { name: "Tyrosine", three: "Tyr" },
    V: { name: "Valine", three: "Val" },
    "*": { name: "Stop", three: "Stop" },
  };

  const codons = [];
  for (const b1 of BASES) {
    for (const b2 of BASES) {
      for (const b3 of BASES) {
        const letter = AMINO_ACIDS_BY_CODON[codons.length];
        codons.push({
          codon: b1 + b2 + b3,
          letter,
          name: AMINO_ACIDS[letter].name,
          three: AMINO_ACIDS[letter].three,
          isStop: letter === "*",
          isStart: b1 + b2 + b3 === "AUG",
        });
      }
    }
  }

  window.CellCity.data.geneticCode = {
    codons,
    byCodon: Object.fromEntries(codons.map((c) => [c.codon, c])),
    aminoAcids: AMINO_ACIDS,
  };
})();
