"use strict";

/*
 * Bio Lab sequence logic: pure functions with no DOM access, so they are easy
 * to reason about and to test. All sequences are plain upper-case strings
 * written 5' -> 3'.
 *
 * Positions shown to the user are 1-based (the first base is position 1).
 */
(function () {
  const CC = (window.CellCity = window.CellCity || {});

  const DNA_BASES = "ACGT";
  const RNA_BASES = "ACGU";
  const COMPLEMENT = { A: "T", T: "A", G: "C", C: "G" };
  const MAX_MUTATION_LENGTH = 200;

  // ---- input handling ---------------------------------------------------------

  /** Removes FASTA header lines and whitespace, then upper-cases. */
  function normalise(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith(">"))
      .join("")
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  /**
   * Validates a normalised sequence against an alphabet.
   * Returns { ok: true } or { ok: false, error: "readable message" }.
   */
  function validate(seq, kind) {
    const alphabet = kind === "RNA" ? RNA_BASES : DNA_BASES;
    const list = [...alphabet].join(", ").replace(/, ([A-Z])$/, " and $1");
    if (!seq) return { ok: false, error: `Enter a ${kind} sequence first.` };

    const badIndex = [...seq].findIndex((ch) => !alphabet.includes(ch));
    if (badIndex === -1) return { ok: true };

    const bad = seq[badIndex];
    const total = [...seq].filter((ch) => !alphabet.includes(ch)).length;
    let message = `Invalid character “${bad}” at position ${badIndex + 1}. ${kind} may contain only ${list}.`;
    if (total > 1) message += ` (${total} invalid characters found.)`;
    if (kind === "RNA" && seq.includes("T")) message += " T belongs to DNA; use the Transcription tab to convert DNA to RNA.";
    if (kind === "DNA" && seq.includes("U")) message += " U belongs to RNA; DNA uses T instead.";
    return { ok: false, error: message };
  }

  // ---- DNA analysis -------------------------------------------------------------

  const complement = (seq) => [...seq].map((b) => COMPLEMENT[b]).join("");
  const reverseComplement = (seq) => [...complement(seq)].reverse().join("");

  /** GC content = (G + C) / length x 100 */
  function gcPercent(seq) {
    const gc = [...seq].filter((b) => b === "G" || b === "C").length;
    return (gc / seq.length) * 100;
  }

  function analyse(seq) {
    const counts = { A: 0, C: 0, G: 0, T: 0 };
    for (const base of seq) counts[base]++;
    return {
      length: seq.length,
      counts,
      gcPercent: gcPercent(seq),
      complement: complement(seq),
      reverseComplement: reverseComplement(seq),
    };
  }

  // ---- transcription ------------------------------------------------------------

  /**
   * strand "coding":   mRNA has the same sequence as the input, with T -> U.
   * strand "template": mRNA is the reverse complement of the input, with T -> U.
   */
  function transcribe(seq, strand) {
    const mrna = strand === "template" ? reverseComplement(seq) : seq;
    return mrna.replaceAll("T", "U");
  }

  // ---- translation --------------------------------------------------------------

  /**
   * Translates RNA codon by codon using the standard genetic code.
   * options: frame (1-3), startAtAug, stopAtStop
   * Returns { codons, protein, leftover, startIndex, startFound, endedAtStop }
   * where startIndex is 0-based and leftover is the untranslated incomplete tail.
   */
  function translate(rna, { frame = 1, startAtAug = false, stopAtStop = false } = {}) {
    const table = CC.data.geneticCode.byCodon;
    let i = frame - 1;

    if (startAtAug) {
      while (i + 3 <= rna.length && rna.substr(i, 3) !== "AUG") i += 3;
      if (i + 3 > rna.length) {
        return { codons: [], protein: "", leftover: "", startIndex: -1, startFound: false, endedAtStop: false };
      }
    }
    const startIndex = i;

    const codons = [];
    let endedAtStop = false;
    while (i + 3 <= rna.length) {
      const entry = table[rna.substr(i, 3)];
      codons.push(entry);
      i += 3;
      if (entry.isStop && stopAtStop) {
        endedAtStop = true;
        break;
      }
    }
    return {
      codons,
      protein: codons.map((c) => c.letter).join(""),
      leftover: endedAtStop ? "" : rna.slice(i),
      startIndex,
      startFound: true,
      endedAtStop,
    };
  }

  // ---- mutations ----------------------------------------------------------------

  /**
   * Applies one edit to a DNA sequence.
   *   substitution: replace the base at `position` (1..length) with `base`
   *   insertion:    insert `base` immediately BEFORE `position` (1..length+1;
   *                 length+1 appends after the last base)
   *   deletion:     remove the base at `position` (1..length)
   * Returns { ok:false, error } or { ok:true, original, mutated, columns, description }.
   * `columns` aligns the two sequences for display: each has
   * { original, mutated, state, index } where state is
   * "same" | "changed" | "inserted" | "deleted" and the missing side is null.
   */
  function mutate(seq, { type, position, base }) {
    const n = seq.length;
    if (n > MAX_MUTATION_LENGTH) {
      return { ok: false, error: `The visualiser handles up to ${MAX_MUTATION_LENGTH} bases; your sequence has ${n}.` };
    }
    if (!Number.isInteger(position)) return { ok: false, error: "Enter a whole number for the position." };

    const maxPosition = type === "insertion" ? n + 1 : n;
    if (position < 1 || position > maxPosition) {
      return { ok: false, error: `Position must be between 1 and ${maxPosition} for ${type} on this sequence.` };
    }
    if (type !== "deletion" && !DNA_BASES.includes(base || "?")) {
      return { ok: false, error: "Choose a new base: A, C, G or T." };
    }

    const same = (i) => ({ original: seq[i], mutated: seq[i], state: "same", index: i + 1 });
    const columns = [];
    let mutated;
    let description;

    if (type === "substitution") {
      const before = seq[position - 1];
      for (let i = 0; i < n; i++) {
        columns.push(i === position - 1 && before !== base
          ? { original: before, mutated: base, state: "changed", index: i + 1 }
          : same(i));
      }
      mutated = seq.slice(0, position - 1) + base + seq.slice(position);
      description =
        before === base
          ? `Substitution at position ${position}: the new base (${base}) matches the original, so the sequence is unchanged.`
          : `Substitution at position ${position}: ${before} → ${base}.`;
    } else if (type === "insertion") {
      for (let i = 0; i < n; i++) {
        if (i === position - 1) columns.push({ original: null, mutated: base, state: "inserted", index: null });
        columns.push(same(i));
      }
      if (position === n + 1) columns.push({ original: null, mutated: base, state: "inserted", index: null });
      mutated = seq.slice(0, position - 1) + base + seq.slice(position - 1);
      description =
        position === n + 1
          ? `Insertion: ${base} added after the last base, as new position ${position}.`
          : `Insertion: ${base} placed immediately before original position ${position}. It becomes position ${position} of the new sequence, and the original base ${position} (${seq[position - 1]}) moves to position ${position + 1}.`;
    } else if (type === "deletion") {
      for (let i = 0; i < n; i++) {
        columns.push(i === position - 1 ? { original: seq[i], mutated: null, state: "deleted", index: i + 1 } : same(i));
      }
      mutated = seq.slice(0, position - 1) + seq.slice(position);
      description = `Deletion: ${seq[position - 1]} removed from position ${position}. Every later base moves up by one position.`;
    } else {
      return { ok: false, error: "Choose a mutation type." };
    }

    return { ok: true, original: seq, mutated, columns, description, effect: describeEffect(seq, mutated, type, position) };
  }

  /**
   * Illustrative only: reads both sequences as coding DNA in frame 1 and says
   * what the edit does to the codons. It makes no claim about real genes.
   */
  function describeEffect(original, mutated, type, position) {
    const read = (seq) => translate(transcribe(seq, "coding"), { frame: 1 });
    const before = read(original);
    const after = read(mutated);
    const result = { before: before.protein, after: after.protein, kind: "none", text: "" };

    if (original === mutated) {
      result.text = "No change to the sequence, so no change to the codons.";
      return result;
    }

    if (type === "substitution") {
      const codonIndex = Math.floor((position - 1) / 3);
      const was = before.codons[codonIndex];
      const now = after.codons[codonIndex];
      if (!was) {
        result.kind = "untranslated";
        result.text = "The changed base is in an incomplete trailing codon, which is not translated in frame 1.";
      } else if (was.letter === now.letter) {
        result.kind = "silent";
        result.text = `Silent: codon ${codonIndex + 1} changes (${was.codon} → ${now.codon}) but still codes for ${was.name}.`;
      } else if (now.isStop) {
        result.kind = "nonsense";
        result.text = `Nonsense-type change: codon ${codonIndex + 1} (${was.codon} → ${now.codon}) becomes a stop codon.`;
      } else if (was.isStop) {
        result.kind = "stop-lost";
        result.text = `Stop lost: codon ${codonIndex + 1} (${was.codon} → ${now.codon}) no longer ends translation.`;
      } else {
        result.kind = "missense";
        result.text = `Missense-type change: codon ${codonIndex + 1} (${was.codon} → ${now.codon}) changes ${was.name} to ${now.name}.`;
      }
    } else {
      result.kind = "frameshift";
      result.text =
        `A single-base ${type} shifts the reading frame of every codon after this point, so the codons downstream are read differently.`;
    }
    return result;
  }

  CC.bio = {
    MAX_MUTATION_LENGTH,
    normalise,
    validate,
    analyse,
    complement,
    reverseComplement,
    gcPercent,
    transcribe,
    translate,
    mutate,
  };
})();
